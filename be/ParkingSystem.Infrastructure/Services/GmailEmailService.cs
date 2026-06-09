using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.Infrastructure.Services;

/// <summary>
/// Gửi email qua Gmail SMTP.
/// 
/// Cấu hình trong appsettings.json:
///   "EmailSettings": {
///     "SmtpHost": "smtp.gmail.com",
///     "SmtpPort": 587,
///     "SenderEmail": "your-email@gmail.com",
///     "SenderPassword": "your-app-password",   ← App Password (16 ký tự, không phải mật khẩu Gmail)
///     "SenderName": "Parking System"
///   }
///
/// Lưu ý: Phải bật "2-Step Verification" trên Google Account,
/// sau đó tạo App Password tại: https://myaccount.google.com/apppasswords
/// </summary>
public class GmailEmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<GmailEmailService> _logger;

    public GmailEmailService(IConfiguration configuration, ILogger<GmailEmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendEmailAsync(string toEmail, string subject, string htmlBody)
    {
        try
        {
            var smtpHost = _configuration["EmailSettings:SmtpHost"] ?? "smtp.gmail.com";
            var smtpPort = int.Parse(_configuration["EmailSettings:SmtpPort"] ?? "587");
            var senderEmail = _configuration["EmailSettings:SenderEmail"]
                ?? throw new InvalidOperationException("EmailSettings:SenderEmail chưa cấu hình.");
            var senderPassword = _configuration["EmailSettings:SenderPassword"]
                ?? throw new InvalidOperationException("EmailSettings:SenderPassword chưa cấu hình.");
            var senderName = _configuration["EmailSettings:SenderName"] ?? "Parking System";

            // Tạo email message
            var message = new MailMessage
            {
                From = new MailAddress(senderEmail, senderName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };
            message.To.Add(toEmail);

            // Gửi qua SMTP
            using var client = new SmtpClient(smtpHost, smtpPort)
            {
                Credentials = new NetworkCredential(senderEmail, senderPassword),
                EnableSsl = true // Gmail yêu cầu TLS
            };

            await client.SendMailAsync(message);
            _logger.LogInformation("📧 Gửi email thành công tới: {Email} | Subject: {Subject}", toEmail, subject);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Gửi email thất bại tới: {Email} | Error: {Message}", toEmail, ex.Message);
            throw;
        }
    }
}
