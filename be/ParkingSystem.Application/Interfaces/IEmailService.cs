namespace ParkingSystem.Application.Interfaces;

/// <summary>
/// Service gửi email qua Gmail SMTP.
/// Dùng cho: gửi mã OTP xác thực đăng ký / quên mật khẩu.
/// </summary>
public interface IEmailService
{
    /// <summary>
    /// Gửi email tới địa chỉ nhận.
    /// </summary>
    /// <param name="toEmail">Email người nhận</param>
    /// <param name="subject">Tiêu đề email</param>
    /// <param name="htmlBody">Nội dung HTML</param>
    Task SendEmailAsync(string toEmail, string subject, string htmlBody);
}
