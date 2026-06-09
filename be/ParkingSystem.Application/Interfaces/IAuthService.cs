using ParkingSystem.Application.DTOs.Auth;

namespace ParkingSystem.Application.Interfaces;

public interface IAuthService
{
    // ===== P0: Core Auth =====
    
    /// <summary>
    /// Đăng nhập bằng username/password → trả về AccessToken + RefreshToken
    /// </summary>
    Task<AuthResponse> LoginAsync(LoginRequest request);

    /// <summary>
    /// Đăng nhập bằng Google OAuth → tự tạo tài khoản Driver nếu chưa có
    /// </summary>
    Task<AuthResponse> GoogleLoginAsync(GoogleLoginRequest request);

    /// <summary>
    /// Đăng ký tài khoản Driver mới
    /// </summary>
    Task<AuthResponse> RegisterAsync(RegisterRequest request);

    /// <summary>
    /// Dùng RefreshToken để lấy AccessToken mới (không cần đăng nhập lại)
    /// </summary>
    Task<AuthResponse> RefreshTokenAsync(RefreshTokenRequest request);

    /// <summary>
    /// Lấy thông tin profile từ JWT token hiện tại
    /// </summary>
    Task<ProfileResponse> GetProfileAsync(Guid userId);

    /// <summary>
    /// Đổi mật khẩu (yêu cầu nhập mật khẩu cũ)
    /// </summary>
    Task ChangePasswordAsync(Guid userId, ChangePasswordRequest request);

    // ===== P1: Enhanced Auth =====

    /// <summary>
    /// Admin tạo tài khoản cho Staff/Manager (chỉ Admin mới được gọi)
    /// </summary>
    Task<ProfileResponse> AdminCreateUserAsync(AdminCreateUserRequest request);

    /// <summary>
    /// Logout — thu hồi refresh token hiện tại
    /// </summary>
    Task LogoutAsync(string refreshToken);

    /// <summary>
    /// Cập nhật thông tin profile (tên, SĐT, email)
    /// </summary>
    Task<ProfileResponse> UpdateProfileAsync(Guid userId, UpdateProfileRequest request);

    // ===== OTP Email Verification =====

    /// <summary>
    /// Gửi mã OTP qua email (cho đăng ký hoặc quên mật khẩu)
    /// </summary>
    Task SendOtpAsync(SendOtpRequest request);

    /// <summary>
    /// Đăng ký tài khoản với xác thực OTP email
    /// </summary>
    Task<AuthResponse> VerifyRegisterAsync(VerifyRegisterRequest request);

    /// <summary>
    /// Đặt lại mật khẩu bằng OTP (quên mật khẩu)
    /// </summary>
    Task ResetPasswordAsync(ResetPasswordRequest request);
}
