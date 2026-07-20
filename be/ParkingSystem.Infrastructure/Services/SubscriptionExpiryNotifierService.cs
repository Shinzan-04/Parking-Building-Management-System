using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

public class SubscriptionExpiryNotifierService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SubscriptionExpiryNotifierService> _logger;

    public SubscriptionExpiryNotifierService(IServiceProvider serviceProvider, ILogger<SubscriptionExpiryNotifierService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("SubscriptionExpiryNotifierService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

                var now = DateTime.UtcNow;
                var warningTime = now.AddHours(24);

                var expiringSubs = await context.Subscriptions
                    .Where(s => s.Status == SubscriptionStatus.Active &&
                                !s.ExpiryWarningSent &&
                                s.EndDate <= warningTime &&
                                s.EndDate > now)
                    .ToListAsync(stoppingToken);

                foreach (var sub in expiringSubs)
                {
                    try 
                    {
                        await notificationService.SendAsync(
                            sub.DriverId,
                            "⏳ Monthly Pass Expiring Soon",
                            $"Your monthly pass for vehicle {sub.LicensePlate} will expire on {sub.EndDate:dd/MM/yyyy}. Please renew it soon to avoid overdue fees.",
                            "SubscriptionExpiryWarning",
                            sub.Id);

                        sub.ExpiryWarningSent = true;
                    } 
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, $"Failed to process expiry warning for subscription {sub.Id}");
                    }
                }

                // 2. Xử lý các vé đã hết hạn
                var expiredSubs = await context.Subscriptions
                    .Where(s => s.Status == SubscriptionStatus.Active &&
                                s.EndDate <= now)
                    .ToListAsync(stoppingToken);

                foreach (var sub in expiredSubs)
                {
                    try 
                    {
                        sub.Status = SubscriptionStatus.Expired;
                        
                        await notificationService.SendAsync(
                            sub.DriverId,
                            "❌ Monthly Pass Expired",
                            $"Your monthly pass for vehicle {sub.LicensePlate} has expired. Any further parking will be charged at the standard walk-in rate. Please renew your pass.",
                            "SubscriptionExpired",
                            sub.Id);
                    } 
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, $"Failed to process expired status for subscription {sub.Id}");
                    }
                }

                if (expiringSubs.Any() || expiredSubs.Any())
                {
                    await context.SaveChangesAsync(stoppingToken);
                    _logger.LogInformation($"Sent expiry warning to {expiringSubs.Count} subscriptions. Marked {expiredSubs.Count} as expired.");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred in SubscriptionExpiryNotifierService");
            }

            // Check every 5 minutes
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }
}
