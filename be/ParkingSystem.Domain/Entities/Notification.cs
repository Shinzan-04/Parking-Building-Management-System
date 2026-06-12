namespace ParkingSystem.Domain.Entities;

/// <summary>
/// Thông báo trong hệ thống (in-app notification).
/// Được tạo khi: Staff duyệt/từ chối reservation, auto-cancel, v.v.
/// </summary>
public class Notification : BaseEntity
{
    /// <summary>
    /// User nhận thông báo
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Tiêu đề thông báo
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Nội dung chi tiết
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Loại thông báo: ReservationApproved, ReservationRejected, ReservationCancelled, General
    /// </summary>
    public string Type { get; set; } = "General";

    /// <summary>
    /// ID liên quan (ví dụ: ReservationId) để FE có thể navigate
    /// </summary>
    public Guid? ReferenceId { get; set; }

    /// <summary>
    /// Đã đọc chưa
    /// </summary>
    public bool IsRead { get; set; } = false;

    // Navigation
    public User User { get; set; } = null!;
}
