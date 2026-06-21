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
    public string ReturnUrl { get; set; } = string.Empty;
    public string CancelUrl { get; set; } = string.Empty;
}

public class PayOSPaymentService : IPaymentService
{
    private readonly ApplicationDbContext _context;
    private readonly PayOSOptions _options;
    private readonly ILogger<PayOSPaymentService> _logger;
    private readonly PayOSClient _payOSClient;
    private readonly IRealtimeService _realtimeService;

    public PayOSPaymentService(
        ApplicationDbContext context,
        IOptions<PayOSOptions> options,
        ILogger<PayOSPaymentService> logger,
        IRealtimeService realtimeService)
    {
        _context = context;
        _options = options.Value;
        _logger = logger;
        _realtimeService = realtimeService;
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
            ParkingSessionId = request.ParkingSessionId,
            ReservationId = request.ReservationId,
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

            var safeDescription = request.Description ?? "THANH TOAN";
            // Bỏ ký tự đặc biệt, chỉ lấy chữ và số, tối đa 25 ký tự (Theo tài liệu PayOS)
            safeDescription = new string(safeDescription.Where(c => char.IsLetterOrDigit(c) || char.IsWhiteSpace(c)).ToArray());
            if (safeDescription.Length > 25) safeDescription = safeDescription.Substring(0, 25);

            var paymentRequest = new CreatePaymentLinkRequest
            {
                OrderCode = orderCode,
                Amount = (int)request.Amount,
                Description = safeDescription.Trim(),
                ReturnUrl = _options.ReturnUrl,
                CancelUrl = _options.CancelUrl,
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

            var shouldNotifyPaymentSuccess = false;
            var reservationIdToNotify = Guid.Empty;

            // Nếu thanh toán cho Reservation và thành công -> Cập nhật Reservation sang PendingReview
            if (payment.Status == PaymentStatus.Success && payment.ReservationId.HasValue)
            {
                var reservation = await _context.Reservations
                    .Include(r => r.ParkingSlot)
                        .ThenInclude(s => s.Floor)
                            .ThenInclude(f => f.Building)
                    .FirstOrDefaultAsync(r => r.Id == payment.ReservationId.Value);

                if (reservation != null && reservation.Status == ReservationStatus.PaymentPending)
                {
                    var approvalMode = reservation.ParkingSlot?.Floor?.Building?.ApprovalMode ?? ReservationApprovalMode.Manual;
                    if (approvalMode == ReservationApprovalMode.AutoApprove)
                    {
                        reservation.Status = ReservationStatus.Confirmed;
                        _context.ReservationLogs.Add(new ReservationLog
                        {
                            Id = Guid.NewGuid(),
                            ReservationId = reservation.Id,
                            Action = "AutoApproved",
                            StatusSnapshot = ReservationStatus.Confirmed,
                            Note = "Tự động duyệt sau khi thanh toán",
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                    else
                    {
                        reservation.Status = ReservationStatus.PendingReview;
                        _context.ReservationLogs.Add(new ReservationLog
                        {
                            Id = Guid.NewGuid(),
                            ReservationId = reservation.Id,
                            Action = "PaymentSuccess",
                            StatusSnapshot = ReservationStatus.PendingReview,
                            Note = "Thanh toán PayOS thành công (Webhook)",
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                    reservation.UpdatedAt = DateTime.UtcNow;
                }
                
                shouldNotifyPaymentSuccess = true;
                reservationIdToNotify = payment.ReservationId.Value;
            }

            await _context.SaveChangesAsync();

            // Bắn thông báo Realtime SignalR cho App Driver SAU KHI đã lưu DB thành công
            if (shouldNotifyPaymentSuccess)
            {
                await _realtimeService.SendPaymentSuccessAsync(reservationIdToNotify);
            }

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

    public async Task<PaymentStatusResult?> GetPaymentStatusBySessionIdAsync(Guid sessionId)
    {
        var payment = await _context.Payments
            .Where(p => p.ParkingSessionId == sessionId && p.PaymentMethod == PaymentMethod.PayOS)
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync();

        if (payment == null)
            return null;

        var label = payment.Status switch
        {
            PaymentStatus.Pending => "DANG CHO THANH TOAN",
            PaymentStatus.Success => "DA THANH TOAN",
            PaymentStatus.Failed => "THANH TOAN THAT BAI",
            _ => payment.Status.ToString().ToUpper()
        };

        return new PaymentStatusResult
        {
            SessionId = sessionId,
            PaymentStatus = payment.Status.ToString(),
            PaymentMethod = payment.PaymentMethod.ToString(),
            Amount = payment.Amount,
            PaymentDate = payment.PaymentDate,
            PayOSOrderCode = payment.PayOSOrderCode,
            StatusLabel = label
        };
    }

    private long GenerateUniqueOrderCode()
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var random = Random.Shared.Next(1000, 9999);
        return long.Parse($"{timestamp}{random}");
    }

    public async Task<(bool Success, PaymentStatus Status)> VerifyPayOSPaymentAsync(long orderCode)
    {
        try
        {
            var paymentInfo = await _payOSClient.PaymentRequests.GetAsync(orderCode);

            if (paymentInfo == null)
            {
                _logger.LogWarning("PayOS API returned null for OrderCode={OrderCode}", orderCode);
                return (false, PaymentStatus.Pending);
            }

            var statusStr = paymentInfo.Status.ToString().ToUpperInvariant();
            PaymentStatus status;
            if (statusStr == "PAID")
                status = PaymentStatus.Success;
            else if (statusStr == "CANCELLED" || statusStr == "EXPIRED" || statusStr == "FAILED")
                status = PaymentStatus.Failed;
            else
                status = PaymentStatus.Pending;

            _logger.LogInformation(
                "PayOS direct verify. OrderCode={OrderCode}, StatusStr={StatusStr} -> {Status}",
                orderCode, statusStr, status);

            return (true, status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to verify PayOS payment via API. OrderCode={OrderCode}", orderCode);
            return (false, PaymentStatus.Pending);
        }
    }
}
