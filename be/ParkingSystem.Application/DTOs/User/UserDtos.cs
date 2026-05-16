using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.DTOs.User;

public class CreateUserRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public Role Role { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
}

public class UpdateUserRequest
{
    public string FullName { get; set; } = string.Empty;
    public Role Role { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
}

public class UserResponse
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public Role Role { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string QrCode { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
