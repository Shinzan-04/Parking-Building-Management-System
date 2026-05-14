using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.DTOs.Auth;

public class AuthResponse
{
    public Guid UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public Role Role { get; set; }
}
