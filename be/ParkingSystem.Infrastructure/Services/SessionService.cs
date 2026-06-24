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

    public SessionService(ApplicationDbContext context, IQrCodeService qrCodeService, ICheckOutService checkOutService)
    {
        _context = context;
        _qrCodeService = qrCodeService;
        _checkOutService = checkOutService;
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
            TotalFee = s.TotalFee,
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
        try
        {
            var feeResult = await _checkOutService.CalculateFeeBySessionIdAsync(session.Id);
            currentFee = feeResult.EstimatedFee;
        }
        catch
        {
            currentFee = 0;
        }

        bool isPrepaid = session.CheckInMethod == CheckInMethod.Booking && session.Reservation != null;
        DateTime? prepaidStartTime = isPrepaid ? session.Reservation!.StartTime : null;
        DateTime? prepaidEndTime = isPrepaid ? session.Reservation!.EndTime : null;

        return new MyActiveSessionResponse
        {
            Id = session.Id,
            SessionCode = session.SessionCode,
            SessionQrCodeBase64 = _qrCodeService.GenerateQrCodeBase64(session.Id.ToString()),
            LicensePlate = session.LicensePlate,
            VehicleTypeName = session.VehicleType?.Name ?? "",
            EntryTime = session.EntryTime,
            BuildingName = session.ParkingSlot?.Floor?.Building?.Name ?? "",
            FloorName = session.ParkingSlot?.Floor?.Name ?? "",
            SlotNumber = session.ParkingSlot?.SlotNumber ?? "",
            PricePerHour = 0, // Dùng Block thay vì HourlyRate
            CurrentFee = currentFee,
            IsPrepaid = isPrepaid,
            PrepaidStartTime = prepaidStartTime,
            PrepaidEndTime = prepaidEndTime
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
}
