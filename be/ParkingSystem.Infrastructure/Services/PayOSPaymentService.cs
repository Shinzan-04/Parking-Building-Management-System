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
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text;
using System.Security.Cryptography;

namespace ParkingSystem.Infrastructure.Services;

public class PayOSOptions
{
    public string ClientId { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string ChecksumKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.payos.vn";
    public string ReturnUrl { get; set; } = string.Empty;
    public string CancelUrl { get; set; } = string.Empty;
    public string PayoutMode { get; set; } = "Demo"; // "Demo" or "Production"
    
    // Payout (Chi hộ) Keys
    public string PayoutClientId { get; set; } = string.Empty;
    public string PayoutApiKey { get; set; } = string.Empty;
    public string PayoutChecksumKey { get; set; } = string.Empty;
}

public class PayOSPaymentService : IPaymentService
{
    private readonly ApplicationDbContext _context;
    private readonly PayOSOptions _options;
    private readonly ILogger<PayOSPaymentService> _logger;
    private readonly PayOSClient _payOSClient;
    private readonly IRealtimeService _realtimeService;
    private readonly INotificationService _notificationService;

    public PayOSPaymentService(
        ApplicationDbContext context,
        IOptions<PayOSOptions> options,
        ILogger<PayOSPaymentService> logger,
        IRealtimeService realtimeService,
        INotificationService notificationService)
    {
        _context = context;
        _options = options.Value;
        _logger = logger;
        _realtimeService = realtimeService;
        _notificationService = notificationService;
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
            UserId = request.IsWalletDeposit ? request.UserId : null,
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
                ReturnUrl = !string.IsNullOrWhiteSpace(request.ReturnUrl) ? request.ReturnUrl : _options.ReturnUrl,
                CancelUrl = !string.IsNullOrWhiteSpace(request.CancelUrl) ? request.CancelUrl : _options.CancelUrl,
                ExpiredAt = expiredAt
            };

            var result = await _payOSClient.PaymentRequests.CreateAsync(paymentRequest);

            _logger.LogInformation(
                "PayOS payment link created. OrderCode={OrderCode}, CheckoutUrl={CheckoutUrl}",
                orderCode, result.CheckoutUrl);

