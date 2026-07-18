using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ParkingSystem.Application.DTOs.CheckOut;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Application.Interfaces.Lpr;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

public class CheckOutService : ICheckOutService
{
    private readonly ApplicationDbContext _context;
    private readonly ILicensePlateRecognizer _lprService;
    private readonly IPaymentService _paymentService;
    private readonly ILogger<CheckOutService> _logger;
    private readonly IRealtimeService _realtimeService;
    private readonly INotificationService _notificationService;
    private readonly IAuditLogService _auditLogService;

    public CheckOutService(
        ApplicationDbContext context,
        ILicensePlateRecognizer lprService,
        IPaymentService paymentService,
        ILogger<CheckOutService> logger,
        IRealtimeService realtimeService,
        INotificationService notificationService,
        IAuditLogService auditLogService)
    {
        _context = context;
        _lprService = lprService;
        _paymentService = paymentService;
        _logger = logger;
        _realtimeService = realtimeService;
        _notificationService = notificationService;
        _auditLogService = auditLogService;
    }

    public async Task<CheckOutSearchResult> SearchByQrCodeAndPlateAsync(string? qrCode, string licensePlate, Guid? staffId = null, Guid? requestBuildingId = null)
    {
        if (string.IsNullOrWhiteSpace(qrCode) && string.IsNullOrWhiteSpace(licensePlate))
        {
            throw new InvalidOperationException("Please scan the QR code or enter the license plate.");
        }

        var cleanedInput = CleanLicensePlate(licensePlate);

        var activeSessions = await _context.ParkingSessions
            .Include(s => s.ParkingSlot)
                .ThenInclude(ps => ps.Floor)
            .Include(s => s.VehicleType)
            .Include(s => s.Reservation)
            .Include(s => s.Driver)
            .Where(s => s.Status == SessionStatus.Active)
            .ToListAsync();

        ParkingSession? session = null;

        if (!string.IsNullOrWhiteSpace(qrCode))
        {
            session = activeSessions.FirstOrDefault(s => 
                (!string.IsNullOrEmpty(s.SessionCode) && s.SessionCode.Equals(qrCode, StringComparison.OrdinalIgnoreCase)) ||
                s.Id.ToString().Equals(qrCode, StringComparison.OrdinalIgnoreCase)
            );
        }
        else if (!string.IsNullOrWhiteSpace(licensePlate))
        {
            session = activeSessions.FirstOrDefault(s => CleanLicensePlate(s.LicensePlate) == cleanedInput);
        }

        if (session == null)
        {
            throw new InvalidOperationException("Invalid card or parking session does not exist.");
        }

        bool isMismatch = false;
        if (CleanLicensePlate(session.LicensePlate) != cleanedInput)
        {
            isMismatch = true;
        }

        Guid? effectiveBuildingId = requestBuildingId;
        if (staffId.HasValue)
        {
            var staff = await _context.Users.FindAsync(staffId.Value);
            if (staff != null && staff.AssignedBuildingId.HasValue)
            {
                if (requestBuildingId.HasValue && requestBuildingId.Value != staff.AssignedBuildingId.Value)
                {
                    throw new InvalidOperationException("You do not have permission to check out vehicles for a building other than your assigned one.");
                }
                effectiveBuildingId = staff.AssignedBuildingId;
            }
        }

        if (!effectiveBuildingId.HasValue)
        {
            throw new InvalidOperationException("Please select a building to perform this action (Admin/Manager).");
        }

        if (session.ParkingSlot.Floor!.BuildingId != effectiveBuildingId.Value)
        {
            throw new InvalidOperationException("Cannot check out a vehicle that does not belong to your assigned or selected building.");
        }

        var exitTime = DateTime.UtcNow;
        var priceResult = await CalculateFeeAsync(session.VehicleTypeId, session.EntryTime, exitTime, pricingPolicyId: session.PricingPolicyId);

        // Áp dụng Miễn phí nếu có Vé tháng
        await ApplySubscriptionDiscountAsync(session, exitTime, priceResult);

        if (session.ReservationId != null && session.Reservation != null)
        {
            if (exitTime <= session.Reservation.EndTime)
            {
                priceResult.TotalFee = 0;
                priceResult.FeeBreakdown = null;
            }
            else
            {
                var overdueResult = await CalculateFeeAsync(session.VehicleTypeId, session.Reservation.EndTime, exitTime, isOverdue: true, pricingPolicyId: session.Reservation.PricingPolicyId ?? session.PricingPolicyId);
                priceResult.TotalFee = overdueResult.TotalFee;
                priceResult.FeeBreakdown = overdueResult.FeeBreakdown;
            }
        }

        var amountDue = priceResult.TotalFee + session.PenaltyFee - session.PrePaidAmount;
        if (session.GracePeriodEndTime.HasValue && exitTime <= session.GracePeriodEndTime.Value)
        {
            amountDue = 0;
        }
        else if (amountDue < 0)
        {
            amountDue = 0;
        }

        bool isAutoPayEligible = false;
        if (amountDue > 0 && session.Driver != null && session.Driver.AutoPayEnabled && session.Driver.Balance >= amountDue)
        {
            isAutoPayEligible = true;
        }

        return new CheckOutSearchResult
        {
            SessionId = session.Id,
            LicensePlate = session.LicensePlate,
            SlotNumber = session.ParkingSlot.SlotNumber,
            FloorName = session.ParkingSlot.Floor?.Name ?? string.Empty,
            EntryTime = session.EntryTime,
            EstimatedExitTime = exitTime,
            TotalHours = priceResult.TotalHours,
            VehicleTypeName = session.VehicleType.Name,
            HourlyRate = priceResult.HourlyRate,
            EstimatedFee = priceResult.TotalFee + session.PenaltyFee,
            PricingModel = priceResult.PricingModel,
            DayPassPrice = priceResult.DayPassPrice,
            NightPassPrice = priceResult.NightPassPrice,
            DailyMaxPrice = priceResult.DailyMaxPrice,
            FeeBreakdown = priceResult.FeeBreakdown,
            Message = BuildMessage(session, priceResult),
            IsPlateMismatch = isMismatch,
            EntryImageUrl = session.EntryImageUrl,
            PenaltyFee = session.PenaltyFee,
            PrePaidAmount = session.PrePaidAmount,
            AmountDue = amountDue,
            AutoPaidSuccess = isAutoPayEligible // Use this field as flag for UI to trigger AutoPay
        };
    }

