using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ParkingSystem.Application.DTOs.Payment;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;
using PayOS;
using PayOS.Models;
using PayOS.Models.V2.PaymentRequests;
using PayOS.Models.Webhooks;

namespace ParkingSystem.Infrastructure.Services;

public class PayOSOptions
{
    public string ClientId { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string ChecksumKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.payos.vn";
}

public class PayOSPaymentService : IPaymentService
{
    private readonly ApplicationDbContext _context;
    private readonly PayOSOptions _options;
    private readonly ILogger<PayOSPaymentService> _logger;
    private readonly PayOSClient _payOSClient;

    public PayOSPaymentService(
        ApplicationDbContext context,
        IOptions<PayOSOptions> options,
        ILogger<PayOSPaymentService> logger)
    {
        _context = context;
        _options = options.Value;
        _logger = logger;
        _payOSClient = new PayOSClient(_options.ClientId, _options.ApiKey, _options.ChecksumKey);
    }

    public async Task<PayOSCheckoutResponse> CreatePayOSPaymentAsync(CreatePayOSPaymentRequest request)
    {
        if (request.Amount <= 0)
            throw new ArgumentException("Amount must be greater than 0.");

        var orderCode = GenerateUniqueOrderCode();

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            PayOSOrderCode = orderCode,
            Amount = request.Amount,
            Description = request.Description,
            PaymentDate = DateTime.UtcNow,
            PaymentMethod = PaymentMethod.PayOS,
            Status = PaymentStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Payments.Add(payment);
        await _context.SaveChangesAsync();

        try
        {
            var expiredAt = DateTimeOffset.UtcNow.AddHours(24).ToUnixTimeSeconds();

            var paymentRequest = new CreatePaymentLinkRequest
            {
                OrderCode = orderCode,
                Amount = (int)request.Amount,
                Description = request.Description,
                ReturnUrl = $"{_options.BaseUrl}/return",
                CancelUrl = $"{_options.BaseUrl}/cancel",
                ExpiredAt = expiredAt
            };

            var result = await _payOSClient.PaymentRequests.CreateAsync(paymentRequest);

            _logger.LogInformation(
                "PayOS payment link created. OrderCode={OrderCode}, CheckoutUrl={CheckoutUrl}",
                orderCode, result.CheckoutUrl);

            return new PayOSCheckoutResponse
            {
                OrderCode = orderCode,
                Amount = request.Amount,
                Description = request.Description,
                CheckoutUrl = result.CheckoutUrl ?? string.Empty,
                CreatedAt = payment.CreatedAt
            };
        }
        catch (Exception ex)
        {
            payment.Status = PaymentStatus.Failed;
            payment.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogError(ex, "Failed to create PayOS payment link for OrderCode={OrderCode}", orderCode);
            throw new InvalidOperationException($"Failed to create PayOS payment link: {ex.Message}");
        }
    }

    public async Task<bool> ProcessPayOSWebhookAsync(System.Text.Json.JsonElement webhookData)
    {
        try
        {
            var jsonString = webhookData.GetRawText();
            var webhook = System.Text.Json.JsonSerializer.Deserialize<PayOS.Models.Webhooks.Webhook>(
                jsonString, 
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            );

            if (webhook == null) return false;

            var verifiedData = await _payOSClient.Webhooks.VerifyAsync(webhook);

            var payment = await _context.Payments
                .FirstOrDefaultAsync(p => p.PayOSOrderCode == verifiedData.OrderCode);

            if (payment == null)
            {
                _logger.LogWarning("Payment not found for OrderCode={OrderCode}", verifiedData.OrderCode);
                // Return true so PayOS doesn't treat this as an inactive/failed webhook, 
                // especially useful for PayOS test webhooks from dashboard.
                return true; 
            }

            if (payment.Status != PaymentStatus.Pending)
            {
                _logger.LogInformation(
                    "Webhook already processed (idempotent). OrderCode={OrderCode}, CurrentStatus={Status}",
                    verifiedData.OrderCode, payment.Status);
                return true;
            }

            payment.Status = verifiedData.Code == "00" || verifiedData.Code == "07"
                ? PaymentStatus.Success
                : PaymentStatus.Failed;
            payment.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "PayOS webhook processed. OrderCode={OrderCode}, NewStatus={Status}",
                verifiedData.OrderCode, payment.Status);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process PayOS webhook");
            return false;
        }
    }

    private long GenerateUniqueOrderCode()
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var random = Random.Shared.Next(1000, 9999);
        return long.Parse($"{timestamp}{random}");
    }
}
