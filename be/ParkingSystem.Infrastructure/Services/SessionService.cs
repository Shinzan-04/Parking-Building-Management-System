using Microsoft.EntityFrameworkCore;
using ParkingSystem.Application.DTOs.Session;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

/// <summary>
/// Service quản lý phiên gửi xe:
/// - Xem danh sách session đang hoạt động (xe trong bãi)
/// - Tìm kiếm session theo biển số, tầng, trạng thái
/// - Tra cứu nhanh theo biển số
/// </summary>
public class SessionService : ISessionService
{
    private readonly ApplicationDbContext _context;
    private readonly IQrCodeService _qrCodeService;
    private readonly ICheckOutService _checkOutService;
    private readonly INotificationService _notificationService;
    private readonly IAuditLogService _auditLogService;

    public SessionService(ApplicationDbContext context, IQrCodeService qrCodeService, ICheckOutService checkOutService, INotificationService notificationService, IAuditLogService auditLogService)
    {
        _context = context;
        _qrCodeService = qrCodeService;
        _checkOutService = checkOutService;
        _notificationService = notificationService;
        _auditLogService = auditLogService;
    }

    /// <summary>
    /// Lấy danh sách session đang Active (xe đang trong bãi)
    /// Bao gồm thống kê tổng quan (tổng xe, overdue, doanh thu hôm nay)
    /// </summary>
    public async Task<SessionListResponse> GetActiveSessionsAsync(SessionFilterRequest filter)
    {
        // Ép lọc chỉ Active
        filter.Status = SessionStatus.Active;
        return await SearchSessionsAsync(filter);
    }

    /// <summary>
    /// Tìm kiếm session theo nhiều tiêu chí:
    /// - Biển số (gần đúng), trạng thái, tòa nhà, tầng, khoảng ngày
    /// </summary>
    public async Task<SessionListResponse> SearchSessionsAsync(SessionFilterRequest filter)
    {
        var query = _context.ParkingSessions
            .Include(s => s.ParkingSlot)
                .ThenInclude(ps => ps.Floor)
                    .ThenInclude(f => f.Building)
            .Include(s => s.VehicleType)
            .Include(s => s.Driver)
            .Include(s => s.Staff)
            .Where(s => !s.IsDeleted)
            .AsQueryable();

        // === Áp dụng các bộ lọc ===
        
        // Lọc theo trạng thái
        if (filter.Status.HasValue)
            query = query.Where(s => s.Status == filter.Status.Value);

        // Lọc ngầm định theo Tòa nhà của Staff (nếu có)
        if (filter.StaffId.HasValue)
        {
            var staff = await _context.Users.FindAsync(filter.StaffId.Value);
            if (staff != null && staff.AssignedBuildingId.HasValue)
            {
                query = query.Where(s => s.ParkingSlot.Floor.BuildingId == staff.AssignedBuildingId.Value);
            }
        }

        // Tìm theo biển số (gần đúng — LIKE '%keyword%')
        if (!string.IsNullOrWhiteSpace(filter.LicensePlate))
        {
            var plate = filter.LicensePlate.Trim().ToUpper();
            query = query.Where(s => s.LicensePlate.ToUpper().Contains(plate));
        }

        // Lọc theo tòa nhà
        if (filter.BuildingId.HasValue)
            query = query.Where(s => s.ParkingSlot.Floor.BuildingId == filter.BuildingId.Value);

        // Lọc theo tầng
        if (filter.FloorId.HasValue)
            query = query.Where(s => s.ParkingSlot.FloorId == filter.FloorId.Value);

        // Lọc theo khoảng ngày:
        // - Completed sessions: dùng ExitTime (thời điểm ra xe thực tế để khớp kỳ báo cáo)
        // - Active/Overdue sessions: dùng EntryTime (chưa có ExitTime)
        if (filter.FromDate.HasValue)
        {
            var from = filter.FromDate.Value.ToUniversalTime();
            query = query.Where(s =>
                s.Status == SessionStatus.Completed
                    ? s.ExitTime != null && s.ExitTime.Value >= from
                    : s.EntryTime >= from);
        }

        if (filter.ToDate.HasValue)
        {
            var to = filter.ToDate.Value.ToUniversalTime();
            query = query.Where(s =>
                s.Status == SessionStatus.Completed
                    ? s.ExitTime != null && s.ExitTime.Value <= to
                    : s.EntryTime <= to);
        }

        // Đếm tổng trước phân trang
        var totalCount = await query.CountAsync();

        // Sắp xếp: xe vào sớm nhất lên đầu (đang gửi lâu nhất)
        var items = await query
            .OrderByDescending(s => s.EntryTime)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(s => MapToDto(s))
            .ToListAsync();

        // Thống kê nhanh
        var now = DateTime.UtcNow;
        var todayStart = now.Date;
        
        var summary = new SessionSummary
        {
            TotalActive = await _context.ParkingSessions
                .CountAsync(s => s.Status == SessionStatus.Active && !s.IsDeleted),
            TotalOverdue = await _context.ParkingSessions
                .CountAsync(s => s.Status == SessionStatus.Overdue && !s.IsDeleted),
            TotalCompletedToday = await _context.ParkingSessions
                .CountAsync(s => s.Status == SessionStatus.Completed 
                              && s.ExitTime >= todayStart && !s.IsDeleted),
            TotalRevenueToday = await _context.ParkingSessions
                .Where(s => s.Status == SessionStatus.Completed 
                         && s.ExitTime >= todayStart && !s.IsDeleted)
                .SumAsync(s => s.TotalFee)
        };

        return new SessionListResponse
        {
            Items = items,
            TotalCount = totalCount,
            Page = filter.Page,
            PageSize = filter.PageSize,
            Summary = summary
        };
    }

