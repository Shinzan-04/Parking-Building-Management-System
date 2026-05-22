namespace ParkingSystem.Application.DTOs.Payment;

public class PayOSCheckoutResponse
{
    public string CheckoutUrl { get; set; } = string.Empty;
    public long OrderCode { get; set; }
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
