using System.ComponentModel.DataAnnotations.Schema;
using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Entities;

public class ParkingSlot : BaseEntity
{
    public Guid FloorId { get; set; }
    public Guid VehicleTypeId { get; set; }
    public string SlotNumber { get; set; } = string.Empty;
    public SlotStatus Status { get; set; } = SlotStatus.Available;

    [NotMapped]
    public int Row { get; set; }

    [NotMapped]
    public int Column { get; set; }

    [NotMapped]
    public int DistanceToEntry { get; set; }

    public Floor Floor { get; set; } = null!;
    public VehicleType VehicleType { get; set; } = null!;
    public ICollection<ParkingSession> ParkingSessions { get; set; } = new List<ParkingSession>();
    public ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();
}
