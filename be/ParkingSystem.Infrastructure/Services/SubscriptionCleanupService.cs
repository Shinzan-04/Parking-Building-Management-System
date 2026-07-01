using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

/// <summary>
/// Background Service tự động xử lý gói cước chưa thanh toán quá hạn.
/// Chạy mỗi 5 phút, kiểm tra:
/// 
/// PendingPayment > 15 phút → Cancelled
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
        var now = DateTime.UtcNow;

        int cancelledCount = 0;

        var expiredPayment = await context.Subscriptions
            .Where(s => s.Status == SubscriptionStatus.PendingPayment
                     && s.CreatedAt.AddMinutes(PaymentTimeoutMinutes) < now)
            .ToListAsync();

        foreach (var sub in expiredPayment)
        {
            sub.Status = SubscriptionStatus.Canceled;
            sub.UpdatedAt = now;
            
            // Tìm payment liên quan nếu có
            if (sub.PaymentId.HasValue)
            {
                var payment = await context.Payments.FindAsync(sub.PaymentId.Value);
                if (payment != null && payment.Status == PaymentStatus.Pending)
                {
                    payment.Status = PaymentStatus.Failed;
                    payment.UpdatedAt = now;
                }
            }
            
            cancelledCount++;
        }

        if (cancelledCount > 0)
        {
            await context.SaveChangesAsync();
            _logger.LogInformation("🧹 Auto-cleanup Subscription: Đã hủy {Cancelled} gói vé tháng (quá hạn thanh toán {Timeout} phút).", cancelledCount, PaymentTimeoutMinutes);
        }
    }
}
