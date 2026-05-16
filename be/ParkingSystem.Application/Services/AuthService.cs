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
    private readonly IConfiguration _configuration;

    public AuthService(IUserRepository userRepository, ITokenService tokenService, IQrCodeService qrCodeService, IConfiguration configuration)
    {
        _userRepository = userRepository;
        _tokenService = tokenService;
        _qrCodeService = qrCodeService;
        _configuration = configuration;
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var user = await _userRepository.GetByUsernameAsync(request.Username);
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("Invalid username or password.");
        }

        return new AuthResponse
        {
            UserId = user.Id,
            Token = _tokenService.GenerateToken(user),
            FullName = user.FullName,
            Role = user.Role
        };
    }

    public async Task<RegisterResponse> RegisterAsync(RegisterRequest request)
    {
        // Check if username already exists
        var existing = await _userRepository.GetByUsernameAsync(request.Username);
        if (existing != null)
        {
            throw new InvalidOperationException("Username already exists.");
        }

        // Check if email already exists
        if (!string.IsNullOrEmpty(request.Email))
        {
            var emailExists = await _userRepository.GetByEmailAsync(request.Email);
            if (emailExists != null)
            {
                throw new InvalidOperationException("Email already registered.");
            }
        }

        // Generate unique 5-char QR code
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

        // Generate QR code image as Base64
        var qrImageBase64 = _qrCodeService.GenerateQrCodeBase64(qrCode);

        return new RegisterResponse
        {
            UserId = user.Id,
            Token = _tokenService.GenerateToken(user),
            FullName = user.FullName,
            Role = user.Role,
            QrCode = qrCode,
            QrCodeImageBase64 = qrImageBase64
        };
    }

    public async Task<AuthResponse> GoogleLoginAsync(GoogleLoginRequest request)
    {
        var settings = new GoogleJsonWebSignature.ValidationSettings
        {
            Audience = new List<string> { _configuration["Google:ClientId"] ?? throw new InvalidOperationException("Google ClientId is missing") }
        };

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(request.IdToken, settings);
        }
        catch (InvalidJwtException)
        {
            throw new UnauthorizedAccessException("Invalid Google Token.");
        }

        var user = await _userRepository.GetByEmailAsync(payload.Email);
        if (user == null)
        {
            // Auto register for Driver with QR code
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

        return new AuthResponse
        {
            UserId = user.Id,
            Token = _tokenService.GenerateToken(user),
            FullName = user.FullName,
            Role = user.Role
        };
    }
}
