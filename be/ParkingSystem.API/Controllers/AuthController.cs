using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.Auth;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    // ===== P0: Core Auth Endpoints =====

    /// <summary>
    /// Đăng nhập bằng username/password → trả về AccessToken + RefreshToken
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            var response = await _authService.LoginAsync(request);
            return Ok(response);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Đăng nhập bằng Google OAuth
    /// </summary>
    [HttpPost("google-login")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest request)
    {
        try
        {
            var response = await _authService.GoogleLoginAsync(request);
            return Ok(response);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }


    /// <summary>
    /// Gia hạn AccessToken bằng RefreshToken (không cần đăng nhập lại)
    /// </summary>
    [HttpPost("refresh")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        try
        {
            var response = await _authService.RefreshTokenAsync(request);
            return Ok(response);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Lấy thông tin profile từ JWT token hiện tại
    /// </summary>
    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetProfile()
    {
        try
        {
            var userId = GetCurrentUserId();
            var response = await _authService.GetProfileAsync(userId);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Đổi mật khẩu (cần đăng nhập + nhập mật khẩu cũ)
    /// </summary>
    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            await _authService.ChangePasswordAsync(userId, request);
            return Ok(new { message = "Đổi mật khẩu thành công." });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ===== P1: Enhanced Auth Endpoints =====

    /// <summary>
    /// Admin tạo tài khoản cho Staff/Manager
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPost("create-user")]
    public async Task<IActionResult> AdminCreateUser([FromBody] AdminCreateUserRequest request)
    {
        try
        {
            var response = await _authService.AdminCreateUserAsync(request);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Logout — thu hồi refresh token
    /// </summary>
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest request)
    {
        await _authService.LogoutAsync(request.RefreshToken);
        return Ok(new { message = "Đăng xuất thành công." });
    }

    /// <summary>
    /// Bật/Tắt tính năng AutoPay
    /// </summary>
    [Authorize]
    [HttpPatch("profile/autopay")]
    public async Task<IActionResult> ToggleAutoPay([FromBody] ToggleAutoPayRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            await _authService.ToggleAutoPayAsync(userId, request);
            return Ok(new { message = request.AutoPayEnabled ? "Đã bật Tự động thanh toán." : "Đã tắt Tự động thanh toán." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Cập nhật thông tin profile (tên, SĐT, email)
    /// </summary>
    [Authorize]
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            var response = await _authService.UpdateProfileAsync(userId, request);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ===== OTP Email Verification Endpoints =====

    /// <summary>
    /// Gửi mã OTP qua email (cho đăng ký hoặc quên mật khẩu)
    /// Purpose: "Register" hoặc "ForgotPassword"
    /// </summary>
    [HttpPost("send-otp")]
    public async Task<IActionResult> SendOtp([FromBody] SendOtpRequest request)
    {
        try
        {
            await _authService.SendOtpAsync(request);
            return Ok(new { message = $"Đã gửi mã OTP tới {request.Email}. Mã có hiệu lực 5 phút." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Đăng ký tài khoản với xác thực OTP email
    /// </summary>
    [HttpPost("verify-register")]
    public async Task<IActionResult> VerifyRegister([FromBody] VerifyRegisterRequest request)
    {
        try
        {
            var response = await _authService.VerifyRegisterAsync(request);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Đặt lại mật khẩu bằng OTP (quên mật khẩu)
    /// </summary>
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        try
        {
            await _authService.ResetPasswordAsync(request);
            return Ok(new { message = "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ===== Helper: Lấy UserId từ JWT claims =====
    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)
                       ?? User.FindFirst("sub");
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
            throw new UnauthorizedAccessException("Không xác định được người dùng.");
        return userId;
    }
}
