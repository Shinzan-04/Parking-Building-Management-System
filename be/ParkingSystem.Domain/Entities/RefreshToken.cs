namespace ParkingSystem.Domain.Entities;

/// <summary>
/// Refresh Token — cho phép gia hạn Access Token mà không cần đăng nhập lại.
/// Mỗi user có thể có nhiều refresh token (đăng nhập từ nhiều thiết bị).
/// </summary>
public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }

    /// <summary>
    /// Chuỗi token ngẫu nhiên (64 ký tự) — gửi kèm khi gọi /api/auth/refresh
    /// </summary>
    public string Token { get; set; } = string.Empty;

    /// <summary>
    /// Thời điểm hết hạn (mặc định 7 ngày kể từ lúc tạo)
    /// </summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// Đã bị thu hồi chưa? (true khi user logout hoặc admin revoke)
    /// </summary>
    public bool IsRevoked { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public User User { get; set; } = null!;
}
