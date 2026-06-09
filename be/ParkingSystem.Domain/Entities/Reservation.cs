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

    /// <summary>
    /// Lý do từ chối (Staff ghi khi reject)
    /// </summary>
    public string? RejectReason { get; set; }

    /// <summary>
    /// Staff đã duyệt/từ chối reservation này
    /// </summary>
    public Guid? ReviewedByStaffId { get; set; }

    public User Driver { get; set; } = null!;
    public ParkingSlot ParkingSlot { get; set; } = null!;
    public VehicleType VehicleType { get; set; } = null!;
}
