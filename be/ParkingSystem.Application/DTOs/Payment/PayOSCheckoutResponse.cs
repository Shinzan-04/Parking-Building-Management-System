namespace ParkingSystem.Application.DTOs.Payment;

public class PayOSCheckoutResponse
{
    public string CheckoutUrl { get; set; } = string.Empty;
    /// <summary>Chuỗi QR EMVCo/VietQR thật từ PayOS — dùng để render QR có thể quét bằng app ngân hàng</summary>
    public string QrCode { get; set; } = string.Empty;
    public Guid PaymentId { get; set; }
    public long OrderCode { get; set; }
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
