using ParkingSystem.Application.DTOs.Notification;

namespace ParkingSystem.Application.Interfaces;

/// <summary>
/// Service gửi và quản lý thông báo trong hệ thống.
/// </summary>
public interface INotificationService
{
    /// <summary>
    /// Tạo thông báo mới cho 1 user
    /// </summary>
    Task SendAsync(Guid userId, string title, string message, string type, Guid? referenceId = null);

    /// <summary>
    /// Lấy danh sách thông báo của user (mới nhất trước)
    /// </summary>
    Task<IEnumerable<NotificationResponse>> GetByUserIdAsync(Guid userId, int page = 1, int pageSize = 20);

    /// <summary>
    /// Đếm số thông báo chưa đọc
    /// </summary>
    Task<int> GetUnreadCountAsync(Guid userId);

    /// <summary>
    /// Đánh dấu 1 thông báo đã đọc
    /// </summary>
    Task MarkAsReadAsync(Guid notificationId, Guid userId);

    /// <summary>
    /// Đánh dấu tất cả đã đọc
    /// </summary>
    Task MarkAllAsReadAsync(Guid userId);
}
