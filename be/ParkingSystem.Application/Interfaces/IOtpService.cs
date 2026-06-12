namespace ParkingSystem.Application.Interfaces;

/// <summary>
/// Service quản lý mã OTP — tạo, lưu, xác thực.
/// </summary>
public interface IOtpService
{
    /// <summary>
    /// Tạo mã OTP 6 số, lưu vào DB, gửi email.
    /// </summary>
    /// <param name="email">Email nhận OTP</param>
    /// <param name="purpose">"Register" hoặc "ForgotPassword"</param>
    Task SendOtpAsync(string email, string purpose);

    /// <summary>
    /// Xác thực mã OTP — kiểm tra đúng mã, đúng email, chưa hết hạn, chưa dùng.
    /// Trả về true nếu hợp lệ (và đánh dấu IsUsed = true).
    /// </summary>
    Task<bool> VerifyOtpAsync(string email, string code, string purpose);
}
