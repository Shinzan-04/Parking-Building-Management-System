using System.Security.Cryptography;
using Google.Apis.Auth;
using Microsoft.Extensions.Configuration;
using ParkingSystem.Application.DTOs.Auth;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Domain.Interfaces;

namespace ParkingSystem.Application.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly ITokenService _tokenService;
    private readonly IQrCodeService _qrCodeService;
    private readonly IOtpService _otpService;
    private readonly IConfiguration _configuration;

    // P2: Số lần đăng nhập sai tối đa trước khi khóa tài khoản
    private const int MaxFailedAttempts = 5;
    // P2: Thời gian khóa tài khoản (phút)
    private const int LockoutMinutes = 15;
    // Thời gian sống của Refresh Token (ngày)
    private const int RefreshTokenDays = 7;

    public AuthService(IUserRepository userRepository, ITokenService tokenService,
        IQrCodeService qrCodeService, IOtpService otpService, IConfiguration configuration)
    {
        _userRepository = userRepository;
        _tokenService = tokenService;
        _qrCodeService = qrCodeService;
        _otpService = otpService;
        _configuration = configuration;
    }

    // ===== P0.1: LOGIN =====
    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var user = await _userRepository.GetByUsernameAsync(request.Username);
        if (user == null)
            throw new UnauthorizedAccessException("Tên đăng nhập hoặc mật khẩu không đúng.");

        // P2: Kiểm tra tài khoản có bị khóa không
        if (user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTime.UtcNow)
        {
            var remaining = (int)(user.LockoutEnd.Value - DateTime.UtcNow).TotalMinutes + 1;
            throw new UnauthorizedAccessException(
                $"Tài khoản đã bị khóa do đăng nhập sai quá {MaxFailedAttempts} lần. Thử lại sau {remaining} phút.");
        }

        // Xác minh mật khẩu
        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            // P2: Tăng số lần sai
            user.FailedLoginCount++;
            if (user.FailedLoginCount >= MaxFailedAttempts)
            {
                user.LockoutEnd = DateTime.UtcNow.AddMinutes(LockoutMinutes);
                await _userRepository.UpdateAsync(user);
                throw new UnauthorizedAccessException(
                    $"Tài khoản đã bị khóa {LockoutMinutes} phút do đăng nhập sai {MaxFailedAttempts} lần.");
            }
            await _userRepository.UpdateAsync(user);
            throw new UnauthorizedAccessException(
                $"Mật khẩu không đúng. Còn {MaxFailedAttempts - user.FailedLoginCount} lần thử.");
        }

        // Login thành công → reset bộ đếm sai
        user.FailedLoginCount = 0;
        user.LockoutEnd = null;
        await _userRepository.UpdateAsync(user);

        return await BuildAuthResponse(user);
    }


    // ===== P0.1: GOOGLE LOGIN =====
    public async Task<AuthResponse> GoogleLoginAsync(GoogleLoginRequest request)
    {
        var settings = new GoogleJsonWebSignature.ValidationSettings
        {
            Audience = new List<string> { _configuration["Google:ClientId"]
                ?? throw new InvalidOperationException("Google ClientId is missing") }
        };

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(request.IdToken, settings);
        }
        catch (InvalidJwtException)
        {
            throw new UnauthorizedAccessException("Google Token không hợp lệ.");
        }

        var user = await _userRepository.GetByEmailAsync(payload.Email);
        if (user == null)
        {
            var qrCode = _qrCodeService.GenerateUniqueCode(5);
            user = new User
            {
                Id = Guid.NewGuid(),
                Username = payload.Email,
                Email = payload.Email,
                FullName = payload.Name,
                Role = Role.Driver,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()),
                QrCode = qrCode
            };
            await _userRepository.AddAsync(user);
        }

        return await BuildAuthResponse(user);
    }

    // ===== P0.2: REFRESH TOKEN =====
    public async Task<AuthResponse> RefreshTokenAsync(RefreshTokenRequest request)
    {
        // Tìm refresh token trong DB
        var storedToken = await _userRepository.GetRefreshTokenAsync(request.RefreshToken);
        if (storedToken == null)
            throw new UnauthorizedAccessException("Refresh token không hợp lệ.");

        if (storedToken.IsRevoked)
            throw new UnauthorizedAccessException("Refresh token đã bị thu hồi.");

        if (storedToken.ExpiresAt < DateTime.UtcNow)
            throw new UnauthorizedAccessException("Refresh token đã hết hạn. Vui lòng đăng nhập lại.");

        // Thu hồi token cũ
        storedToken.IsRevoked = true;
        await _userRepository.UpdateRefreshTokenAsync(storedToken);

        // Cấp token mới
        var user = storedToken.User;
        return await BuildAuthResponse(user);
    }

    // ===== P0.3: GET PROFILE =====
    public async Task<ProfileResponse> GetProfileAsync(Guid userId)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            throw new InvalidOperationException("Không tìm thấy người dùng.");

        return BuildProfileResponse(user);
    }

    // ===== P0.4: CHANGE PASSWORD =====
    public async Task ChangePasswordAsync(Guid userId, ChangePasswordRequest request)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            throw new InvalidOperationException("Không tìm thấy người dùng.");

        if (string.IsNullOrEmpty(user.Email))
            throw new InvalidOperationException("Tài khoản chưa có email để xác thực OTP.");

        // Xác thực mã OTP
        var isValid = await _otpService.VerifyOtpAsync(user.Email, request.OtpCode, "ChangePassword");
        if (!isValid)
            throw new InvalidOperationException("Mã OTP không hợp lệ hoặc đã hết hạn.");

        if (request.NewPassword.Length < 6)
            throw new InvalidOperationException("Mật khẩu mới phải có ít nhất 6 ký tự.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepository.UpdateAsync(user);
    }

    // ===== P1.1: ADMIN CREATE USER =====
    public async Task<ProfileResponse> AdminCreateUserAsync(AdminCreateUserRequest request)
    {
        var existing = await _userRepository.GetByUsernameAsync(request.Username);
        if (existing != null)
            throw new InvalidOperationException("Tên đăng nhập đã tồn tại.");

        if (!string.IsNullOrEmpty(request.Email))
        {
            var emailExists = await _userRepository.GetByEmailAsync(request.Email);
            if (emailExists != null)
                throw new InvalidOperationException("Email đã được đăng ký.");
        }

        var qrCode = _qrCodeService.GenerateUniqueCode(5);
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FullName = request.FullName,
            Role = request.Role, // Admin chọn role
            PhoneNumber = request.PhoneNumber,
            Email = request.Email,
            QrCode = qrCode
        };

        await _userRepository.AddAsync(user);
        return BuildProfileResponse(user);
    }

    // ===== P1.2: LOGOUT =====
    public async Task LogoutAsync(string refreshToken)
    {
        var storedToken = await _userRepository.GetRefreshTokenAsync(refreshToken);
        if (storedToken != null && !storedToken.IsRevoked)
        {
            storedToken.IsRevoked = true;
            await _userRepository.UpdateRefreshTokenAsync(storedToken);
        }
        // Không throw lỗi nếu token không tìm thấy (idempotent)
    }

    // ===== P1.3: UPDATE PROFILE =====
    public async Task<ProfileResponse> UpdateProfileAsync(Guid userId, UpdateProfileRequest request)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            throw new InvalidOperationException("Không tìm thấy người dùng.");

        // Chỉ cập nhật field được gửi (không null)
        if (request.FullName != null)
            user.FullName = request.FullName;

        if (request.PhoneNumber != null)
            user.PhoneNumber = request.PhoneNumber;

        if (request.Email != null)
        {
            // Kiểm tra email trùng (ngoại trừ user hiện tại)
            var emailUser = await _userRepository.GetByEmailAsync(request.Email);
            if (emailUser != null && emailUser.Id != userId)
                throw new InvalidOperationException("Email đã được sử dụng bởi tài khoản khác.");
            user.Email = request.Email;
        }

        user.UpdatedAt = DateTime.UtcNow;
        await _userRepository.UpdateAsync(user);
        return BuildProfileResponse(user);
    }

    // ===== HELPER: Tạo AuthResponse với cả Access + Refresh Token =====
    private async Task<AuthResponse> BuildAuthResponse(User user)
    {
        var expireHours = int.Parse(_configuration["JwtSettings:ExpireHours"] ?? "24");
        var accessToken = _tokenService.GenerateToken(user);
        var refreshToken = await CreateRefreshTokenAsync(user.Id);

        return new AuthResponse
        {
            UserId = user.Id,
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            AccessTokenExpiresAt = DateTime.UtcNow.AddHours(expireHours),
            FullName = user.FullName,
            Role = user.Role,
            Email = user.Email,
            QrCode = user.QrCode,
            QrCodeImageBase64 = !string.IsNullOrEmpty(user.QrCode)
                ? _qrCodeService.GenerateQrCodeBase64(user.QrCode)
                : null
        };
    }

    // ===== HELPER: Tạo và lưu Refresh Token =====
    private async Task<string> CreateRefreshTokenAsync(Guid userId)
    {
        // Sinh chuỗi ngẫu nhiên 64 bytes → Base64 (88 ký tự)
        var tokenBytes = RandomNumberGenerator.GetBytes(64);
        var tokenString = Convert.ToBase64String(tokenBytes);

        var refreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Token = tokenString,
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays),
            CreatedAt = DateTime.UtcNow
        };

        await _userRepository.AddRefreshTokenAsync(refreshToken);
        return tokenString;
    }

    // ===== HELPER: Tạo ProfileResponse =====
    private ProfileResponse BuildProfileResponse(User user)
    {
        return new ProfileResponse
        {
            UserId = user.Id,
            Username = user.Username,
            FullName = user.FullName,
            Role = user.Role,
            Email = user.Email,
            PhoneNumber = user.PhoneNumber,
            QrCode = user.QrCode,
            QrCodeImageBase64 = !string.IsNullOrEmpty(user.QrCode)
                ? _qrCodeService.GenerateQrCodeBase64(user.QrCode)
                : null,
            CreatedAt = user.CreatedAt
        };
    }

    // ===== OTP: GỬi mã OTP =====
    public async Task SendOtpAsync(SendOtpRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            throw new InvalidOperationException("Email không được để trống.");

        // Kiểm tra purpose hợp lệ
        if (request.Purpose != "Register" && request.Purpose != "ForgotPassword" && request.Purpose != "ChangePassword")
            throw new InvalidOperationException("Purpose phải là 'Register', 'ForgotPassword' hoặc 'ChangePassword'.");

        // Nếu quên mật khẩu hoặc đổi mật khẩu → kiểm tra email đã tồn tại trong hệ thống
        if (request.Purpose == "ForgotPassword" || request.Purpose == "ChangePassword")
        {
            var user = await _userRepository.GetByEmailAsync(request.Email);
            if (user == null)
                throw new InvalidOperationException("Email này chưa đăng ký tài khoản.");
        }

        // Nếu đăng ký → kiểm tra email chưa bị dùng
        if (request.Purpose == "Register")
        {
            var existing = await _userRepository.GetByEmailAsync(request.Email);
            if (existing != null)
                throw new InvalidOperationException("Email này đã được đăng ký.");
        }

        await _otpService.SendOtpAsync(request.Email, request.Purpose);
    }

    // ===== OTP: Đăng ký với xác thực OTP =====
    public async Task<AuthResponse> VerifyRegisterAsync(VerifyRegisterRequest request)
    {
        // Xác thực mã OTP
        var isValid = await _otpService.VerifyOtpAsync(request.Email, request.OtpCode, "Register");
        if (!isValid)
            throw new InvalidOperationException("Mã OTP không hợp lệ hoặc đã hết hạn.");

        // Kiểm tra username đã tồn tại chưa
        var existing = await _userRepository.GetByUsernameAsync(request.Username);
        if (existing != null)
            throw new InvalidOperationException("Tên đăng nhập đã tồn tại.");

        // Kiểm tra email đã tồn tại chưa
        var emailExists = await _userRepository.GetByEmailAsync(request.Email);
        if (emailExists != null)
            throw new InvalidOperationException("Email đã được đăng ký.");

        // Tạo tài khoản mới (email đã được xác thực)
        var qrCode = _qrCodeService.GenerateUniqueCode(5);
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FullName = request.FullName,
            Role = Role.Driver,
            PhoneNumber = request.PhoneNumber,
            Email = request.Email,
            QrCode = qrCode
        };

        await _userRepository.AddAsync(user);
        return await BuildAuthResponse(user);
    }

    // ===== OTP: Đặt lại mật khẩu =====
    public async Task ResetPasswordAsync(ResetPasswordRequest request)
    {
        // Xác thực mã OTP
        var isValid = await _otpService.VerifyOtpAsync(request.Email, request.OtpCode, "ForgotPassword");
        if (!isValid)
            throw new InvalidOperationException("Mã OTP không hợp lệ hoặc đã hết hạn.");

        // Tìm user theo email
        var user = await _userRepository.GetByEmailAsync(request.Email);
        if (user == null)
            throw new InvalidOperationException("Không tìm thấy tài khoản với email này.");

        if (request.NewPassword.Length < 6)
            throw new InvalidOperationException("Mật khẩu mới phải có ít nhất 6 ký tự.");

        // Cập nhật mật khẩu mới
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.FailedLoginCount = 0; // Reset lockout nếu bị khóa
        user.LockoutEnd = null;
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepository.UpdateAsync(user);
    }
}
