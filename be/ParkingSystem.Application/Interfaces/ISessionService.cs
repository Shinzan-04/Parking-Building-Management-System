using ParkingSystem.Application.DTOs.Session;

namespace ParkingSystem.Application.Interfaces;

public interface ISessionService
{
    /// <summary>
    /// Lấy danh sách session đang hoạt động (xe trong bãi)
    /// </summary>
    Task<SessionListResponse> GetActiveSessionsAsync(SessionFilterRequest filter);
    
    /// <summary>
    /// Tìm kiếm session theo bộ lọc (biển số, trạng thái, tầng, ngày...)
    /// </summary>
    Task<SessionListResponse> SearchSessionsAsync(SessionFilterRequest filter);
    
    /// <summary>
    /// Xem chi tiết 1 session theo ID
    /// </summary>
    Task<SessionDto> GetSessionByIdAsync(Guid sessionId);
    
    /// <summary>
    /// Tìm session đang Active theo biển số xe (tra cứu nhanh)
    /// </summary>
    Task<SessionDto?> FindActiveByPlateAsync(string licensePlate);
    
    /// <summary>
    /// Lấy thông tin phiên đỗ xe hiện tại (Live Session) của user (Driver)
    /// </summary>
    Task<MyActiveSessionResponse?> GetMyActiveSessionAsync(Guid driverId);

    /// <summary>
    /// Dev tool: Tua nhanh thời gian đỗ xe bằng cách lùi EntryTime (và Reservation.EndTime) về quá khứ
    /// </summary>
    Task DevFastForwardAsync(Guid driverId, int minutes);

    /// <summary>
    /// Dev tool: Khôi phục lại thời gian về lúc hiện tại (Reset timer)
    /// </summary>
    Task DevResetTimeAsync(Guid driverId);
}
