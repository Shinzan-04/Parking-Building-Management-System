using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Entities;

public class Payment : BaseEntity
{
    public long PayOSOrderCode { get; set; }
    public Guid? ParkingSessionId { get; set; }
    public Guid? ReservationId { get; set; }
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    public DateTime PaymentDate { get; set; }
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.PayOS;
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;

    // --- Thông tin hoàn tiền (Refund) ---
    public DateTime? RefundedAt { get; set; }
    public string? RefundReferenceId { get; set; }
    public string? RefundProvider { get; set; }
    public string? RefundTransactionId { get; set; }
    public string? RefundFailureReason { get; set; }

    public ParkingSession? ParkingSession { get; set; }
    public Reservation? Reservation { get; set; }
}
