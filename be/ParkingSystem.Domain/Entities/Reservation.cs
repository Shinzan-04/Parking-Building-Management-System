using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Entities;

public class Reservation : BaseEntity
{
    public Guid DriverId { get; set; }
    public Guid ParkingSlotId { get; set; }
    public Guid VehicleTypeId { get; set; }
    
    public string BookingCode { get; set; } = string.Empty;
    public string LicensePlate { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public ReservationStatus Status { get; set; } = ReservationStatus.Pending;

    public User Driver { get; set; } = null!;
    public ParkingSlot ParkingSlot { get; set; } = null!;
    public VehicleType VehicleType { get; set; } = null!;
}
