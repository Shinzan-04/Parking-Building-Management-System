using ParkingSystem.Application.DTOs.Payment;
using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.Interfaces;

public interface IPaymentService
{
    Task<PayOSCheckoutResponse> CreatePayOSPaymentAsync(CreatePayOSPaymentRequest request);
    Task<bool> ProcessPayOSWebhookAsync(System.Text.Json.JsonElement webhookData);
    Task<PaymentStatusResult?> GetPaymentStatusBySessionIdAsync(Guid sessionId);
    Task<(bool Success, PaymentStatus Status)> VerifyPayOSPaymentAsync(long orderCode);
    Task<PaymentRefundResponse> RefundPaymentAsync(Guid paymentId);
    Task<(bool Success, string TransactionId, string ErrorMessage)> ProcessPayoutAsync(decimal amount, string referenceId, ParkingSystem.Domain.Entities.UserBankAccount bankAccount);
    Task<PaymentListResult> GetPaymentsAsync(PaymentListQuery query);
    Task<TransactionHistoryResult> GetTransactionHistoryAsync(TransactionHistoryQuery query);
    Task RejectRefundAsync(Guid paymentId, string reason);
}
