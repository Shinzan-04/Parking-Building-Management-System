using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Entities;

public class User : BaseEntity
{
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public Role Role { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }

    public ICollection<ParkingSession> DriverSessions { get; set; } = new List<ParkingSession>();
    public ICollection<ParkingSession> HandledSessions { get; set; } = new List<ParkingSession>();
    public ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();
}
