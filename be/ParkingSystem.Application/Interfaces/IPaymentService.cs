using ParkingSystem.Application.DTOs.Payment;

namespace ParkingSystem.Application.Interfaces;

public interface IPaymentService
{
    Task<PayOSCheckoutResponse> CreatePayOSPaymentAsync(CreatePayOSPaymentRequest request);
    Task<bool> ProcessPayOSWebhookAsync(System.Text.Json.JsonElement webhookData);
}
