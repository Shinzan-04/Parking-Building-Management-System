using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.DTOs.Auth;

public class RegisterRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
}

public class RegisterResponse
{
    public Guid UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public Role Role { get; set; }
    public string QrCode { get; set; } = string.Empty;
    public string QrCodeImageBase64 { get; set; } = string.Empty;
}
