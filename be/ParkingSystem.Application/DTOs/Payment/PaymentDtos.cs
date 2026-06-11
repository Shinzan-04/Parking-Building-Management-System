namespace ParkingSystem.Application.DTOs.Payment;

public class CreatePayOSPaymentRequest
{
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public Guid? ParkingSessionId { get; set; }
}

public class PaymentStatusResult
{
    public Guid SessionId { get; set; }
    public string PaymentStatus { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public decimal? Amount { get; set; }
    public DateTime? PaymentDate { get; set; }
    public long PayOSOrderCode { get; set; }
    public string StatusLabel { get; set; } = string.Empty;
}
