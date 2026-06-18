using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Entities;

public class Reservation : BaseEntity
{
    public Guid DriverId { get; set; }
    public Guid ParkingSlotId { get; set; }
    public Guid VehicleTypeId { get; set; }
    public Guid? VehicleId { get; set; }
    
    public string BookingCode { get; set; } = string.Empty;
    public string LicensePlate { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public ReservationStatus Status { get; set; } = ReservationStatus.PaymentPending;
    public BookingMethod BookingMethod { get; set; } = BookingMethod.Manual;

    /// <summary>
    /// Điểm AI đánh giá khi dùng chế độ AIRecommended
    /// </summary>
    public double? AIScore { get; set; }

    /// <summary>
    /// Lý do AI gợi ý slot này
    /// </summary>
    public string? AIReason { get; set; }

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
    public Vehicle? Vehicle { get; set; }
    
    public ICollection<ReservationLog> Logs { get; set; } = new List<ReservationLog>();
}