            return new PayOSCheckoutResponse
            {
                PaymentId = payment.Id,
                OrderCode = orderCode,
                Amount = request.Amount,
                Description = request.Description ?? string.Empty,
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

            // Xử lý nạp tiền vào ví (Top-up Wallet)
            Guid? walletUserId = null;
            decimal walletNewBalance = 0;
            if (payment.Status == PaymentStatus.Success && payment.UserId.HasValue && !payment.ReservationId.HasValue && !payment.ParkingSessionId.HasValue)
            {
                var user = await _context.Users.FindAsync(payment.UserId.Value);
                if (user != null)
                {
                    user.Balance += payment.Amount;
                    walletNewBalance = user.Balance;
                    walletUserId = user.Id;
                    _context.WalletTransactions.Add(new WalletTransaction
                    {
                        Id = Guid.NewGuid(),
                        UserId = user.Id,
                        Amount = payment.Amount,
                        Type = "Deposit",
                        Status = "Success",
                        Description = $"Nạp tiền vào ví qua PayOS (Order: {payment.PayOSOrderCode})",
                        ReferenceId = payment.PayOSOrderCode.ToString(),
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            await _context.SaveChangesAsync();

            // Push balance mới xuống client ngay sau khi cộng tiền thành công
            if (walletUserId.HasValue)
            {
                await _realtimeService.SendWalletUpdateAsync(walletUserId.Value, walletNewBalance);
            }

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

    public async Task<PaymentRefundResponse> RefundPaymentAsync(Guid paymentId)
    {
        var payment = await _context.Payments
            .IgnoreQueryFilters()
            .Include(p => p.Reservation)
            .Include(p => p.ParkingSession)
            .FirstOrDefaultAsync(p => p.Id == paymentId);

        if (payment == null)
            throw new KeyNotFoundException("Không tìm thấy giao dịch Payment.");

        // Bắt buộc trạng thái phải là Refunding mới cho hoàn tiền
        if (payment.Status != PaymentStatus.Refunding)
            throw new InvalidOperationException($"Không thể hoàn tiền. Trạng thái hiện tại của Payment là: {payment.Status}");

        // Chống Double Refund (Idempotency)
        if (!string.IsNullOrEmpty(payment.RefundReferenceId) || payment.Status == PaymentStatus.Refunded)
            throw new InvalidOperationException("Giao dịch này đã được hoàn tiền trước đó.");

        // Tạo mã tham chiếu duy nhất (idempotency key)
        string referenceId = $"RF_{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid().ToString().Substring(0, 6).ToUpper()}";
        
        try
        {
            // Cả Demo lẫn Production đều hoàn tiền vào ví người dùng
            {
                _logger.LogInformation("Bắt đầu hoàn tiền vào ví cho PaymentId={Id}, Amount={Amount}, Mode={Mode}", payment.Id, payment.Amount, _options.PayoutMode);

                Guid? driverId = payment.Reservation?.DriverId ?? payment.ParkingSession?.DriverId;

                if (driverId == null)
                    throw new InvalidOperationException("Không thể tìm thấy thông tin Driver để hoàn tiền.");

                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == driverId);
                if (user == null)
                    throw new InvalidOperationException("Không thể tìm thấy thông tin tài khoản để hoàn tiền.");

                // Thay vì chuyển khoản trực tiếp qua PayOS, cộng tiền vào Ví điện tử (Wallet)
                user.Balance += payment.Amount;

                var walletTx = new ParkingSystem.Domain.Entities.WalletTransaction
                {
                    UserId = user.Id,
                    Amount = payment.Amount,
                    Type = "Refund",
                    Status = "Success",
                    Description = $"Hoàn tiền cho giao dịch {(payment.PayOSOrderCode != 0 ? payment.PayOSOrderCode.ToString() : payment.Id.ToString())}",
                    RelatedPaymentId = payment.Id,
                    ReferenceId = referenceId
                };
                
                _context.WalletTransactions.Add(walletTx);

                payment.Status = PaymentStatus.Refunded;
                payment.RefundedAt = DateTime.UtcNow;
                payment.RefundReferenceId = referenceId;
                payment.RefundProvider = "Wallet";
                payment.RefundTransactionId = walletTx.Id.ToString();

                _logger.LogInformation("Hoàn tiền vào Ví thành công cho PaymentId={Id}, UserId={UserId}", payment.Id, user.Id);
            }

            // Gửi notification cho driver
            Guid? notifyDriverId = payment.Reservation?.DriverId ?? payment.ParkingSession?.DriverId;
            if (notifyDriverId.HasValue)
            {
                await _notificationService.SendAsync(
                    notifyDriverId.Value,
                    "💰 Hoàn tiền thành công",
                    $"Số tiền {payment.Amount:N0} VND đã được hoàn vào ví của bạn.",
                    "RefundSuccess",
                    payment.ReservationId);
            }

            if (payment.Reservation != null)
            {
                // Update logic nếu cần, ví dụ ghi log Reservation
            }

            payment.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return new PaymentRefundResponse
            {
                PaymentId = payment.Id,
                ReservationId = payment.ReservationId,
                Amount = payment.Amount,
                Status = payment.Status,
                Provider = payment.RefundProvider,
                ReferenceId = payment.RefundReferenceId,
                TransactionId = payment.RefundTransactionId,
                RefundedAt = payment.RefundedAt,
                Message = "Hoàn tiền thành công."
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi hoàn tiền cho PaymentId={Id}", payment.Id);
            
            payment.Status = PaymentStatus.RefundFailed;
            payment.RefundFailureReason = ex.Message;
            payment.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return new PaymentRefundResponse
            {
                PaymentId = payment.Id,
                ReservationId = payment.ReservationId,
                Amount = payment.Amount,
                Status = payment.Status,
                Message = $"Hoàn tiền thất bại: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Hàm public gọi API Payout của PayOS thông qua SDK PayOSClient
    /// SDK tự tính signature đúng chuẩn với Payout credentials
    /// </summary>
    public async Task<(bool Success, string TransactionId, string ErrorMessage)> ProcessPayoutAsync(decimal amount, string referenceId, UserBankAccount bankAccount)
    {
        try
        {
            // Tạo PayOSClient riêng với thông tin kênh Chi Hộ (Payout)
            var payoutClient = new PayOSClient(
                _options.PayoutClientId,
                _options.PayoutApiKey,
                _options.PayoutChecksumKey
            );

            // API yêu cầu camelCase (toBin, toAccountNumber, referenceId)
            // Lưu ý: Thông báo lỗi của API in ra snake_case (như to_bin) do thư viện validator của họ tự format, nhưng field gửi đi PHẢI là camelCase!
            var payload = new Dictionary<string, object>
            {
                { "toBin", bankAccount.BankBin },
                { "toAccountNumber", bankAccount.AccountNumber },
                { "amount", (int)amount },
                { "description", "Hoan tien gui xe" },
                { "referenceId", referenceId.ToString() }
            };

            _logger.LogInformation("=== PAYOUT via SDK === toAccountNumber={num} | amount={amt} | toBin={bin} | referenceId={ref}",
                payload["toAccountNumber"], payload["amount"], payload["toBin"], payload["referenceId"]);




            // Dùng đúng SDK CryptoProvider.CreateSignature cho Payout (header signature type)
            // EncodeUri=true (mặc định) → khoảng trắng thành %20, KHÔNG phải +
            var cryptoOptions = new PayOS.Crypto.CryptoSignatureOptions { EncodeUri = true };
            var signature = payoutClient.Crypto.CreateSignature(_options.PayoutChecksumKey, payload, cryptoOptions);
            _logger.LogInformation("SDK Payout Signature (EncodeUri=true): {sig}", signature);

            // Gọi HTTP với signature do SDK tính
            using var httpClient = new HttpClient();
            httpClient.BaseAddress = new Uri("https://api-merchant.payos.vn");
            
            var jsonPayload = JsonSerializer.Serialize(payload);
            _logger.LogInformation("Actual JSON Payload sent to PayOS: {json}", jsonPayload);

            var request = new HttpRequestMessage(HttpMethod.Post, "/v1/payouts");

            request.Headers.Add("x-client-id", _options.PayoutClientId);
            request.Headers.Add("x-api-key", _options.PayoutApiKey);
            request.Headers.Add("x-signature", signature);
            request.Headers.Add("x-idempotency-key", referenceId);
            request.Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

            var httpResponse = await httpClient.SendAsync(request);
            var responseStr = await httpResponse.Content.ReadAsStringAsync();
            _logger.LogInformation("PayOS Payout HTTP Response: {status} | Body: {body}", httpResponse.StatusCode, responseStr);

            using var doc = JsonDocument.Parse(responseStr);
            var code = doc.RootElement.TryGetProperty("code", out var codeProp) ? codeProp.GetString() : null;
            
            if (code == "00")
                return (true, referenceId, string.Empty);
            
            var desc = doc.RootElement.TryGetProperty("desc", out var descProp) ? descProp.GetString() : responseStr;
            return (false, string.Empty, $"PayOS Code {code} - {desc}");

        }

        catch (Exception ex)
        {
            _logger.LogWarning("PayOS SDK Payout exception: {msg}", ex.Message);
            return (false, string.Empty, ex.Message);
        }
    }


    public async Task RejectRefundAsync(Guid paymentId, string reason)
    {
        var payment = await _context.Payments
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == paymentId)
            ?? throw new KeyNotFoundException("Không tìm thấy giao dịch Payment.");

        if (payment.Status != PaymentStatus.Refunding)
            throw new InvalidOperationException($"Không thể từ chối hoàn tiền. Trạng thái hiện tại: {payment.Status}");

        payment.Status = PaymentStatus.RefundFailed;
        payment.RefundFailureReason = string.IsNullOrWhiteSpace(reason) ? "Bị từ chối bởi quản trị viên." : reason;
        payment.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // Notify driver
        var paymentFull = await _context.Payments
            .IgnoreQueryFilters()
            .Include(p => p.Reservation)
            .Include(p => p.ParkingSession)
            .FirstOrDefaultAsync(p => p.Id == paymentId);

        Guid? driverId = paymentFull?.Reservation?.DriverId ?? paymentFull?.ParkingSession?.DriverId;
        if (driverId.HasValue)
        {
            await _notificationService.SendAsync(
                driverId.Value,
                "❌ Yêu cầu hoàn tiền bị từ chối",
                $"Yêu cầu hoàn tiền {payment.Amount:N0} VND đã bị từ chối. Lý do: {payment.RefundFailureReason}",
                "RefundRejected",
                paymentFull?.ReservationId);
        }

        _logger.LogInformation("Refund rejected for PaymentId={PaymentId}. Reason={Reason}", paymentId, reason);
    }

    public async Task<PaymentListResult> GetPaymentsAsync(PaymentListQuery query)
    {
        var q = _context.Payments
            .IgnoreQueryFilters()
            .Include(p => p.Reservation).ThenInclude(r => r != null ? r.Driver : null!)
            .Include(p => p.ParkingSession).ThenInclude(s => s != null ? s.Driver : null!)
            .Include(p => p.User)
            .AsQueryable();

        if (!string.IsNullOrEmpty(query.Status) &&
            Enum.TryParse<PaymentStatus>(query.Status, ignoreCase: true, out var statusEnum))
        {
            q = q.Where(p => p.Status == statusEnum);
        }

        var totalCount = await q.CountAsync();

        var items = await q
            .OrderByDescending(p => p.PaymentDate)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(p => new PaymentListItemDto
            {
                PaymentId = p.Id,
                PayOSOrderCode = p.PayOSOrderCode,
                Amount = p.Amount,
                Description = p.Description,
                Status = p.Status.ToString(),
                PaymentMethod = p.PaymentMethod.ToString(),
                PaymentDate = p.PaymentDate,
                ReservationId = p.ReservationId,
                ParkingSessionId = p.ParkingSessionId,
                UserId = p.UserId
                    ?? (p.Reservation != null ? p.Reservation.DriverId : (Guid?)null)
                    ?? (p.ParkingSession != null ? p.ParkingSession.DriverId : (Guid?)null),
                UserFullName = p.User != null ? p.User.FullName
                    : p.Reservation != null && p.Reservation.Driver != null ? p.Reservation.Driver.FullName
                    : p.ParkingSession != null && p.ParkingSession.Driver != null ? p.ParkingSession.Driver.FullName
                    : null,
                UserEmail = p.User != null ? p.User.Email
                    : p.Reservation != null && p.Reservation.Driver != null ? p.Reservation.Driver.Email
                    : p.ParkingSession != null && p.ParkingSession.Driver != null ? p.ParkingSession.Driver.Email
                    : null,
                RefundedAt = p.RefundedAt,
                RefundReferenceId = p.RefundReferenceId,
                RefundProvider = p.RefundProvider,
                RefundTransactionId = p.RefundTransactionId,
                RefundFailureReason = p.RefundFailureReason,
            })
            .ToListAsync();

        return new PaymentListResult
        {
            Items = items,
            TotalCount = totalCount,
            Page = query.Page,
            PageSize = query.PageSize,
        };
    }

    private string CreateSignature(string data, string key)
    {
        // Cách 1: Dùng key dạng UTF-8 string (cách hiện tại)
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return BitConverter.ToString(hash).Replace("-", "").ToLower();
    }

    private string CreateSignatureFromHexKey(string data, string hexKey)
    {
        // Cách 2: Decode key từ HEX string thành bytes trước (b4e609... → byte[])
        // Vì PayOS ChecksumKey là chuỗi hex 64 ký tự (32 bytes thực)
        var keyBytes = Convert.FromHexString(hexKey);
        using var hmac = new HMACSHA256(keyBytes);
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return BitConverter.ToString(hash).Replace("-", "").ToLower();
    }
}
