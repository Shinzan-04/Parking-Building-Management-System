using ParkingSystem.Application.DTOs.Payment;
using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.Interfaces;

public interface IPaymentService
{
    Task<PayOSCheckoutResponse> CreatePayOSPaymentAsync(CreatePayOSPaymentRequest request);
    Task<bool> ProcessPayOSWebhookAsync(System.Text.Json.JsonElement webhookData);
    Task<PaymentStatusResult?> GetPaymentStatusBySessionIdAsync(Guid sessionId);
    Task<(bool Success, PaymentStatus Status)> VerifyPayOSPaymentAsync(long orderCode);
}
