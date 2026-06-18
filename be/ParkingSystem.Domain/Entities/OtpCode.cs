namespace ParkingSystem.Domain.Entities;

/// <summary>
/// Mã OTP gửi qua email — dùng cho xác thực đăng ký và quên mật khẩu.
/// Mỗi OTP có hiệu lực 5 phút, chỉ dùng được 1 lần.
/// </summary>
public class OtpCode
{
    public Guid Id { get; set; }

    /// <summary>
    /// Email nhận OTP
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Mã OTP 6 chữ số (VD: "482931")
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Mục đích sử dụng: "Register" hoặc "ForgotPassword"
    /// </summary>
    public string Purpose { get; set; } = string.Empty;

    /// <summary>
    /// Thời điểm hết hạn (mặc định 5 phút kể từ lúc tạo)
    /// </summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// Đã sử dụng chưa? (true sau khi verify thành công)
    /// </summary>
    public bool IsUsed { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
