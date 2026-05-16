using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Entities;

public class ParkingSession : BaseEntity
{
    public Guid? DriverId { get; set; }
    public Guid? StaffId { get; set; }
    public Guid ParkingSlotId { get; set; }
    public Guid VehicleTypeId { get; set; }
    public Guid? ReservationId { get; set; }
    
    public string LicensePlate { get; set; } = string.Empty;
    public string SessionCode { get; set; } = string.Empty;
    public CheckInMethod CheckInMethod { get; set; } = CheckInMethod.WalkIn;
    public DateTime EntryTime { get; set; }
    public DateTime? ExitTime { get; set; }
    public decimal EstimatedFee { get; set; }
    public decimal TotalFee { get; set; }
    
    public SessionStatus Status { get; set; } = SessionStatus.Active;
    public IssueType IssueType { get; set; } = IssueType.None;

    public User? Driver { get; set; }
    public User? Staff { get; set; }
    public ParkingSlot ParkingSlot { get; set; } = null!;
    public VehicleType VehicleType { get; set; } = null!;
    public Reservation? Reservation { get; set; }
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