    public async Task<CheckOutConfirmResponse> ConfirmCheckOutAsync(CheckOutConfirmRequest request)
    {
        var session = await _context.ParkingSessions
            .Include(s => s.Driver)
            .Include(s => s.ParkingSlot)
                .ThenInclude(ps => ps.Floor)
            .Include(s => s.VehicleType)
            .Include(s => s.Reservation)
            .FirstOrDefaultAsync(s => s.Id == request.SessionId && s.Status == SessionStatus.Active);

        if (session == null)
        {
            throw new InvalidOperationException("Parking session not found or already paid.");
        }

        Guid? effectiveBuildingId = request.BuildingId;
        if (request.StaffId != Guid.Empty)
        {
            var staff = await _context.Users.FindAsync(request.StaffId);
            if (staff != null && staff.AssignedBuildingId.HasValue)
            {
                if (request.BuildingId.HasValue && request.BuildingId.Value != staff.AssignedBuildingId.Value)
                {
                    throw new InvalidOperationException("You do not have permission to confirm checkout for a building other than your assigned one.");
                }
                effectiveBuildingId = staff.AssignedBuildingId;
            }
        }

        if (!effectiveBuildingId.HasValue)
        {
            throw new InvalidOperationException("Please select a building to perform this action (Admin/Manager).");
        }

        if (session.ParkingSlot.Floor!.BuildingId != effectiveBuildingId.Value)
        {
            throw new InvalidOperationException("Cannot confirm checkout for a vehicle that does not belong to your assigned or selected building.");
        }

        var exitTime = DateTime.UtcNow;
        var priceResult = await CalculateFeeAsync(session.VehicleTypeId, session.EntryTime, exitTime, pricingPolicyId: session.PricingPolicyId);

        // Áp dụng Miễn phí nếu có Vé tháng
        await ApplySubscriptionDiscountAsync(session, exitTime, priceResult);

        if (session.ReservationId != null && session.Reservation != null)
        {
            if (exitTime <= session.Reservation.EndTime)
            {
                priceResult.TotalFee = 0;
                priceResult.FeeBreakdown = null;
            }
            else
            {
                var overdueResult = await CalculateFeeAsync(session.VehicleTypeId, session.Reservation.EndTime, exitTime, isOverdue: true, pricingPolicyId: session.Reservation.PricingPolicyId ?? session.PricingPolicyId);
                priceResult.TotalFee = overdueResult.TotalFee;
                priceResult.FeeBreakdown = overdueResult.FeeBreakdown;
            }
        }

        // Cộng thêm tiền phạt (nếu có)
        priceResult.TotalFee += session.PenaltyFee;

        var amountDue = priceResult.TotalFee - session.PrePaidAmount;
        if (session.GracePeriodEndTime.HasValue && exitTime <= session.GracePeriodEndTime.Value)
        {
            amountDue = 0;
        }
        else if (amountDue < 0)
        {
            amountDue = 0;
        }

        bool isAutoPaid = false;
        if (amountDue > 0 && session.Driver != null && session.Driver.AutoPayEnabled)
        {
            if (session.Driver.Balance >= amountDue)
            {
                session.Driver.Balance -= amountDue;
                
                var walletTx = new ParkingSystem.Domain.Entities.WalletTransaction
                {
                    Id = Guid.NewGuid(),
                    UserId = session.DriverId.Value,
                    Amount = -amountDue,
                    Type = "AutoPay",
                    Status = "Success",
                    Description = $"Tự động thanh toán phí đỗ xe (Session: {session.SessionCode})",
                    ReferenceId = session.Id.ToString(),
                    CreatedAt = exitTime
                };
                _context.WalletTransactions.Add(walletTx);

                var autoPayment = new ParkingSystem.Domain.Entities.Payment
                {
                    Id = Guid.NewGuid(),
                    PayOSOrderCode = long.Parse($"{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}{Random.Shared.Next(1000, 9999)}"),
                    ParkingSessionId = session.Id,
                    UserId = session.DriverId,
                    Amount = amountDue,
                    PaymentMethod = PaymentMethod.Wallet,
                    Status = PaymentStatus.Success,
                    CreatedAt = exitTime,
                    UpdatedAt = exitTime
                };
                _context.Payments.Add(autoPayment);

                amountDue = 0;
                isAutoPaid = true;
                request.PaymentMethod = PaymentMethod.Wallet;

                if (_notificationService != null)
                {
                    await _notificationService.SendAsync(
                        session.DriverId.Value,
                        "🚗 Tự động thanh toán qua cổng",
                        $"Hệ thống đã tự động trừ {autoPayment.Amount:N0} VND từ Ví của bạn để thanh toán phí đỗ xe.",
                        "AutoPaySuccess",
                        session.Id);
                }
            }
        }

        // Nếu nhân viên bảo vệ đã dùng quyền Duyệt Ngoại Lệ (do sai biển số)
        if (request.IsManualVerified)
        {
            session.IssueType = IssueType.WrongPlate;
            session.StaffId = request.StaffId;

            await _auditLogService.LogAsync(
                userId: request.StaffId,
                actionType: "ManualPlateOverride",
                entityName: "ParkingSession",
                entityId: session.Id,
                oldValues: new { OriginalPlate = session.LicensePlate },
                newValues: new { ExitOcrPlate = request.ExitLicensePlateOcr },
                reason: "Nhân viên xác nhận khớp biển số bằng mắt thường do OCR không nhận diện chính xác"
            );
        }

        // Neu la PayOS, kiem tra payment da duoc xu ly chua
        if (request.PaymentMethod == PaymentMethod.PayOS)
        {
            var existingPayment = await _context.Payments
                .Where(p => p.ParkingSessionId == session.Id && p.PaymentMethod == PaymentMethod.PayOS)
                .OrderByDescending(p => p.CreatedAt)
                .FirstOrDefaultAsync();

            if (existingPayment == null)
            {
                throw new InvalidOperationException("PayOS payment not created. Please create a payment QR first.");
            }

            if (existingPayment.Status == PaymentStatus.Pending)
            {
                // Thu verify truc tiep voi PayOS API de biet thanh toan that su chua
                var (verified, payosStatus) = await _paymentService.VerifyPayOSPaymentAsync(existingPayment.PayOSOrderCode);
                if (verified)
                {
                    existingPayment.Status = payosStatus;
                    existingPayment.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    _logger.LogInformation(
                        "PayOS payment verified on confirm. OrderCode={OrderCode}, Status={Status}",
                        existingPayment.PayOSOrderCode, payosStatus);

                    if (payosStatus != PaymentStatus.Success)
                    {
                        throw new InvalidOperationException("PayOS payment incomplete. Please complete the QR payment first.");
                    }
                }
                else
                {
                    throw new InvalidOperationException("PayOS payment incomplete. Please complete the QR payment first.");
                }
            }

            if (existingPayment.Status == PaymentStatus.Failed)
            {
                throw new InvalidOperationException("PayOS payment failed. Please generate a new QR and try again.");
            }

            // PayOS da thanh toan -> chi cap nhat session, khong tao payment moi
            session.ExitTime = exitTime;
            session.TotalFee = priceResult.TotalFee;
            session.Status = SessionStatus.Completed;
            session.UpdatedAt = exitTime;

            var psSlot = session.ParkingSlot;
            psSlot.Status = SlotStatus.Available;
            psSlot.UpdatedAt = exitTime;
            _context.Entry(psSlot).State = EntityState.Modified;

            if (session.Reservation != null)
            {
                session.Reservation.Status = ReservationStatus.Completed;
                session.Reservation.UpdatedAt = exitTime;
                
                _context.ReservationLogs.Add(new ReservationLog
                {
                    Id = Guid.NewGuid(),
                    ReservationId = session.Reservation.Id,
                    Action = "CheckOut",
                    StatusSnapshot = ReservationStatus.Completed,
                    Note = "Tài xế đã hoàn thành chuyến đi và rời bãi",
                    CreatedAt = exitTime
                });
            }

            await _context.SaveChangesAsync();

            await _realtimeService.SendSlotStatusUpdateAsync(psSlot.Id, psSlot.Status.ToString());
            await _realtimeService.SendDashboardUpdateAsync();
            if (session.DriverId.HasValue)
            {
                await _realtimeService.SendCheckoutSuccessAsync(session.DriverId.Value, session.Id);
            }

            return new CheckOutConfirmResponse
            {
                SessionId = session.Id,
                LicensePlate = session.LicensePlate,
                SlotNumber = psSlot.SlotNumber,
                FloorName = psSlot.Floor?.Name ?? string.Empty,
                EntryTime = session.EntryTime,
                ExitTime = exitTime,
                TotalHours = priceResult.TotalHours,
                HourlyRate = priceResult.HourlyRate,
                TotalFee = priceResult.TotalFee,
                PricingModel = priceResult.PricingModel,
                DayPassPrice = priceResult.DayPassPrice,
                NightPassPrice = priceResult.NightPassPrice,
                DailyMaxPrice = priceResult.DailyMaxPrice,
                FeeBreakdown = priceResult.FeeBreakdown,
                PaymentAmount = null,
                ChangeAmount = null,
                PaymentMethod = PaymentMethod.PayOS,
                PaymentId = existingPayment.Id,
                Message = BuildMessage(session, priceResult, isConfirm: true),
                PrePaidAmount = session.PrePaidAmount,
                AmountDue = 0,
                AutoPaidSuccess = false
            };
        }

        // Cash / other methods
        if (request.PaymentMethod == PaymentMethod.Cash && request.PaymentAmount.HasValue)
        {
            if (request.PaymentAmount.Value < priceResult.TotalFee)
            {
                throw new InvalidOperationException(
                    $"Amount provided ({request.PaymentAmount.Value:N0} VND) is less than the parking fee ({priceResult.TotalFee:N0} VND).");
            }
        }

        Payment? payment = null;
        if (!isAutoPaid)
        {
            payment = new Payment
            {
                Id = Guid.NewGuid(),
                PayOSOrderCode = GeneratePayOSOrderCode(),
                ParkingSessionId = session.Id,
                Amount = amountDue, // Save the actual amount due, not TotalFee (since some might be prepaid)
                Description = $"Thanh toan phi gui xe cho bien so {session.LicensePlate}",
                PaymentDate = exitTime,
                PaymentMethod = request.PaymentMethod,
                Status = PaymentStatus.Success,
                CreatedAt = exitTime
            };
            _context.Payments.Add(payment);
        }

        session.ExitTime = exitTime;
        session.TotalFee = priceResult.TotalFee;
        session.Status = SessionStatus.Completed;
        session.UpdatedAt = exitTime;

        var slot = session.ParkingSlot;
        slot.Status = SlotStatus.Available;
        slot.UpdatedAt = exitTime;
        _context.Entry(slot).State = EntityState.Modified;

        if (session.Reservation != null)
        {
            session.Reservation.Status = ReservationStatus.Completed;
            session.Reservation.UpdatedAt = exitTime;
            
            _context.ReservationLogs.Add(new ReservationLog
            {
                Id = Guid.NewGuid(),
                ReservationId = session.Reservation.Id,
                Action = "CheckOut",
                StatusSnapshot = ReservationStatus.Completed,
                Note = "Tài xế đã hoàn thành chuyến đi và rời bãi",
                CreatedAt = exitTime
            });
        }

        await _context.SaveChangesAsync();

        await _realtimeService.SendSlotStatusUpdateAsync(slot.Id, slot.Status.ToString());
        await _realtimeService.SendDashboardUpdateAsync();
        if (session.DriverId.HasValue)
        {
            await _realtimeService.SendCheckoutSuccessAsync(session.DriverId.Value, session.Id);
        }

        decimal? changeAmount = null;
        if (request.PaymentMethod == PaymentMethod.Cash && request.PaymentAmount.HasValue)
        {
            changeAmount = request.PaymentAmount.Value - priceResult.TotalFee;
        }

        return new CheckOutConfirmResponse
        {
            SessionId = session.Id,
            LicensePlate = session.LicensePlate,
            SlotNumber = slot.SlotNumber,
            FloorName = slot.Floor?.Name ?? string.Empty,
            EntryTime = session.EntryTime,
            ExitTime = exitTime,
            TotalHours = priceResult.TotalHours,
            HourlyRate = priceResult.HourlyRate,
            TotalFee = priceResult.TotalFee,
            PricingModel = priceResult.PricingModel,
            DayPassPrice = priceResult.DayPassPrice,
            NightPassPrice = priceResult.NightPassPrice,
            DailyMaxPrice = priceResult.DailyMaxPrice,
            FeeBreakdown = priceResult.FeeBreakdown,
            PaymentAmount = request.PaymentAmount,
            ChangeAmount = changeAmount,
            PaymentMethod = request.PaymentMethod,
            PaymentId = payment?.Id ?? Guid.Empty,
            Message = BuildMessage(session, priceResult, isConfirm: true),
            PrePaidAmount = session.PrePaidAmount,
            AmountDue = amountDue,
            AutoPaidSuccess = isAutoPaid
        };
    }

