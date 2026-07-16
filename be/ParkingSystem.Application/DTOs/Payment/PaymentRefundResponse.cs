using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.DTOs.Payment;

public class PaymentRefundResponse
{
    public Guid PaymentId { get; set; }
    public Guid? ReservationId { get; set; }
    public decimal Amount { get; set; }
    public PaymentStatus Status { get; set; }
    public string? Provider { get; set; }
    public string? ReferenceId { get; set; }
    public string? TransactionId { get; set; }
    public DateTime? RefundedAt { get; set; }
    public string? Message { get; set; }
}
