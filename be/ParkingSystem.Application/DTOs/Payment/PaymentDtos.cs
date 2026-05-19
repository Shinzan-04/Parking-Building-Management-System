namespace ParkingSystem.Application.DTOs.Payment;

public class CreatePayOSPaymentRequest
{
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
}
