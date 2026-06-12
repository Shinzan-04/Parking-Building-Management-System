using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Entities;

public class User : BaseEntity
{
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public Role Role { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string QrCode { get; set; } = string.Empty;

    /// <summary>
    /// Số lần đăng nhập sai liên tiếp (reset về 0 khi login thành công)
    /// </summary>
    public int FailedLoginCount { get; set; } = 0;

    /// <summary>
    /// Thời điểm hết khóa tài khoản (null = không bị khóa)
    /// </summary>
    public DateTime? LockoutEnd { get; set; }

    public ICollection<ParkingSession> DriverSessions { get; set; } = new List<ParkingSession>();
    public ICollection<ParkingSession> HandledSessions { get; set; } = new List<ParkingSession>();
    public ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