    /// <summary>
    /// Xem chi tiết 1 session theo ID
    /// </summary>
    public async Task<SessionDto> GetSessionByIdAsync(Guid sessionId)
    {
        var session = await _context.ParkingSessions
            .Include(s => s.ParkingSlot)
                .ThenInclude(ps => ps.Floor)
                    .ThenInclude(f => f.Building)
            .Include(s => s.VehicleType)
            .Include(s => s.Driver)
            .Include(s => s.Staff)
            .FirstOrDefaultAsync(s => s.Id == sessionId && !s.IsDeleted);

        if (session == null)
            throw new InvalidOperationException("Không tìm thấy phiên gửi xe.");

        return MapToDto(session);
    }

    /// <summary>
    /// Tìm nhanh session đang Active theo biển số xe
    /// </summary>
    public async Task<SessionDto?> FindActiveByPlateAsync(string licensePlate)
    {
        var plate = licensePlate.Trim().ToUpper();

        var session = await _context.ParkingSessions
            .Include(s => s.ParkingSlot)
                .ThenInclude(ps => ps.Floor)
                    .ThenInclude(f => f.Building)
            .Include(s => s.VehicleType)
            .Include(s => s.Driver)
            .Include(s => s.Staff)
            .FirstOrDefaultAsync(s => s.LicensePlate.ToUpper() == plate 
                                   && s.Status == SessionStatus.Active 
                                   && !s.IsDeleted);

        return session == null ? null : MapToDto(session);
    }

    public async Task<SessionDto> ReissueTicketAsync(Guid sessionId, ReissueTicketRequest request, Guid staffId)
    {
        var session = await _context.ParkingSessions
            .Include(s => s.ParkingSlot)
                .ThenInclude(ps => ps.Floor)
                    .ThenInclude(f => f.Building)
            .Include(s => s.VehicleType)
            .Include(s => s.Driver)
            .Include(s => s.Staff)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.Status == SessionStatus.Active && !s.IsDeleted);

        if (session == null)
            throw new KeyNotFoundException("Không tìm thấy phiên gửi xe hoặc xe đã thanh toán.");

