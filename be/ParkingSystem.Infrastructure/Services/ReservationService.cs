using Microsoft.EntityFrameworkCore;
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

    public ReservationService(
        ApplicationDbContext context,
        IQrCodeService qrCodeService,
        INotificationService notificationService,
        ISlotAssignmentService slotAssignmentService)
    {
        _context = context;
        _qrCodeService = qrCodeService;
        _notificationService = notificationService;
        _slotAssignmentService = slotAssignmentService;
    }

    public async Task<ReservationResponse> CreateReservationAsync(Guid driverId, CreateReservationRequest request)
    {
        // 1. Validate thời gian
        if (request.StartTime <= DateTime.UtcNow)
            throw new InvalidOperationException("Thời gian bắt đầu phải lớn hơn thời điểm hiện tại.");

        if (request.EndTime <= request.StartTime)
            throw new InvalidOperationException("Thời gian kết thúc phải lớn hơn thời gian bắt đầu.");

        // 2. Lấy thông tin xe từ bảng Vehicles
        var vehicle = await _context.Vehicles
            .Include(v => v.VehicleType)
            .FirstOrDefaultAsync(v => v.Id == request.VehicleId && v.DriverId == driverId);

        if (vehicle == null)
            throw new InvalidOperationException("Xe không tồn tại hoặc không thuộc về bạn.");

        var licensePlate = vehicle.PlateNumber;
        var vehicleTypeId = vehicle.VehicleTypeId;

        // 3. Kiểm tra xe đã có booking nào trùng giờ chưa
        var activeStatuses = new[]
        {
            ReservationStatus.PaymentPending,
            ReservationStatus.Paid,
            ReservationStatus.PendingReview,
            ReservationStatus.Confirmed,
            ReservationStatus.CheckedIn
        };

        // --- ANTI-SPAM BOOKING: 1 Driver <= 3 Active Reservations ---
        var activeReservationCount = await _context.Reservations
            .CountAsync(r => r.DriverId == driverId && activeStatuses.Contains(r.Status));
        if (activeReservationCount >= 3)
            throw new InvalidOperationException("Bạn đã đạt giới hạn tối đa 3 đặt chỗ đang hoạt động. Vui lòng hoàn thành hoặc hủy bớt trước khi tạo mới.");

        var hasExistingBooking = await _context.Reservations
            .AnyAsync(r => r.LicensePlate == licensePlate
                        && activeStatuses.Contains(r.Status)
                        && r.StartTime < request.EndTime
                        && r.EndTime > request.StartTime);
        if (hasExistingBooking)
            throw new InvalidOperationException($"Biển số {licensePlate} đã có lịch đặt chỗ trong khoảng thời gian này.");

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
                        throw new InvalidOperationException($"Không tìm thấy ô trống phù hợp{scope}.");
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
                    throw new InvalidOperationException("Vui lòng chọn ô đỗ xe (ParkingSlotId) khi đặt chỗ thủ công.");
                targetSlotId = request.ParkingSlotId.Value;
            }

            // Lock Row: FOR UPDATE (PostgreSQL)
            var slot = await _context.ParkingSlots
                .FromSqlRaw("SELECT * FROM \"ParkingSlots\" WHERE \"Id\" = {0} FOR UPDATE", targetSlotId)
                .FirstOrDefaultAsync();

            if (slot == null)
                throw new InvalidOperationException("Ô đỗ xe không tồn tại.");

            // 5. Validate slot (Race Condition Check)
            if (slot.Status != SlotStatus.Available)
            {
                string suggestMsg = "";
                if (request.BookingMethod == BookingMethod.Manual)
                {
                    // AI tự tìm slot khác gợi ý ngay khi bị trùng
                    var suggest = await _slotAssignmentService.GetBestSlotAsync(vehicleTypeId, request.BuildingId);
                    if (suggest != null) 
                        suggestMsg = $" 💡 Gợi ý (AI Suggest): Bạn có thể đổi sang ô {suggest.SlotNumber} (Tầng {suggest.FloorName}).";
                }
                throw new InvalidOperationException($"Ô đỗ {slot.SlotNumber} vừa có người khác chọn hoặc không khả dụng.{suggestMsg}");
            }

            if (slot.VehicleTypeId != vehicleTypeId)
            {
                var slotVehicleType = await _context.VehicleTypes.FindAsync(slot.VehicleTypeId);
                throw new InvalidOperationException(
                    $"Ô đỗ {slot.SlotNumber} chỉ dành cho {slotVehicleType?.Name ?? "loại xe khác"}, " +
                    $"không hỗ trợ {vehicle.VehicleType?.Name ?? "loại xe bạn chọn"}.");
            }

            // 6. Kiểm tra khung giờ trùng (Double Check)
            var hasOverlapping = await _context.Reservations
                .AnyAsync(r => r.ParkingSlotId == slot.Id
                            && activeStatuses.Contains(r.Status)
                            && r.StartTime < request.EndTime
                            && r.EndTime > request.StartTime);
            if (hasOverlapping)
                throw new InvalidOperationException("Vị trí này đã được đặt trong khoảng thời gian bạn chọn.");

            // 7. Sinh mã Booking Code
            var bookingCode = await GenerateBookingCodeAsync();

            // Cập nhật trạng thái Slot -> TemporaryHeld
            slot.Status = SlotStatus.TemporaryHeld;
            slot.UpdatedAt = DateTime.UtcNow;

            // 8. Tạo Reservation — trạng thái PaymentPending
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
                Status = ReservationStatus.PaymentPending, // Chờ thanh toán trước
                AIScore = aiScore,
                AIReason = aiReason
            };

            _context.Reservations.Add(reservation);
            LogState(reservation, "Create", "Người dùng tạo đặt chỗ (Slot -> TemporaryHeld)");
            
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return MapToResponse(reservation, slot);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // ===== THANH TOÁN THÀNH CÔNG → Chuyển sang PendingReview =====
    public async Task<bool> ConfirmPaymentAsync(Guid reservationId)
    {
        var reservation = await _context.Reservations.FindAsync(reservationId);
        if (reservation == null)
            throw new InvalidOperationException("Không tìm thấy thông tin đặt chỗ.");

        if (reservation.Status != ReservationStatus.PaymentPending)
            throw new InvalidOperationException("Reservation không ở trạng thái chờ thanh toán.");

        reservation.Status = ReservationStatus.PendingReview;
        reservation.UpdatedAt = DateTime.UtcNow;

        LogState(reservation, "PaymentSuccess", "Thanh toán thành công");
        await _context.SaveChangesAsync();

        // Gửi thông báo cho Driver
        await _notificationService.SendAsync(
            reservation.DriverId,
            "💳 Thanh toán thành công",
            $"Đặt chỗ {reservation.BookingCode} đã được thanh toán. Đang chờ Staff duyệt.",
            "PaymentSuccess",
            reservation.Id);

        return true;
    }

    // ===== THANH TOÁN THẤT BẠI → PaymentFailed =====
    public async Task<bool> FailPaymentAsync(Guid reservationId)
    {
        var reservation = await _context.Reservations.FindAsync(reservationId);
        if (reservation == null)
            throw new InvalidOperationException("Không tìm thấy thông tin đặt chỗ.");

        if (reservation.Status != ReservationStatus.PaymentPending)
            throw new InvalidOperationException("Reservation không ở trạng thái chờ thanh toán.");

        reservation.Status = ReservationStatus.PaymentFailed;
        reservation.UpdatedAt = DateTime.UtcNow;

        LogState(reservation, "PaymentFailed", "Thanh toán thất bại");
        await _context.SaveChangesAsync();

        await _notificationService.SendAsync(
            reservation.DriverId,
            "❌ Thanh toán thất bại",
            $"Thanh toán cho đặt chỗ {reservation.BookingCode} không thành công. Vui lòng thử lại.",
            "PaymentFailed",
            reservation.Id);

        return true;
    }

    public async Task<IEnumerable<ReservationResponse>> GetMyReservationsAsync(Guid driverId)
    {
        var reservations = await _context.Reservations
            .Include(r => r.ParkingSlot)
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
            throw new InvalidOperationException("Không tìm thấy thông tin đặt chỗ.");

        // Cho phép hủy khi: PaymentPending, PendingReview, Confirmed
        var cancellableStatuses = new[]
        {
            ReservationStatus.PaymentPending,
            ReservationStatus.PendingReview,
            ReservationStatus.Confirmed
        };
        if (!cancellableStatuses.Contains(reservation.Status))
            throw new InvalidOperationException("Chỉ có thể hủy khi trạng thái là PaymentPending, PendingReview hoặc Confirmed.");

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

        LogState(reservation, "Cancel", "Người dùng hủy đặt chỗ");
        await _context.SaveChangesAsync();

        await _notificationService.SendAsync(
            reservation.DriverId,
            "🚫 Đặt chỗ đã bị hủy",
            $"Đặt chỗ {reservation.BookingCode} đã được hủy." +
            (needsRefund ? " Tiền sẽ được hoàn lại theo chính sách." : ""),
            "ReservationCancelled",
            reservation.Id);

        return true;
    }

    // --- For Staff ---

    public async Task<IEnumerable<ReservationResponse>> GetPendingReservationsAsync()
    {
        var reservations = await _context.Reservations
            .Include(r => r.ParkingSlot)
            .Where(r => r.Status == ReservationStatus.PendingReview) // Chỉ hiện những cái đã thanh toán
            .OrderBy(r => r.StartTime)
            .ToListAsync();

        return reservations.Select(r => MapToResponse(r, r.ParkingSlot));
    }

    public async Task<bool> ReviewReservationAsync(Guid reservationId, Guid staffId, ReviewReservationRequest request)
    {
        var reservation = await _context.Reservations.FirstOrDefaultAsync(r => r.Id == reservationId);
        if (reservation == null)
            throw new InvalidOperationException("Không tìm thấy thông tin đặt chỗ.");

        if (reservation.Status != ReservationStatus.PendingReview)
            throw new InvalidOperationException("Chỉ có thể duyệt khi trạng thái là PendingReview (đã thanh toán).");

        reservation.ReviewedByStaffId = staffId;
        reservation.UpdatedAt = DateTime.UtcNow;

        var slot = await _context.ParkingSlots.FindAsync(reservation.ParkingSlotId);

        if (request.IsAccepted)
        {
            reservation.Status = ReservationStatus.Confirmed;

            // Đổi slot sang Reserved
            if (slot != null)
            {
                slot.Status = SlotStatus.Reserved;
                slot.UpdatedAt = DateTime.UtcNow;
            }

            await _notificationService.SendAsync(
                reservation.DriverId,
                "✅ Đặt chỗ được chấp nhận",
                $"Yêu cầu đặt chỗ {slot?.SlotNumber ?? ""} ({reservation.BookingCode}) đã được chấp nhận. " +
                $"Vui lòng đến trước {reservation.StartTime:dd/MM/yyyy HH:mm}.",
                "ReservationApproved",
                reservation.Id);
                
            LogState(reservation, "Approve", "Staff đã duyệt đặt chỗ");
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
                "❌ Đặt chỗ bị từ chối",
                $"Đặt chỗ {reservation.BookingCode} bị từ chối. " +
                $"Lý do: {reservation.RejectReason}. Tiền sẽ được hoàn lại.",
                "ReservationRejected",
                reservation.Id);
                
            LogState(reservation, "Reject", $"Staff từ chối. Lý do: {reservation.RejectReason}");
        }

        await _context.SaveChangesAsync();
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
            // TODO: Gọi API PayOS/Momo để hoàn tiền thực tế
            // Sau khi hoàn xong → cập nhật payment.Status = PaymentStatus.Refunded
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

    // ===== HELPER: Map entity → response =====
    private ReservationResponse MapToResponse(Reservation r, ParkingSlot? slot) => new()
    {
        Id = r.Id,
        DriverId = r.DriverId,
        ParkingSlotId = r.ParkingSlotId,
        SlotNumber = slot?.SlotNumber ?? "",
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
        CreatedAt = r.CreatedAt
    };
}