    public async Task<OcrCheckOutResult> ProcessOcrCheckOutAsync(OcrCheckOutRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.QrCode) && string.IsNullOrWhiteSpace(request.ImageBase64))
        {
            throw new InvalidOperationException("Please scan the card QR or provide an image.");
        }

        var ocrResult = await _lprService.RecognizeFrameAsync(request.ImageBase64);

        if (!ocrResult.IsDetected || string.IsNullOrWhiteSpace(ocrResult.LicensePlate))
        {
            throw new InvalidOperationException("Cannot recognize the license plate. Please take a clearer picture and try again.");
        }

        var exitPlate = ocrResult.LicensePlate.Trim();
        var normalizedExitPlate = CleanLicensePlate(exitPlate);

        var activeSessions = await _context.ParkingSessions
            .Include(s => s.ParkingSlot)
                .ThenInclude(ps => ps.Floor)
            .Include(s => s.VehicleType)
            .Include(s => s.Reservation)
            .Where(s => s.Status == SessionStatus.Active)
            .ToListAsync();

        ParkingSession? session = null;

        if (!string.IsNullOrWhiteSpace(request.QrCode))
        {
            session = activeSessions.FirstOrDefault(s => 
                (!string.IsNullOrEmpty(s.SessionCode) && s.SessionCode.Equals(request.QrCode, StringComparison.OrdinalIgnoreCase)) ||
                s.Id.ToString().Equals(request.QrCode, StringComparison.OrdinalIgnoreCase)
            );
        }
        else
        {
            session = activeSessions.FirstOrDefault(s => CleanLicensePlate(s.LicensePlate) == normalizedExitPlate);
        }

        if (session == null)
        {
            throw new InvalidOperationException("Invalid card or parking session does not exist.");
        }

        if (CleanLicensePlate(session.LicensePlate) != normalizedExitPlate)
        {
            throw new InvalidOperationException($"License plate from camera ({exitPlate}) does not match the card.");
        }

        Guid? effectiveBuildingId = request.BuildingId;
        if (request.StaffId != Guid.Empty)
        {
            var staff = await _context.Users.FindAsync(request.StaffId);
            if (staff != null && staff.AssignedBuildingId.HasValue)
            {
                if (request.BuildingId.HasValue && request.BuildingId.Value != staff.AssignedBuildingId.Value)
                {
                    throw new InvalidOperationException("You do not have permission to check out vehicles for a building other than your assigned one.");
                }
                effectiveBuildingId = staff.AssignedBuildingId;
            }
        }

        if (!effectiveBuildingId.HasValue)
        {
            throw new InvalidOperationException("Please select a building to perform this action (Admin/Manager).");
        }

        if (session.ParkingSlot.Floor!.BuildingId != effectiveBuildingId.Value)
        {
            throw new InvalidOperationException("Cannot check out a vehicle that does not belong to your assigned or selected building.");
        }

        var normalizedEntryPlate = CleanLicensePlate(session.LicensePlate);
        var isMatch = normalizedEntryPlate == normalizedExitPlate;

        var exitTime = DateTime.UtcNow;
        var priceResult = await CalculateFeeAsync(session.VehicleTypeId, session.EntryTime, exitTime, pricingPolicyId: session.PricingPolicyId);

        // Áp dụng Miễn phí nếu có Vé tháng
        await ApplySubscriptionDiscountAsync(session, exitTime, priceResult);

        if (session.ReservationId != null && session.Reservation != null)
        {
            if (exitTime <= session.Reservation.EndTime)
            {
                priceResult.TotalFee = 0;
                priceResult.FeeBreakdown = null;
            }
            else
            {
                var overdueResult = await CalculateFeeAsync(session.VehicleTypeId, session.Reservation.EndTime, exitTime, isOverdue: true, pricingPolicyId: session.Reservation.PricingPolicyId ?? session.PricingPolicyId);
                priceResult.TotalFee = overdueResult.TotalFee;
                priceResult.FeeBreakdown = overdueResult.FeeBreakdown;
            }
        }

        var matchStatus = isMatch ? "KHỚP" : "KHÔNG KHỚP";
        var warningMsg = isMatch
            ? ""
            : $" Canh bao: Bien so luc ra ({exitPlate}) khong khop voi bien so luc vao ({session.LicensePlate}).";

        return new OcrCheckOutResult
        {
            SessionId = session.Id,
            EntryLicensePlate = session.LicensePlate,
            ExitLicensePlate = exitPlate,
            IsMatch = isMatch,
            MatchStatus = matchStatus,
            SlotNumber = session.ParkingSlot.SlotNumber,
            FloorName = session.ParkingSlot.Floor?.Name ?? string.Empty,
            EntryTime = session.EntryTime,
            EstimatedExitTime = exitTime,
            TotalHours = priceResult.TotalHours,
            VehicleTypeName = session.VehicleType.Name,
            HourlyRate = priceResult.HourlyRate,
            EstimatedFee = priceResult.TotalFee + session.PenaltyFee,
            PricingModel = priceResult.PricingModel,
            DayPassPrice = priceResult.DayPassPrice,
            NightPassPrice = priceResult.NightPassPrice,
            DailyMaxPrice = priceResult.DailyMaxPrice,
            FeeBreakdown = priceResult.FeeBreakdown,
            OcrConfidence = ocrResult.Confidence,
            Message = $"Trang thai bien so: {matchStatus}. Tim thay xe bien so {session.LicensePlate} " +
                      $"dang do tai o {session.ParkingSlot.SlotNumber}, tang {session.ParkingSlot.Floor?.Name ?? ""}. " +
                      BuildFeeMessage(priceResult) + warningMsg
        };
    }

    public async Task<CheckOutSearchResult> CalculateFeeBySessionIdAsync(Guid sessionId)
    {
        var session = await _context.ParkingSessions
            .Include(s => s.ParkingSlot)
                .ThenInclude(ps => ps.Floor)
            .Include(s => s.VehicleType)
            .Include(s => s.Reservation)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.Status == SessionStatus.Active);

        if (session == null)
        {
            throw new InvalidOperationException("Parking session not found or already paid.");
        }

        var exitTime = DateTime.UtcNow;
        var priceResult = await CalculateFeeAsync(session.VehicleTypeId, session.EntryTime, exitTime, pricingPolicyId: session.PricingPolicyId);

        // Áp dụng Miễn phí nếu có Vé tháng
        await ApplySubscriptionDiscountAsync(session, exitTime, priceResult);

        if (session.ReservationId != null && session.Reservation != null)
        {
            if (exitTime <= session.Reservation.EndTime)
            {
                priceResult.TotalFee = 0;
                priceResult.FeeBreakdown = null;
            }
            else
            {
                var overdueResult = await CalculateFeeAsync(session.VehicleTypeId, session.Reservation.EndTime, exitTime, isOverdue: true, pricingPolicyId: session.Reservation.PricingPolicyId ?? session.PricingPolicyId);
                priceResult.TotalFee = overdueResult.TotalFee;
                priceResult.FeeBreakdown = overdueResult.FeeBreakdown;
            }
        }

        return new CheckOutSearchResult
        {
            SessionId = session.Id,
            LicensePlate = session.LicensePlate,
            SlotNumber = session.ParkingSlot.SlotNumber,
            FloorName = session.ParkingSlot.Floor?.Name ?? string.Empty,
            EntryTime = session.EntryTime,
            EstimatedExitTime = exitTime,
            TotalHours = priceResult.TotalHours,
            VehicleTypeName = session.VehicleType.Name,
            HourlyRate = priceResult.HourlyRate,
            EstimatedFee = priceResult.TotalFee + session.PenaltyFee,
            PricingModel = priceResult.PricingModel,
            DayPassPrice = priceResult.DayPassPrice,
            NightPassPrice = priceResult.NightPassPrice,
            DailyMaxPrice = priceResult.DailyMaxPrice,
            FeeBreakdown = priceResult.FeeBreakdown,
            Message = BuildMessage(session, priceResult)
        };
    }

    private async Task ApplySubscriptionDiscountAsync(ParkingSession session, DateTime exitTime, PriceCalculationResult priceResult)
    {
        // Lấy tất cả các vé tháng Active của xe này
        var subs = await _context.Subscriptions
            .Where(s => s.LicensePlate == session.LicensePlate 
                     && s.VehicleTypeId == session.VehicleTypeId 
                     && s.Status == SubscriptionStatus.Active)
            .OrderBy(s => s.StartDate)
            .ToListAsync();

        if (!subs.Any()) return;

        // Tìm các khoảng trống (gaps) không được vé tháng bao phủ
        var gaps = new List<(DateTime Start, DateTime End)>();
        var current = session.EntryTime;

        foreach (var sub in subs)
        {
            if (current >= exitTime) break;
            if (sub.EndDate <= current) continue;

            if (sub.StartDate > current)
            {
                var gapEnd = sub.StartDate < exitTime ? sub.StartDate : exitTime;
                gaps.Add((current, gapEnd));
                current = sub.EndDate;
            }
            else
            {
                if (sub.EndDate > current)
                {
                    current = sub.EndDate;
                }
            }
        }

        if (current < exitTime)
        {
            gaps.Add((current, exitTime));
        }

        // Tính tổng phí dựa trên các khoảng trống
        if (!gaps.Any())
        {
            priceResult.TotalFee = 0;
            priceResult.FeeBreakdown = null;
        }
        else
        {
            decimal totalFee = 0;
            double totalHours = 0;

            foreach (var gap in gaps)
            {
                // Gọi hàm tính phí bình thường (không dùng isOverdue = true để không bị phạt nhân hệ số)
                var gapResult = await CalculateFeeAsync(session.VehicleTypeId, gap.Start, gap.End, isOverdue: false, pricingPolicyId: session.PricingPolicyId);
                totalFee += gapResult.TotalFee;
                totalHours += gapResult.TotalHours;
            }

            priceResult.TotalFee = totalFee;
            priceResult.TotalHours = totalHours;
        }
    }

    public async Task<PriceCalculationResult> CalculateFeeAsync(Guid vehicleTypeId, DateTime entryTime, DateTime exitTime, bool isOverdue = false, Guid? pricingPolicyId = null)
    {
        PricingPolicy? pricingPolicy = null;
        if (pricingPolicyId.HasValue)
        {
            pricingPolicy = await _context.PricingPolicies.FirstOrDefaultAsync(p => p.Id == pricingPolicyId.Value);
        }

        if (pricingPolicy == null)
        {
            // Lấy bảng giá có hiệu lực sát nhất trước lúc xe vào (để giữ nguyên giá cũ nếu null)
            pricingPolicy = await _context.PricingPolicies
                .Where(p => p.VehicleTypeId == vehicleTypeId && p.CreatedAt <= entryTime)
                .OrderByDescending(p => p.CreatedAt)
                .FirstOrDefaultAsync();

            // Nếu vẫn không có, lấy bảng giá cũ nhất có thể (chắc ăn)
            if (pricingPolicy == null)
            {
                pricingPolicy = await _context.PricingPolicies
                    .Where(p => p.VehicleTypeId == vehicleTypeId)
                    .OrderBy(p => p.CreatedAt)
                    .FirstOrDefaultAsync();
            }
        }

        if (pricingPolicy == null)
        {
            throw new InvalidOperationException("Pricing policy not found for this vehicle type.");
        }

        var duration = exitTime - entryTime;
        if (duration.TotalMinutes <= 0)
        {
            return new PriceCalculationResult
            {
                TotalHours = 0,
                TotalFee = 0,
                PricingModel = "BlockDayNight",
                HourlyRate = 0,
                DailyMaxPrice = pricingPolicy.DailyRate,
                FeeBreakdown = null
            };
        }

        double totalHours = duration.TotalHours;
        decimal totalFee = 0;

        int dayBlockCount = 0;
        int nightBlockCount = 0;

        // Vòng lặp duyệt qua từng block
        var currentMilli = entryTime;
        var blockTimeSpan = TimeSpan.FromHours(pricingPolicy.BlockDurationHours > 0 ? pricingPolicy.BlockDurationHours : 4);

        while (currentMilli < exitTime)
        {
            // Lấy giờ hiện tại theo Local (vì CSDL/Yêu cầu tính Day/Night dựa trên giờ địa phương - UTC+7 ở VN, hoặc giả định currentMilli đang lưu UTC thì phải cẩn thận)
            // LƯU Ý: entryTime lưu ở DB là UTC. Để check giờ Day/Night đúng chuẩn Việt Nam, ta nên đổi sang local hoặc cộng 7.
            // Để an toàn, giả định hệ thống dùng UTC, giờ đêm 22h -> 6h tính theo giờ VN thì UTC sẽ là 15h -> 23h.
            // Tuy nhiên, để linh hoạt, ta convert sang múi giờ VN (SE Asia Standard Time) để check số giờ thực tế:
            var currentVnTime = TimeZoneInfo.ConvertTimeFromUtc(currentMilli, TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time"));
            var currentHour = currentVnTime.Hour;

            bool isNight = currentHour >= pricingPolicy.NightStartHour || currentHour < pricingPolicy.NightEndHour;

            if (isNight)
            {
                totalFee += pricingPolicy.NightBlockRate;
                nightBlockCount++;
            }
            else
            {
                totalFee += pricingPolicy.DayBlockRate;
                dayBlockCount++;
            }

            currentMilli = currentMilli.Add(blockTimeSpan);
        }

        // Kiểm tra trần theo ngày (Daily Rate)
        int durationDays = (int)Math.Floor(totalHours / 24.0);
        if (pricingPolicy.DailyRate > 0)
        {
            if (durationDays > 0)
            {
                decimal capFee = (durationDays + 1) * pricingPolicy.DailyRate;
                if (totalFee > capFee) totalFee = capFee;
            }
            else if (totalFee > pricingPolicy.DailyRate)
            {
                totalFee = pricingPolicy.DailyRate;
            }
        }

        if (isOverdue && pricingPolicy.OvertimeMultiplier > 0)
        {
            totalFee *= pricingPolicy.OvertimeMultiplier;
        }

        return new PriceCalculationResult
        {
            TotalHours = totalHours,
            TotalFee = totalFee,
            PricingModel = "BlockDayNight",
            HourlyRate = 0, // Không dùng Hourly
            DailyMaxPrice = pricingPolicy.DailyRate,
            FeeBreakdown = new FeeBreakdownDto
            {
                DayPassCount = dayBlockCount,
                NightPassCount = nightBlockCount,
                DayPassTotal = dayBlockCount * pricingPolicy.DayBlockRate,
                NightPassTotal = nightBlockCount * pricingPolicy.NightBlockRate,
                TotalFee = totalFee
            }
        };
    }

    private static string BuildMessage(ParkingSession session, PriceCalculationResult result, bool isConfirm = false)
    {
        var feeMsg = BuildFeeMessage(result);
        if (isConfirm)
            return $"Thanh toan thanh cong! Xe bien so {session.LicensePlate} da ra bai. {feeMsg} Cam on quy khach!";
        return $"Tim thay xe bien so {session.LicensePlate} dang do tai o {session.ParkingSlot.SlotNumber}, " +
               $"tang {session.ParkingSlot.Floor?.Name ?? ""}. {feeMsg}";
    }

    private static string BuildFeeMessage(PriceCalculationResult result)
    {
        if (result.PricingModel.Contains("DayNight") && result.FeeBreakdown != null)
        {
            return $"Gui ngay x{result.FeeBreakdown.DayPassCount} = {result.FeeBreakdown.DayPassTotal:N0} VND, " +
                   $"gui dem x{result.FeeBreakdown.NightPassCount} = {result.FeeBreakdown.NightPassTotal:N0} VND. " +
                   $"Tong phi: {result.TotalFee:N0} VND.";
        }
        return $"Thoi gian gui: {result.TotalHours:F2} gio. Phi uoc tinh: {result.TotalFee:N0} VND.";
    }

    private static string CleanLicensePlate(string licensePlate)
    {
        if (string.IsNullOrWhiteSpace(licensePlate)) return string.Empty;
        return licensePlate.Trim().ToUpperInvariant().Replace(".", "").Replace("-", "").Replace(" ", "");
    }

    private static long GeneratePayOSOrderCode()
    {
        return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

}
