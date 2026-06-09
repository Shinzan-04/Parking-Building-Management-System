using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

/// <summary>
/// Service quản lý mã OTP:
/// - Tạo mã 6 chữ số ngẫu nhiên (dùng RandomNumberGenerator — an toàn)
/// - Lưu vào DB (bảng OtpCodes)
/// - Gửi email chứa mã OTP
/// - Xác thực: đúng email + đúng mã + đúng mục đích + chưa hết hạn + chưa dùng
///
/// Luồng đăng ký:
///   1. POST /api/auth/send-otp  { email: "...", purpose: "Register" }
///   2. User nhận email → nhập mã OTP vào form
///   3. POST /api/auth/verify-register  { email, otpCode, username, password, fullName }
///
/// Luồng quên mật khẩu:
///   1. POST /api/auth/send-otp  { email: "...", purpose: "ForgotPassword" }
///   2. User nhận email → nhập mã OTP
///   3. POST /api/auth/reset-password  { email, otpCode, newPassword }
/// </summary>
public class OtpService : IOtpService
{
    private readonly ApplicationDbContext _context;
    private readonly IEmailService _emailService;
    private readonly ILogger<OtpService> _logger;

    // Mã OTP có hiệu lực trong 5 phút
    private const int OtpExpiryMinutes = 5;

    public OtpService(ApplicationDbContext context, IEmailService emailService, ILogger<OtpService> logger)
    {
        _context = context;
        _emailService = emailService;
        _logger = logger;
    }

    /// <summary>
    /// Tạo OTP → lưu DB → gửi email.
    /// Nếu email đã có OTP chưa dùng → vô hiệu hóa OTP cũ trước.
    /// </summary>
    public async Task SendOtpAsync(string email, string purpose)
    {
        // Vô hiệu hóa tất cả OTP cũ của email+purpose này (tránh dùng mã cũ)
        var existingOtps = await _context.Set<OtpCode>()
            .Where(o => o.Email == email && o.Purpose == purpose && !o.IsUsed)
            .ToListAsync();
        foreach (var old in existingOtps)
        {
            old.IsUsed = true; // Đánh dấu đã dùng → không verify được nữa
        }

        // Sinh mã 6 chữ số ngẫu nhiên (an toàn hơn Random.Next)
        var code = RandomNumberGenerator.GetInt32(100000, 999999).ToString();

        // Lưu OTP mới vào DB
        var otp = new OtpCode
        {
            Id = Guid.NewGuid(),
            Email = email,
            Code = code,
            Purpose = purpose,
            ExpiresAt = DateTime.UtcNow.AddMinutes(OtpExpiryMinutes),
            CreatedAt = DateTime.UtcNow
        };
        _context.Set<OtpCode>().Add(otp);
        await _context.SaveChangesAsync();

        // Gửi email chứa OTP
        var subject = purpose == "Register"
            ? "🅿️ Mã xác thực đăng ký — Parking System"
            : "🔑 Mã đặt lại mật khẩu — Parking System";

        var htmlBody = BuildOtpEmailTemplate(code, purpose);
        await _emailService.SendEmailAsync(email, subject, htmlBody);

        _logger.LogInformation("📧 Đã gửi OTP [{Purpose}] tới {Email}", purpose, email);
    }

    /// <summary>
    /// Xác thực mã OTP:
    /// - Tìm OTP mới nhất của email + purpose
    /// - Kiểm tra: đúng mã, chưa hết hạn, chưa dùng
    /// - Nếu hợp lệ → đánh dấu IsUsed = true
    /// </summary>
    public async Task<bool> VerifyOtpAsync(string email, string code, string purpose)
    {
        var otp = await _context.Set<OtpCode>()
            .Where(o => o.Email == email && o.Purpose == purpose && !o.IsUsed)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync();

        if (otp == null)
            return false;

        // Hết hạn?
        if (otp.ExpiresAt < DateTime.UtcNow)
            return false;

        // Sai mã?
        if (otp.Code != code)
            return false;

        // Hợp lệ → đánh dấu đã dùng
        otp.IsUsed = true;
        await _context.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Template email HTML đẹp cho OTP.
    /// </summary>
    private static string BuildOtpEmailTemplate(string code, string purpose)
    {
        var title = purpose == "Register"
            ? "Xác thực đăng ký tài khoản"
            : "Đặt lại mật khẩu";

        var description = purpose == "Register"
            ? "Bạn đang đăng ký tài khoản tại <b>Parking System</b>. Vui lòng nhập mã bên dưới để hoàn tất đăng ký."
            : "Bạn đã yêu cầu đặt lại mật khẩu tại <b>Parking System</b>. Vui lòng nhập mã bên dưới.";

        return $@"
        <div style='font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8f9fa; border-radius: 12px;'>
            <div style='text-align: center; margin-bottom: 24px;'>
                <h2 style='color: #1a1a2e; margin: 0;'>🅿️ Parking System</h2>
                <p style='color: #666; margin: 8px 0 0;'>{title}</p>
            </div>
            <div style='background: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);'>
                <p style='color: #333; line-height: 1.6;'>{description}</p>
                <div style='text-align: center; margin: 24px 0;'>
                    <span style='display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb; background: #eff6ff; padding: 16px 32px; border-radius: 8px; border: 2px dashed #93c5fd;'>
                        {code}
                    </span>
                </div>
                <p style='color: #999; font-size: 13px; text-align: center;'>
                    ⏰ Mã có hiệu lực trong <b>5 phút</b>. Không chia sẻ mã này với bất kỳ ai.
                </p>
            </div>
            <p style='color: #aaa; font-size: 12px; text-align: center; margin-top: 16px;'>
                Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.
            </p>
        </div>";
    }
}