        var oldPenaltyFee = session.PenaltyFee;

        // Ghi nhận tiền phạt và loại lỗi
        session.PenaltyFee = request.PenaltyFee;
        session.IssueType = IssueType.LostTicket;
        
        // Có thể lưu staffId đã xử lý mất vé vào một nơi nào đó (ở đây mình có thể đổi StaffId của session thành người duyệt mới nhất)
        session.StaffId = staffId;

        // Lưu lại DB
        session.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Ghi Audit Log
        await _auditLogService.LogAsync(
            userId: staffId,
            actionType: "ReissueTicket",
            entityName: "ParkingSession",
            entityId: session.Id,
            oldValues: new { PenaltyFee = oldPenaltyFee },
            newValues: new { PenaltyFee = session.PenaltyFee },
            reason: request.Reason ?? "Cấp lại vé mất cho khách hàng"
        );

        return MapToDto(session);
    }

    /// <summary>
    /// Map entity → DTO, tính thời gian gửi xe
    /// </summary>
    private static SessionDto MapToDto(ParkingSystem.Domain.Entities.ParkingSession s)
    {
        var now = DateTime.UtcNow;
        var duration = (s.ExitTime ?? now) - s.EntryTime;
        var hours = (int)duration.TotalHours;
        var minutes = duration.Minutes;
        var durationText = hours > 0 
            ? $"{hours} giờ {minutes} phút" 
            : $"{minutes} phút";

        return new SessionDto
        {
            Id = s.Id,
            SessionCode = s.SessionCode,
            LicensePlate = s.LicensePlate,
            CheckInMethod = s.CheckInMethod,
            Status = s.Status,
            IssueType = s.IssueType,
            SlotNumber = s.ParkingSlot?.SlotNumber ?? "",
            FloorName = s.ParkingSlot?.Floor?.Name ?? "",
            BuildingName = s.ParkingSlot?.Floor?.Building?.Name ?? "",
            VehicleTypeName = s.VehicleType?.Name ?? "",
            DriverName = s.Driver?.FullName,
            StaffName = s.Staff?.FullName,
            EntryTime = s.EntryTime,
            ExitTime = s.ExitTime,
            EstimatedFee = s.EstimatedFee,
            PenaltyFee = s.PenaltyFee,
            TotalFee = s.TotalFee,
            PrePaidAmount = s.PrePaidAmount,
            GracePeriodEndTime = s.GracePeriodEndTime,
            Duration = durationText,
            EntryImageUrl = s.EntryImageUrl
        };
    }

    /// <summary>
    /// Lấy thông tin phiên đỗ xe hiện tại (Live Session) của user (Driver)
    /// </summary>
    public async Task<MyActiveSessionResponse?> GetMyActiveSessionAsync(Guid driverId)
    {
        var session = await _context.ParkingSessions
            .Include(s => s.VehicleType)
            .Include(s => s.ParkingSlot)
                .ThenInclude(ps => ps.Floor)
                    .ThenInclude(f => f.Building)
            .Include(s => s.Reservation)
            .Where(s => s.DriverId == driverId && s.Status == SessionStatus.Active && !s.IsDeleted)
            .OrderByDescending(s => s.EntryTime)
            .FirstOrDefaultAsync();

        if (session == null) return null;

        // Tái sử dụng logic tính phí chính xác (Block Day/Night) từ CheckOutService
        decimal currentFee = 0;
        List<ParkingSystem.Application.DTOs.CheckOut.SurchargeLogItemDto>? surchargeLogs = null;
        try
        {
            var feeResult = await _checkOutService.CalculateFeeBySessionIdAsync(session.Id);
            currentFee = feeResult.EstimatedFee;
            surchargeLogs = feeResult.FeeBreakdown?.SurchargeLogs;
        }
        catch
        {
            currentFee = 0;
        }

        bool isPrepaid = session.CheckInMethod == CheckInMethod.Booking && session.Reservation != null;
        DateTime? prepaidStartTime = isPrepaid ? session.Reservation!.StartTime : null;
        DateTime? prepaidEndTime = isPrepaid ? session.Reservation!.EndTime : session.GracePeriodEndTime;

        return new MyActiveSessionResponse
        {
            Id = session.Id,
            SessionCode = session.SessionCode,
            SessionQrCodeBase64 = _qrCodeService.GenerateQrCodeBase64(session.SessionCode),
            LicensePlate = session.LicensePlate,
            VehicleTypeName = session.VehicleType?.Name ?? "",
            EntryTime = session.EntryTime,
            BuildingName = session.ParkingSlot?.Floor?.Building?.Name ?? "",
            FloorName = session.ParkingSlot?.Floor?.Name ?? "",
            SlotNumber = session.ParkingSlot?.SlotNumber ?? "",
            PricePerHour = 0, // Dùng Block thay vì HourlyRate
            CurrentFee = currentFee,
            PrePaidAmount = session.PrePaidAmount,
            IsPrepaid = isPrepaid,
            PrepaidStartTime = prepaidStartTime,
            PrepaidEndTime = prepaidEndTime,
            SurchargeLogs = surchargeLogs
        };
    }

    /// <summary>
    /// Dev tool: Tua nhanh thời gian đỗ xe bằng cách lùi EntryTime (và Reservation.EndTime) về quá khứ
    /// </summary>
    public async Task DevFastForwardAsync(Guid driverId, int minutes)
    {
        var session = await _context.ParkingSessions
            .Include(s => s.Reservation)
            .Where(s => s.DriverId == driverId && s.Status == SessionStatus.Active && !s.IsDeleted)
            .OrderByDescending(s => s.EntryTime)
            .FirstOrDefaultAsync();

        if (session == null)
            throw new InvalidOperationException("Không có phiên đỗ xe nào đang hoạt động để tua thời gian.");

        var timeToSubtract = TimeSpan.FromMinutes(minutes);
        
        session.EntryTime = session.EntryTime.Subtract(timeToSubtract);
        
        if (session.Reservation != null)
        {
            session.Reservation.StartTime = session.Reservation.StartTime.Subtract(timeToSubtract);
            session.Reservation.EndTime = session.Reservation.EndTime.Subtract(timeToSubtract);
        }

        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Dev tool: Khôi phục lại thời gian về lúc hiện tại (Reset timer)
    /// </summary>
    public async Task DevResetTimeAsync(Guid driverId)
    {
        var session = await _context.ParkingSessions
            .Include(s => s.Reservation)
            .Where(s => s.DriverId == driverId && s.Status == SessionStatus.Active && !s.IsDeleted)
            .OrderByDescending(s => s.EntryTime)
            .FirstOrDefaultAsync();

        if (session == null)
            throw new InvalidOperationException("Không có phiên đỗ xe nào đang hoạt động để reset thời gian.");

        var offset = session.CreatedAt - session.EntryTime;
        
        session.EntryTime = session.EntryTime.Add(offset);
        
        if (session.Reservation != null)
        {
            session.Reservation.StartTime = session.Reservation.StartTime.Add(offset);
            session.Reservation.EndTime = session.Reservation.EndTime.Add(offset);
        }

        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Tính toán và thực hiện thanh toán trước bằng ví (PrePay).
    /// </summary>
    public async Task<SessionDto> PrePayAsync(Guid sessionId, Guid driverId)
    {
        var session = await _context.ParkingSessions
            .Include(s => s.Driver)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.DriverId == driverId && s.Status == SessionStatus.Active && !s.IsDeleted);

        if (session == null)
            throw new KeyNotFoundException("Không tìm thấy phiên gửi xe hoặc phiên không thuộc về bạn.");

        if (session.Driver == null)
            throw new InvalidOperationException("Không tìm thấy thông tin tài xế.");

        // Tính phí đỗ xe tính đến thời điểm hiện tại
        var now = DateTime.UtcNow;
        var priceResult = await _checkOutService.CalculateFeeAsync(session.VehicleTypeId, session.EntryTime, now);

        // Trừ đi số tiền đã trả trước đó (nếu có)
        var amountDue = priceResult.TotalFee - session.PrePaidAmount;

        if (amountDue <= 0)
        {
            throw new InvalidOperationException("Phiên đỗ xe này chưa phát sinh thêm phí để thanh toán trước.");
        }

        if (session.Driver.Balance < amountDue)
        {
            throw new InvalidOperationException($"Insufficient wallet balance. Need {amountDue - session.Driver.Balance:N0} VND more.");
        }

        // Trừ tiền trong ví
        session.Driver.Balance -= amountDue;

        // Cập nhật session
        session.PrePaidAmount += amountDue;
        session.PrePaidTime = now;
        
        // Tính toán giờ kết thúc Block hiện tại
        var pricingPolicy = await _context.PricingPolicies.FirstOrDefaultAsync(p => p.VehicleTypeId == session.VehicleTypeId);
        var blockHours = (pricingPolicy != null && pricingPolicy.BlockDurationHours > 0) ? pricingPolicy.BlockDurationHours : 4;
        var blockTimeSpan = TimeSpan.FromHours(blockHours);
        var endOfCurrentBlock = session.EntryTime;
        while (endOfCurrentBlock < now)
        {
            endOfCurrentBlock = endOfCurrentBlock.Add(blockTimeSpan);
        }
        
        // Thời gian ân hạn = Max(Cuối Block hiện tại, Hiện tại + 15 phút)
        var minGraceTime = now.AddMinutes(15);
        session.GracePeriodEndTime = endOfCurrentBlock > minGraceTime ? endOfCurrentBlock : minGraceTime;
        session.GraceWarningSent = false;

        // Ghi nhận giao dịch vào ví
        var walletTx = new ParkingSystem.Domain.Entities.WalletTransaction
        {
            Id = Guid.NewGuid(),
            UserId = driverId,
            Amount = -amountDue, // Trừ tiền
            Type = "Payment",
            Status = "Success",
            Description = $"Thanh toán trước phí đỗ xe (Session: {session.SessionCode})",
            ReferenceId = session.Id.ToString(),
            CreatedAt = now
        };
        _context.WalletTransactions.Add(walletTx);

        // Ghi nhận Payment vào hệ thống (để thống kê doanh thu)
        var payment = new ParkingSystem.Domain.Entities.Payment
        {
            Id = Guid.NewGuid(),
            PayOSOrderCode = long.Parse($"{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}{Random.Shared.Next(1000, 9999)}"),
            ParkingSessionId = session.Id,
            UserId = driverId,
            Amount = amountDue,
            PaymentMethod = PaymentMethod.Wallet,
            Status = PaymentStatus.Success,
            CreatedAt = now,
            UpdatedAt = now
        };
        _context.Payments.Add(payment);

        await _context.SaveChangesAsync();

        // Bắn Notification báo thành công và thời hạn 15 phút
        await _notificationService.SendAsync(
            driverId,
            "✅ Prepaid Successfully",
            $"Bạn đã thanh toán {amountDue:N0} VND. Bạn có 15 phút ân hạn (đến {session.GracePeriodEndTime.Value.AddHours(7):HH:mm}) để đưa xe ra khỏi bãi mà không phát sinh thêm phí.",
            "PrePaySuccess",
            sessionId);

        return new SessionDto
        {
            Id = session.Id,
            SessionCode = session.SessionCode,
            LicensePlate = session.LicensePlate,
            EntryTime = session.EntryTime,
            Status = session.Status,
            TotalFee = priceResult.TotalFee,
            PrePaidAmount = session.PrePaidAmount,
            GracePeriodEndTime = session.GracePeriodEndTime
        };
    }
}
