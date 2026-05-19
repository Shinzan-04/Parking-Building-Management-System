using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.DTOs.Payment;

public class PaymentDto
{
    public Guid Id { get; set; }
    public long PayOSOrderCode { get; set; }
    public Guid? ParkingSessionId { get; set; }
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    public DateTime PaymentDate { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public PaymentStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
}
