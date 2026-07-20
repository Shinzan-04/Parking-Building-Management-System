using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

/// <summary>
/// Background Service tự động xử lý gói cước chưa thanh toán quá hạn.
/// Chạy mỗi 5 phút, kiểm tra:
///
/// PendingPayment > 15 phút → verify với PayOS trước khi hủy:
///   - Nếu PayOS báo đã thanh toán (PAID) → kích hoạt vé thay vì hủy
///     (tránh hủy nhầm giao dịch đã thanh toán thật do webhook/verify bị trễ)
///   - Ngược lại → Cancelled
/// </summary>
public class SubscriptionCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SubscriptionCleanupService> _logger;

    private const int PaymentTimeoutMinutes = 15;
    private const int ScanIntervalMinutes = 5;

    public SubscriptionCleanupService(IServiceScopeFactory scopeFactory, ILogger<SubscriptionCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("🔄 SubscriptionCleanupService đã khởi động. Quét mỗi {Interval} phút.", ScanIntervalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupExpiredSubscriptionsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Lỗi khi quét vé tháng hết hạn thanh toán.");
            }

            await Task.Delay(TimeSpan.FromMinutes(ScanIntervalMinutes), stoppingToken);
        }

        _logger.LogInformation("🛑 SubscriptionCleanupService đã dừng.");
    }

    private async Task CleanupExpiredSubscriptionsAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var paymentService = scope.ServiceProvider.GetRequiredService<IPaymentService>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
        var now = DateTime.UtcNow;

        int cancelledCount = 0;
        int activatedCount = 0;

        var expiredPayment = await context.Subscriptions
            .Where(s => s.Status == SubscriptionStatus.PendingPayment
                     && s.CreatedAt.AddMinutes(PaymentTimeoutMinutes) < now)
            .ToListAsync();

        foreach (var sub in expiredPayment)
        {
            var payment = sub.PaymentId.HasValue
                ? await context.Payments.FindAsync(sub.PaymentId.Value)
                : null;

            // Trước khi hủy, verify trực tiếp với PayOS — tránh hủy nhầm giao dịch đã
            // thanh toán thật nhưng webhook/verify FE chưa kịp xử lý trước khi hết hạn.
            if (payment != null && payment.PaymentMethod == PaymentMethod.PayOS)
            {
                var (_, status) = await paymentService.VerifyPayOSPaymentAsync(payment.PayOSOrderCode);
                if (status == PaymentStatus.Success)
                {
                    payment.Status = PaymentStatus.Success;
                    payment.UpdatedAt = now;
                    sub.Status = SubscriptionStatus.Active;
                    sub.UpdatedAt = now;
                    activatedCount++;

                    await notificationService.SendAsync(
                        sub.DriverId,
                        "Monthly Pass Activated",
                        $"The monthly pass for vehicle {sub.LicensePlate} has been successfully paid and is valid until {sub.EndDate:dd/MM/yyyy}.",
                        "SubscriptionActivated",
                        sub.Id
                    );
                    continue;
                }
            }

            sub.Status = SubscriptionStatus.Canceled;
            sub.UpdatedAt = now;

            if (payment != null && payment.Status == PaymentStatus.Pending)
            {
                payment.Status = PaymentStatus.Failed;
                payment.UpdatedAt = now;
            }

            cancelledCount++;
        }

        if (cancelledCount > 0 || activatedCount > 0)
        {
            await context.SaveChangesAsync();
            _logger.LogInformation(
                "🧹 Auto-cleanup Subscription: Đã hủy {Cancelled}, kích hoạt {Activated} gói vé tháng (quá hạn thanh toán {Timeout} phút).",
                cancelledCount, activatedCount, PaymentTimeoutMinutes);
        }
    }
}
