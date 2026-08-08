using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ParkingSystem.Application.DTOs.Payment;
using ParkingSystem.Application.DTOs.Reservation;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

public class ReservationService : IReservationService
{
    private readonly ApplicationDbContext _context;
    private readonly IQrCodeService _qrCodeService;
    private readonly INotificationService _notificationService;
    private readonly ISlotAssignmentService _slotAssignmentService;
    private readonly IPaymentService _paymentService;
    private readonly ILogger<ReservationService> _logger;
    private readonly IRealtimeService _realtimeService;

    public ReservationService(
        ApplicationDbContext context,
        IQrCodeService qrCodeService,
        INotificationService notificationService,
        ISlotAssignmentService slotAssignmentService,
        IPaymentService paymentService,
        ILogger<ReservationService> logger,
        IRealtimeService realtimeService)
    {
        _context = context;
        _qrCodeService = qrCodeService;
        _notificationService = notificationService;
        _slotAssignmentService = slotAssignmentService;
        _paymentService = paymentService;
        _logger = logger;
        _realtimeService = realtimeService;
    }

    public async Task<ReservationResponse> CreateReservationAsync(Guid driverId, CreateReservationRequest request)
    {
        // 1. Validate thời gian
        if (request.StartTime <= DateTime.UtcNow)
            throw new InvalidOperationException("Start time must be greater than current time.");

        if (request.EndTime <= request.StartTime)
            throw new InvalidOperationException("End time must be greater than start time.");

        // 2. Lấy thông tin xe từ bảng Vehicles
        var vehicle = await _context.Vehicles
            .Include(v => v.VehicleType)
            .FirstOrDefaultAsync(v => v.Id == request.VehicleId && v.DriverId == driverId);

        if (vehicle == null)
            throw new InvalidOperationException("Vehicle does not exist or does not belong to you.");

        var licensePlate = vehicle.PlateNumber;
        var vehicleTypeId = vehicle.VehicleTypeId;

        // 3. Kiểm tra xe đã có vé tháng đang hoạt động chưa
        var hasActiveSubscription = await _context.Subscriptions
            .AnyAsync(s => s.LicensePlate == licensePlate
                        && s.Status == SubscriptionStatus.Active
                        && s.EndDate > DateTime.UtcNow);

        if (hasActiveSubscription)
            throw new InvalidOperationException($"License plate {licensePlate} already has an active monthly pass. You do not need to book a reservation.");

        // 4. Kiểm tra xe đã có booking nào trùng giờ chưa
        var activeStatuses = new List<ReservationStatus>
        {
            ReservationStatus.PaymentPending,
            ReservationStatus.Paid,
            ReservationStatus.PendingReview,
            ReservationStatus.Confirmed,
            ReservationStatus.CheckedIn
        };

        var reqStartTime = request.StartTime;
        var reqEndTime = request.EndTime;

        // --- ANTI-SPAM BOOKING: 1 Driver <= 3 Active Reservations ---
        var activeReservationCount = await _context.Reservations
            .CountAsync(r => r.DriverId == driverId && activeStatuses.Contains(r.Status));
        if (activeReservationCount >= 3)
            throw new InvalidOperationException("You have reached the limit of 3 active reservations. Please complete or cancel some before creating a new one.");

        var hasExistingBooking = await _context.Reservations
            .AnyAsync(r => r.LicensePlate == licensePlate
                        && activeStatuses.Contains(r.Status)
                        && r.StartTime < reqEndTime
                        && r.EndTime > reqStartTime);
        if (hasExistingBooking)
            throw new InvalidOperationException($"License plate {licensePlate} already has a reservation during this time.");

        // 4. Chọn Slot & Transaction Lock
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            Guid targetSlotId;
            double? aiScore = null;
            string? aiReason = null;

            if (request.BookingMethod == BookingMethod.AIRecommended)
            {
                // ===== CHẾ ĐỘ AI =====
                if (request.ParkingSlotId.HasValue)
                {
                    targetSlotId = request.ParkingSlotId.Value;
                }
                else
                {
                    var bestSlot = await _slotAssignmentService.GetBestSlotAsync(vehicleTypeId, request.BuildingId);
                    if (bestSlot == null)
                    {
                        var scope = request.BuildingId.HasValue ? " trong tòa nhà đã chọn" : "";
                        throw new InvalidOperationException($"No suitable available slot found{scope}.");
                    }
                    targetSlotId = bestSlot.SlotId;
                    aiScore = bestSlot.Score;
                    aiReason = bestSlot.Reason;
                }
            }
            else
            {
                // ===== CHẾ ĐỘ MANUAL =====
                if (!request.ParkingSlotId.HasValue)
                    throw new InvalidOperationException("Please select a parking slot (ParkingSlotId) for manual booking.");
                targetSlotId = request.ParkingSlotId.Value;
            }

            // Lock Row: FOR UPDATE (PostgreSQL)
            var slot = await _context.ParkingSlots
                .FromSqlRaw("SELECT * FROM \"ParkingSlots\" WHERE \"Id\" = {0} FOR UPDATE", targetSlotId)
                .Include(s => s.Floor)
                    .ThenInclude(f => f!.Building)
                .FirstOrDefaultAsync();

            if (slot == null)
                throw new InvalidOperationException("Parking slot does not exist.");

            // 5. Validate slot (Race Condition Check)
            // Slot Maintenance → luôn chặn
            if (slot.Status == SlotStatus.Maintenance)
                throw new InvalidOperationException($"Parking slot {slot.SlotNumber} is under maintenance, cannot book.");

            // Kiểm tra loại xe phù hợp
            if (slot.VehicleTypeId != vehicleTypeId)
            {
                var slotVehicleType = await _context.VehicleTypes.FindAsync(slot.VehicleTypeId);
                throw new InvalidOperationException(
                    $"Parking slot {slot.SlotNumber} is reserved for {slotVehicleType?.Name ?? "other vehicle types"}, " +
                    $"and does not support {vehicle.VehicleType?.Name ?? "your selected vehicle"}.");
            }

            // 6. Kiểm tra khung giờ trùng (Double Check - đây là điều kiện quan trọng nhất)
            // Cho phép đặt slot đang Reserved/Occupied NẾU khung giờ KHÔNG trùng lắp
            var hasOverlapping = await _context.Reservations
                .AnyAsync(r => r.ParkingSlotId == slot.Id
                            && activeStatuses.Contains(r.Status)
                            && r.StartTime < reqEndTime
                            && r.EndTime > reqStartTime);
            if (hasOverlapping)
            {
                // Có trùng giờ thật sự → gợi ý slot khác
                string suggestMsg = "";
                if (request.BookingMethod == BookingMethod.Manual)
                {
                    var suggest = await _slotAssignmentService.GetBestSlotAsync(vehicleTypeId, request.BuildingId);
                    if (suggest != null)
                        suggestMsg = $" 💡 Gợi ý: Bạn có thể đổi sang ô {suggest.SlotNumber} (Tầng {suggest.FloorName}).";
                }
                throw new InvalidOperationException($"Parking slot {slot.SlotNumber} is already booked during this time.{suggestMsg}");
            }

            // 7. Sinh mã Booking Code
            var bookingCode = await GenerateBookingCodeAsync();

            // Cập nhật trạng thái Slot → TemporaryHeld
            // CHỈ đổi khi slot đang Available VÀ booking bắt đầu trong vòng 30 phút nữa.
            // Nếu booking cho tương lai (ví dụ: ngày mai), KHÔNG ghi đè để slot hôm nay vẫn có thể được dùng.
            var isImmediate = request.StartTime <= DateTime.UtcNow.AddMinutes(30);
            var shouldUpdateSlotStatus = slot.Status == SlotStatus.Available && isImmediate;
            if (shouldUpdateSlotStatus)
            {
                slot.Status = SlotStatus.TemporaryHeld;
                slot.UpdatedAt = DateTime.UtcNow;
            }

            // ===== TÍNH PHÍ VÀ TẠO LINK PAYOS =====
            string? checkoutUrl = null;
            decimal? bookingFee = null;
            long? payOSOrderCode = null;
            var initialStatus = ReservationStatus.PaymentPending;

            decimal fee = await EstimateFeeAsync(vehicleTypeId, request.StartTime, request.EndTime);

            var approvalMode = slot.Floor?.Building?.ApprovalMode ?? ReservationApprovalMode.Manual;

            bool isAutoApprove = false;
            if (approvalMode != ReservationApprovalMode.AutoReject)
            {
                // Manual hoặc AutoApprove: kiểm tra isAutoApprove để set initialStatus
                var buildingId = slot.Floor?.BuildingId;
                var assignedStaffs = await _context.Users
                    .Where(u => u.Role == ParkingSystem.Domain.Enums.Role.Admin
                             || u.Role == ParkingSystem.Domain.Enums.Role.Manager
                             || u.Role == ParkingSystem.Domain.Enums.Role.Staff)
                    .Where(u => u.Role == ParkingSystem.Domain.Enums.Role.Admin // Admin nhận tất cả, không lọc theo tòa nhà
                             || !u.AssignedBuildingId.HasValue || !buildingId.HasValue || u.AssignedBuildingId == buildingId)
                    .ToListAsync();

                isAutoApprove = approvalMode == ReservationApprovalMode.AutoApprove
                    || assignedStaffs.Any(u => u.IsAutoApproveReservations);

                if (isAutoApprove)
                {
                    initialStatus = ReservationStatus.Confirmed;
                    if (shouldUpdateSlotStatus)
                        slot.Status = SlotStatus.Reserved;
                }
                else
                {
                    initialStatus = ReservationStatus.PendingReview;
                    if (shouldUpdateSlotStatus)
                        slot.Status = SlotStatus.Reserved;
                }
            }

            // 8. Tạo Reservation
            var reservation = new Reservation
            {
                Id = Guid.NewGuid(),
                DriverId = driverId,
                ParkingSlotId = slot.Id,
                VehicleTypeId = vehicleTypeId,
                VehicleId = vehicle.Id,
                LicensePlate = licensePlate,
                BookingCode = bookingCode,
                BookingMethod = request.BookingMethod,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                Status = initialStatus,
                AIScore = aiScore,
                AIReason = aiReason
            };

            _context.Reservations.Add(reservation);
            LogState(reservation, "Create", "User created reservation");

            // Nếu có phí thì xử lý thanh toán
            if (fee > 0)
            {
                if (request.PaymentMethod == PaymentMethod.PayOS)
                {
                    // Chờ thanh toán qua PayOS (FE sẽ gọi API tạo thanh toán)
                    reservation.Status = ReservationStatus.PaymentPending;
                }
                else
                {
                    var driver = await _context.Users.FirstOrDefaultAsync(u => u.Id == driverId);
                    if (driver == null) throw new InvalidOperationException("Driver information not found.");

                    if (driver.Balance < fee)
                    {
                        var required = fee - driver.Balance;
                        throw new InvalidOperationException($"INSUFFICIENT_BALANCE:{required}:{fee}:{driver.Balance}");
                    }

                // Trừ ví và tạo Transaction
                driver.Balance -= fee;
                _context.WalletTransactions.Add(new WalletTransaction
                {
                    Id = Guid.NewGuid(),
                    UserId = driver.Id,
                    Amount = fee,
                    Type = "BookingPayment",
                    Status = "Success",
                    Description = $"Pay reservation fee {bookingCode}",
                    CreatedAt = DateTime.UtcNow
                });

                // Cập nhật trạng thái Reservation luôn vì đã trừ tiền
                reservation.Status = isAutoApprove ? ReservationStatus.Confirmed : ReservationStatus.PendingReview;

                // Tạo Entity Payment (Lịch sử thanh toán cho Booking)
                var payment = new Payment
                {
                    Id = Guid.NewGuid(),
                    ReservationId = reservation.Id,
                    Amount = fee,
                    Description = $"Pay with Wallet for Booking {bookingCode}",
                    PaymentDate = DateTime.UtcNow,
                    PaymentMethod = PaymentMethod.Wallet,
                    Status = PaymentStatus.Success,
                    PayOSOrderCode = long.Parse($"{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}{Random.Shared.Next(1000, 9999)}"),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.Payments.Add(payment);

                bookingFee = fee;
                _logger.LogInformation("Booking paid successfully with Wallet. ReservationId={Id}, Fee={Fee}", reservation.Id, fee);
                }
            }

            // Lưu trước để Commit
            await _context.SaveChangesAsync();

            // Mọi thứ OK thì mới Commit Database
            await transaction.CommitAsync();

            await _realtimeService.SendSlotStatusUpdateAsync(slot.Id, slot.Status.ToString());
            await _realtimeService.SendDashboardUpdateAsync();

            // Gửi Notification sau khi đặt chỗ (và đã thanh toán xong qua ví nếu có phí)
            if (reservation.Status == ReservationStatus.Confirmed)
            {
                    await _notificationService.SendAsync(
                        reservation.DriverId,
                        "✅ Reservation Accepted",
                        $"Reservation request {reservation.BookingCode} has been automatically accepted by the system.",
                        "ReservationAccepted",
                        reservation.Id);

                    // Thông báo cho Staff/Manager biết có booking mới (tự duyệt, miễn phí)
                    var buildingIdAuto = slot.Floor?.BuildingId;
                    var staffsAuto = await _context.Users
                        .Where(u => u.Role == ParkingSystem.Domain.Enums.Role.Admin
                                 || u.Role == ParkingSystem.Domain.Enums.Role.Manager
                                 || u.Role == ParkingSystem.Domain.Enums.Role.Staff)
                        .Where(u => u.Role == ParkingSystem.Domain.Enums.Role.Admin
                                 || !u.AssignedBuildingId.HasValue || u.AssignedBuildingId == buildingIdAuto)
                        .Where(u => u.Role == ParkingSystem.Domain.Enums.Role.Admin // Admin luôn nhận
                                 || u.Role == ParkingSystem.Domain.Enums.Role.Manager // Manager luôn nhận
                                 || u.IsNotificationEnabled) // Staff chỉ nhận khi bật
                        .ToListAsync();

                    foreach (var staff in staffsAuto)
                    {
                        await _notificationService.SendAsync(
                            staff.Id,
                            "🔔 New Reservation (Auto-approved)",
                            $"Reservation {reservation.BookingCode} has been automatically approved.",
                            "NewReservation",
                            reservation.Id);
                    }
                }
                else if (reservation.Status == ReservationStatus.PendingReview)
                {
                    await _notificationService.SendAsync(
                        reservation.DriverId,
                        "💳 Reservation Successful",
                        $"Reservation {reservation.BookingCode} is successful. Waiting for Staff approval.",
                        "PendingReview",
                        reservation.Id);

                    var buildingId = slot.Floor?.BuildingId;
                    var staffsToNotify = await _context.Users
                        .Where(u => u.Role == ParkingSystem.Domain.Enums.Role.Admin
                                 || u.Role == ParkingSystem.Domain.Enums.Role.Manager
                                 || u.Role == ParkingSystem.Domain.Enums.Role.Staff)
                        .Where(u => u.Role == ParkingSystem.Domain.Enums.Role.Admin
                                 || !u.AssignedBuildingId.HasValue || !buildingId.HasValue || u.AssignedBuildingId == buildingId)
                        .Where(u => u.Role == ParkingSystem.Domain.Enums.Role.Admin // Admin luôn nhận
                                 || u.Role == ParkingSystem.Domain.Enums.Role.Manager // Manager luôn nhận
                                 || u.IsNotificationEnabled) // Staff chỉ nhận khi bật
                        .ToListAsync();

                    foreach (var staff in staffsToNotify)
                    {
                        await _notificationService.SendAsync(
                            staff.Id,
                            "🔔 New Reservation",
                            $"A new reservation request ({reservation.BookingCode}) is pending approval.",
                            "NewReservation",
                            reservation.Id);
                    }
                }

            return MapToResponse(reservation, slot, checkoutUrl, bookingFee, payOSOrderCode);

        }
        catch (Exception)
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // ===== THANH TOÁN THÀNH CÔNG → Chuyển sang PendingReview =====
    public async Task<bool> ConfirmPaymentAsync(Guid reservationId)
    {
        var reservation = await _context.Reservations
            .Include(r => r.ParkingSlot)
            .ThenInclude(s => s.Floor)
            .FirstOrDefaultAsync(r => r.Id == reservationId);

        if (reservation == null)
            throw new InvalidOperationException("Reservation information not found.");

        if (reservation.Status != ReservationStatus.PaymentPending)
            throw new InvalidOperationException("Reservation is not in pending payment status.");

        // Lấy thông tin giao dịch Payment mới nhất của đặt chỗ này để verify với PayOS
        var payment = await _context.Payments
            .Where(p => p.ReservationId == reservationId && p.PaymentMethod == PaymentMethod.PayOS)
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync();

        if (payment == null)
            throw new InvalidOperationException("No payment transaction found.");

        // Kiểm tra thực tế trên PayOS
        var (verifySuccess, actualStatus) = await _paymentService.VerifyPayOSPaymentAsync(payment.PayOSOrderCode);

        if (!verifySuccess || actualStatus != PaymentStatus.Success)
        {
            // Nếu webhook đã xử lý thành công trước đó thì db đã là Success
            if (payment.Status != PaymentStatus.Success)
                throw new InvalidOperationException("Transaction not successfully paid on PayOS. Please pay before confirming.");
        }

        // Cập nhật trạng thái Payment nếu nó chưa update
        if (payment.Status != PaymentStatus.Success)
        {
            payment.Status = PaymentStatus.Success;
            payment.UpdatedAt = DateTime.UtcNow;
        }

        // Load ParkingSlot + Floor để lấy BuildingId chính xác
        var reservationSlot = await _context.ParkingSlots
            .Include(s => s.Floor)
            .FirstOrDefaultAsync(s => s.Id == reservation.ParkingSlotId);
        var buildingId = reservationSlot?.Floor?.BuildingId;

        // Lấy danh sách Staff phụ trách
        var assignedStaffs = await _context.Users
            .Where(u => u.Role == ParkingSystem.Domain.Enums.Role.Admin
                     || u.Role == ParkingSystem.Domain.Enums.Role.Manager
                     || u.Role == ParkingSystem.Domain.Enums.Role.Staff)
            .Where(u => u.Role == ParkingSystem.Domain.Enums.Role.Admin // Admin nhận tất cả, không lọc theo tòa nhà
                     || !u.AssignedBuildingId.HasValue || !buildingId.HasValue || u.AssignedBuildingId == buildingId)
            .ToListAsync();

        bool isAutoApprove = assignedStaffs.Any(u => u.IsAutoApproveReservations);

        var slot = await _context.ParkingSlots.FindAsync(reservation.ParkingSlotId);
        if (slot != null && slot.Status == SlotStatus.TemporaryHeld)
        {
            slot.Status = SlotStatus.Reserved;
            slot.UpdatedAt = DateTime.UtcNow;
        }

        if (isAutoApprove)
        {
            reservation.Status = ReservationStatus.Confirmed;
            reservation.UpdatedAt = DateTime.UtcNow;
            LogState(reservation, "Confirmed", "Auto-Approve");
            await _context.SaveChangesAsync();

            if (slot != null)
            {
                await _realtimeService.SendSlotStatusUpdateAsync(slot.Id, slot.Status.ToString());
                await _realtimeService.SendDashboardUpdateAsync();
            }

            // Báo cho Driver
            await _notificationService.SendAsync(
                reservation.DriverId,
                "✅ Reservation Accepted",
                $"Reservation request {reservation.BookingCode} has been automatically accepted by the system.",
                "ReservationAccepted",
                reservation.Id);

            // Thông báo cho Admin/Manager/Staff biết có booking mới (đã tự duyệt)
            var staffsToNotify = assignedStaffs
                .Where(u => u.Role == ParkingSystem.Domain.Enums.Role.Admin // Admin luôn nhận
                         || u.Role == ParkingSystem.Domain.Enums.Role.Manager // Manager luôn nhận
                         || u.IsNotificationEnabled) // Staff chỉ nhận khi bật
                .ToList();
            foreach (var staff in staffsToNotify)
            {
                await _notificationService.SendAsync(
                    staff.Id,
                    "🔔 New Reservation (Auto-approved)",
                    $"Reservation {reservation.BookingCode} has been automatically approved.",
                    "NewReservation",
                    reservation.Id);
            }
        }
        else
        {
            reservation.Status = ReservationStatus.PendingReview;
            reservation.UpdatedAt = DateTime.UtcNow;
            LogState(reservation, "PaymentSuccess", "Payment successful. Waiting for Staff approval.");
            await _context.SaveChangesAsync();

            if (slot != null)
            {
                await _realtimeService.SendSlotStatusUpdateAsync(slot.Id, slot.Status.ToString());
                await _realtimeService.SendDashboardUpdateAsync();
            }

            // Báo cho Driver
            await _notificationService.SendAsync(
                reservation.DriverId,
                "💳 Payment Successful",
                $"Reservation {reservation.BookingCode} has been paid. Waiting for Staff approval.",
                "PaymentSuccess",
                reservation.Id);

            // Admin/Manager luôn nhận, Staff chỉ nhận khi bật IsNotificationEnabled
            var staffsToNotify = assignedStaffs
                .Where(u => u.Role == ParkingSystem.Domain.Enums.Role.Admin
                         || u.Role == ParkingSystem.Domain.Enums.Role.Manager
                         || u.IsNotificationEnabled)
                .ToList();
            foreach (var staff in staffsToNotify)
            {
                await _notificationService.SendAsync(
                    staff.Id,
                    "🔔 New Reservation",
                    $"A new reservation request ({reservation.BookingCode}) is pending approval.",
                    "NewReservation",
                    reservation.Id);
            }
        }

        return true;
    }

    // ===== THANH TOÁN THẤT BẠI → PaymentFailed =====
    public async Task<bool> FailPaymentAsync(Guid reservationId)
    {
        var reservation = await _context.Reservations.FindAsync(reservationId);
        if (reservation == null)
            throw new InvalidOperationException("Reservation information not found.");

        if (reservation.Status != ReservationStatus.PaymentPending)
            throw new InvalidOperationException("Reservation is not in pending payment status.");

        reservation.Status = ReservationStatus.PaymentFailed;
        reservation.UpdatedAt = DateTime.UtcNow;

        // Trả slot về Available
        var slot = await _context.ParkingSlots.FindAsync(reservation.ParkingSlotId);
        if (slot != null && slot.Status == SlotStatus.TemporaryHeld)
        {
            slot.Status = SlotStatus.Available;
            slot.UpdatedAt = DateTime.UtcNow;
        }

        LogState(reservation, "PaymentFailed", "Payment failed");
        await _context.SaveChangesAsync();

        if (slot != null)
        {
            await _realtimeService.SendSlotStatusUpdateAsync(slot.Id, slot.Status.ToString());
            await _realtimeService.SendDashboardUpdateAsync();
        }

        await _notificationService.SendAsync(
            reservation.DriverId,
            "❌ Payment Failed",
            $"Payment for reservation {reservation.BookingCode} failed. Please try again.",
            "PaymentFailed",
            reservation.Id);

        return true;
    }

    public async Task<IEnumerable<ReservationResponse>> GetMyReservationsAsync(Guid driverId)
    {
        var reservations = await _context.Reservations
            .Include(r => r.ParkingSlot)
            .ThenInclude(ps => ps.Floor)
            .ThenInclude(f => f.Building)
            .Where(r => r.DriverId == driverId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return reservations.Select(r => MapToResponse(r, r.ParkingSlot));
    }

    public async Task<bool> CancelReservationAsync(Guid reservationId, Guid driverId)
    {
        var reservation = await _context.Reservations.FirstOrDefaultAsync(
            r => r.Id == reservationId && r.DriverId == driverId);
        if (reservation == null)
            throw new InvalidOperationException("Reservation not found.");

        // Cho phép hủy khi: PaymentPending, PendingReview, Confirmed, PaymentFailed
        var cancellableStatuses = new[]
        {
            ReservationStatus.PaymentPending,
            ReservationStatus.PendingReview,
            ReservationStatus.Confirmed,
            ReservationStatus.PaymentFailed
        };
        if (!cancellableStatuses.Contains(reservation.Status))
            throw new InvalidOperationException("You can only cancel when the status is PaymentPending, PendingReview, or Confirmed.");

        // Rule: Nếu đã Confirmed, chỉ được hủy trước giờ bắt đầu ít nhất 1 tiếng
        if (reservation.Status == ReservationStatus.Confirmed)
        {
            var timeUntilStart = reservation.StartTime - DateTime.UtcNow;
            if (timeUntilStart.TotalHours < 1)
            {
                throw new InvalidOperationException("You can only cancel a confirmed reservation at least 1 hour before the start time.");
            }
        }

        // Trả slot về Available nếu nó đang bị giữ (Reserved hoặc TemporaryHeld)
        var slot = await _context.ParkingSlots.FindAsync(reservation.ParkingSlotId);
        if (slot != null && (slot.Status == SlotStatus.Reserved || slot.Status == SlotStatus.TemporaryHeld))
        {
            slot.Status = SlotStatus.Available;
            slot.UpdatedAt = DateTime.UtcNow;
        }

        // Nếu đã thanh toán (PendingReview hoặc Confirmed) → cần hoàn tiền
        var needsRefund = reservation.Status == ReservationStatus.PendingReview
                       || reservation.Status == ReservationStatus.Confirmed;

        reservation.Status = ReservationStatus.Cancelled;
        reservation.UpdatedAt = DateTime.UtcNow;

        if (needsRefund)
        {
            await InitiateRefundAsync(reservation.Id);
        }

        LogState(reservation, "Cancel", "User cancelled the reservation");
        await _context.SaveChangesAsync();

        if (slot != null)
        {
            await _realtimeService.SendSlotStatusUpdateAsync(slot.Id, slot.Status.ToString());
            await _realtimeService.SendDashboardUpdateAsync();
        }

        await _notificationService.SendAsync(
            reservation.DriverId,
            "🚫 Reservation Cancelled",
            $"Reservation {reservation.BookingCode} has been cancelled." +
            (needsRefund ? " The money will be refunded according to the policy." : ""),
            "ReservationCancelled",
            reservation.Id);

        return true;
    }

    // --- For Staff ---

    public async Task<IEnumerable<ReservationResponse>> GetPendingReservationsAsync(Guid staffId, Guid? buildingId = null)
    {
        var staff = await _context.Users.FindAsync(staffId);

        var query = _context.Reservations
            .Include(r => r.ParkingSlot)
            .ThenInclude(ps => ps.Floor)
            .ThenInclude(f => f.Building)
            .Where(r => r.Status == ReservationStatus.PendingReview);

        if (buildingId.HasValue)
        {
            query = query.Where(r => r.ParkingSlot.Floor != null && r.ParkingSlot.Floor.BuildingId == buildingId.Value);
        }
        else if (staff != null && staff.AssignedBuildingId.HasValue && staff.Role != ParkingSystem.Domain.Enums.Role.Admin && staff.Role != ParkingSystem.Domain.Enums.Role.Manager)
        {
            // Only strict filter for Staff role. Admins and Managers can see all if buildingId is not specified.
            var assignedBuildingId = staff.AssignedBuildingId.Value;
            query = query.Where(r => r.ParkingSlot.Floor != null && r.ParkingSlot.Floor.BuildingId == assignedBuildingId);
        }

        var reservations = await query
            .OrderBy(r => r.StartTime)
            .ToListAsync();

        return reservations.Select(r => MapToResponse(r, r.ParkingSlot));
    }

    public async Task<IEnumerable<ReservationResponse>> GetAllActiveReservationsAsync(Guid staffId, Guid? buildingId = null)
    {
        var staff = await _context.Users.FindAsync(staffId);

        var validStatuses = new List<ReservationStatus> { ReservationStatus.PendingReview, ReservationStatus.Confirmed, ReservationStatus.Paid, ReservationStatus.CheckedIn };
        var query = _context.Reservations
            .Include(r => r.ParkingSlot)
            .ThenInclude(ps => ps.Floor)
            .ThenInclude(f => f.Building)
            .Where(r => validStatuses.Contains(r.Status));

        if (buildingId.HasValue)
        {
            query = query.Where(r => r.ParkingSlot.Floor != null && r.ParkingSlot.Floor.BuildingId == buildingId.Value);
        }
        else if (staff != null && staff.AssignedBuildingId.HasValue && staff.Role != ParkingSystem.Domain.Enums.Role.Admin && staff.Role != ParkingSystem.Domain.Enums.Role.Manager)
        {
            var assignedBuildingId = staff.AssignedBuildingId.Value;
            query = query.Where(r => r.ParkingSlot.Floor != null && r.ParkingSlot.Floor.BuildingId == assignedBuildingId);
        }

        var reservations = await query
            .OrderBy(r => r.StartTime)
            .ToListAsync();

        return reservations.Select(r => MapToResponse(r, r.ParkingSlot));
    }

    public async Task<bool> ReviewReservationAsync(Guid reservationId, Guid staffId, ReviewReservationRequest request)
    {
        var reservation = await _context.Reservations.FirstOrDefaultAsync(r => r.Id == reservationId);
        if (reservation == null)
            throw new InvalidOperationException("Reservation information not found.");

        if (reservation.Status != ReservationStatus.PendingReview)
            throw new InvalidOperationException("Can only approve when status is PendingReview (paid).");

        reservation.ReviewedByStaffId = staffId;
        reservation.UpdatedAt = DateTime.UtcNow;

        var slot = await _context.ParkingSlots.FindAsync(reservation.ParkingSlotId);

        if (request.IsAccepted)
        {
            reservation.Status = ReservationStatus.Confirmed;

            // Đổi slot sang Reserved (chỉ đổi nếu booking sắp diễn ra)
            if (slot != null && reservation.StartTime <= DateTime.UtcNow.AddMinutes(30))
            {
                slot.Status = SlotStatus.Reserved;
                slot.UpdatedAt = DateTime.UtcNow;
            }

            await _notificationService.SendAsync(
                reservation.DriverId,
                "✅ Reservation Accepted",
                $"Yêu cầu đặt chỗ {slot?.SlotNumber ?? ""} ({reservation.BookingCode}) đã được chấp nhận. " +
                $"Vui lòng đến trước {reservation.StartTime:dd/MM/yyyy HH:mm}.",
                "ReservationApproved",
                reservation.Id);

            LogState(reservation, "Approve", "Staff approved reservation");
        }
        else
        {
            reservation.Status = ReservationStatus.Rejected;
            reservation.RejectReason = request.Reason ?? "Không có lý do.";

            // Hoàn tiền khi bị reject (vì đã thanh toán rồi)
            await InitiateRefundAsync(reservation.Id);

            // Revert slot status back to Available
            if (slot != null && slot.Status == SlotStatus.TemporaryHeld)
            {
                slot.Status = SlotStatus.Available;
                slot.UpdatedAt = DateTime.UtcNow;
            }

            await _notificationService.SendAsync(
                reservation.DriverId,
                "❌ Reservation Rejected",
                $"Reservation {reservation.BookingCode} was rejected. " +
                $"Reason: {reservation.RejectReason}. Please contact Admin for refund assistance.",
                "ReservationRejected",
                reservation.Id);

            LogState(reservation, "Reject", $"Staff rejected. Reason: {reservation.RejectReason}");
        }

        await _context.SaveChangesAsync();

        if (slot != null)
        {
            await _realtimeService.SendSlotStatusUpdateAsync(slot.Id, slot.Status.ToString());
            await _realtimeService.SendDashboardUpdateAsync();
        }

        return true;
    }

    // ===== HOÀN TIỀN: Đánh dấu Payment → Refunding =====
    private async Task InitiateRefundAsync(Guid reservationId)
    {
        var payment = await _context.Payments
            .FirstOrDefaultAsync(p => p.ReservationId == reservationId
                                   && p.Status == PaymentStatus.Success);

        if (payment != null)
        {
            payment.Status = PaymentStatus.Refunding;
            payment.UpdatedAt = DateTime.UtcNow;
            
            // Lưu trạng thái Refunding xuống DB và chờ Admin/Staff duyệt (gọi API /api/payments/{id}/refund)
            await _context.SaveChangesAsync();
        }
    }

    // ===== SINH MÃ BOOKING CODE: BK{yyyyMMdd}{seq} =====
    private async Task<string> GenerateBookingCodeAsync()
    {
        var today = DateTime.UtcNow.ToString("yyyyMMdd");
        var prefix = $"BK{today}";

        // Đếm số reservation hôm nay để tạo sequence
        var todayStart = DateTime.UtcNow.Date;
        var todayEnd = todayStart.AddDays(1);

        var count = await _context.Reservations
            .CountAsync(r => r.CreatedAt >= todayStart && r.CreatedAt < todayEnd);

        var sequence = (count + 1).ToString("D4"); // 0001, 0002, ...
        return $"{prefix}{sequence}";
    }

    // ===== HELPER: Ghi log trạng thái =====
    private void LogState(Reservation r, string action, string? note = null)
    {
        _context.ReservationLogs.Add(new ReservationLog
        {
            Id = Guid.NewGuid(),
            ReservationId = r.Id,
            Action = action,
            StatusSnapshot = r.Status,
            Note = note,
            CreatedAt = DateTime.UtcNow
        });
    }

    public async Task<bool> ReassignSlotAsync(Guid reservationId, Guid newSlotId, Guid staffId)
    {
        var reservation = await _context.Reservations.FirstOrDefaultAsync(r => r.Id == reservationId);
        if (reservation == null)
            throw new InvalidOperationException("Reservation information not found.");

        if (reservation.Status != ReservationStatus.Confirmed)
            throw new InvalidOperationException("Can only change slot for Confirmed bookings.");

        var newSlot = await _context.ParkingSlots.FindAsync(newSlotId);
        if (newSlot == null || newSlot.Status != SlotStatus.Available)
            throw new InvalidOperationException("New parking slot does not exist or is not available.");

        var oldSlotId = reservation.ParkingSlotId;

        // Cập nhật booking
        reservation.ParkingSlotId = newSlotId;
        reservation.UpdatedAt = DateTime.UtcNow;
        LogState(reservation, "Reassigned", $"Staff {staffId} changed slot from {oldSlotId} to {newSlotId}");

        // Cập nhật trạng thái vật lý của ô mới/cũ nếu booking sắp diễn ra
        if (reservation.StartTime <= DateTime.UtcNow.AddMinutes(30))
        {
            newSlot.Status = SlotStatus.Reserved;
            newSlot.UpdatedAt = DateTime.UtcNow;

            var oldSlot = await _context.ParkingSlots.FindAsync(oldSlotId);
            if (oldSlot != null && (oldSlot.Status == SlotStatus.Reserved || oldSlot.Status == SlotStatus.TemporaryHeld))
            {
                oldSlot.Status = SlotStatus.Available;
                oldSlot.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync();

        // Gửi Notification cho Driver
        await _notificationService.SendAsync(
            reservation.DriverId,
            "🔄 Parking Slot Changed",
            $"Due to an operational issue, your parking slot has been reassigned to {newSlot.SlotNumber}. We apologize for the inconvenience.",
            "ReservationReassigned",
            reservation.Id
        );

        return true;
    }

    // ===== HELPER: Map entity → response =====
    private ReservationResponse MapToResponse(
        Reservation r,
        ParkingSlot? slot,
        string? checkoutUrl = null,
        decimal? bookingFee = null,
        long? payOSOrderCode = null) => new()
        {
            Id = r.Id,
            DriverId = r.DriverId,
            ParkingSlotId = r.ParkingSlotId,
            SlotNumber = slot?.SlotNumber ?? "",
            FloorName = slot?.Floor?.Name ?? "",
            BuildingName = slot?.Floor?.Building?.Name ?? "",
            BookingCode = r.BookingCode,
            QrCodeBase64 = _qrCodeService.GenerateQrCodeBase64(r.BookingCode),
            LicensePlate = r.LicensePlate,
            StartTime = r.StartTime,
            EndTime = r.EndTime,
            Status = r.Status,
            BookingMethod = r.BookingMethod,
            AIScore = r.AIScore,
            AIReason = r.AIReason,
            RejectReason = r.RejectReason,
            CreatedAt = r.CreatedAt,
            PayOSCheckoutUrl = checkoutUrl,
            BookingFee = bookingFee,
            PayOSOrderCode = payOSOrderCode
        };

    public async Task<decimal> EstimateFeeAsync(Guid vehicleTypeId, DateTime startTime, DateTime endTime)
    {
        var pricingPolicy = await _context.PricingPolicies.FirstOrDefaultAsync(p => p.VehicleTypeId == vehicleTypeId);
        if (pricingPolicy == null) return 0;

        decimal fee = 0;
        var duration = endTime - startTime;
        if (duration.TotalMinutes > 0)
        {
            var currentMilli = startTime;
            var blockTimeSpan = TimeSpan.FromHours(pricingPolicy.BlockDurationHours > 0 ? pricingPolicy.BlockDurationHours : 4);

            while (currentMilli < endTime)
            {
                var currentVnTime = TimeZoneInfo.ConvertTimeFromUtc(currentMilli, TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time"));
                var currentHour = currentVnTime.Hour;

                bool isNight = currentHour >= pricingPolicy.NightStartHour || currentHour < pricingPolicy.NightEndHour;

                if (isNight) fee += pricingPolicy.NightBlockRate;
                else fee += pricingPolicy.DayBlockRate;

                currentMilli = currentMilli.Add(blockTimeSpan);
            }

            int durationDays = (int)Math.Floor(duration.TotalHours / 24.0);
            if (pricingPolicy.DailyRate > 0)
            {
                if (durationDays > 0)
                {
                    decimal capFee = (durationDays + 1) * pricingPolicy.DailyRate;
                    if (fee > capFee) fee = capFee;
                }
                else if (fee > pricingPolicy.DailyRate)
                {
                    fee = pricingPolicy.DailyRate;
                }
            }
        }
        return fee;
    }
}
