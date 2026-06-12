using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.DTOs.Auth;

// ===== LOGIN =====
public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

// ===== GOOGLE LOGIN =====
public class GoogleLoginRequest
{
    public string IdToken { get; set; } = string.Empty;
}

// ===== AUTH RESPONSE (dùng chung cho Login, Register, Refresh) =====
public class AuthResponse
{
    public Guid UserId { get; set; }
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime AccessTokenExpiresAt { get; set; }
    public string FullName { get; set; } = string.Empty;
    public Role Role { get; set; }
    public string? Email { get; set; }
    public string QrCode { get; set; } = string.Empty;
    public string? QrCodeImageBase64 { get; set; }
}


// ===== REFRESH TOKEN =====
public class RefreshTokenRequest
{
    public string RefreshToken { get; set; } = string.Empty;
}

// ===== CHANGE PASSWORD (P0.3) =====
public class ChangePasswordRequest
{
    public string OtpCode { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

// ===== UPDATE PROFILE (P1.6) =====
public class UpdateProfileRequest
{
    public string? FullName { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
}

public class ProfileResponse
{
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public Role Role { get; set; }
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string QrCode { get; set; } = string.Empty;
    public string? QrCodeImageBase64 { get; set; }
    public DateTime CreatedAt { get; set; }
}

// ===== ADMIN CREATE ACCOUNT (P1.4) =====
public class AdminCreateUserRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public Role Role { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
}

// ===== OTP: GỬI MÃ XÁC THỰC =====
public class SendOtpRequest
{
    /// <summary>
    /// Email nhận mã OTP
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Mục đích: "Register" hoặc "ForgotPassword"
    /// </summary>
    public string Purpose { get; set; } = string.Empty;
}

// ===== OTP: XÁC THỰC ĐĂNG KÝ =====
public class VerifyRegisterRequest
{
    public string Email { get; set; } = string.Empty;
    public string OtpCode { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
}

// ===== OTP: QUÊN MẬT KHẨU — XÁC THỰC =====
public class VerifyForgotPasswordRequest
{
    public string Email { get; set; } = string.Empty;
    public string OtpCode { get; set; } = string.Empty;
}

// ===== OTP: QUÊN MẬT KHẨU — ĐẶT LẠI =====
public class ResetPasswordRequest
{
    public string Email { get; set; } = string.Empty;
    public string OtpCode { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}
