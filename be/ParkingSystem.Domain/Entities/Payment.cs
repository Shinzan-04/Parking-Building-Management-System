using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Entities;

public class Payment : BaseEntity
{
    public long PayOSOrderCode { get; set; }
    public Guid? ParkingSessionId { get; set; }
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    public DateTime PaymentDate { get; set; }
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.PayOS;
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;

    public ParkingSession? ParkingSession { get; set; }
}
