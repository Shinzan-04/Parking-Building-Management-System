using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

public class GracePeriodNotifierService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<GracePeriodNotifierService> _logger;

    public GracePeriodNotifierService(IServiceProvider serviceProvider, ILogger<GracePeriodNotifierService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

                var now = DateTime.UtcNow;
                var warningTime = now.AddMinutes(5); // Tìm các session còn <= 5 phút ân hạn

                var sessionsToWarn = await context.ParkingSessions
                    .Where(s => s.Status == SessionStatus.Active &&
                                !s.IsDeleted &&
                                s.GracePeriodEndTime.HasValue &&
                                !s.GraceWarningSent &&
                                s.GracePeriodEndTime.Value <= warningTime)
                    .ToListAsync(stoppingToken);

                foreach (var session in sessionsToWarn)
                {
                    if (session.DriverId.HasValue)
                    {
                        await notificationService.SendAsync(
                            session.DriverId.Value,
                            "⏳ Sắp hết thời gian ân hạn",
                            $"Bạn chỉ còn chưa đầy 5 phút thời gian ân hạn (đến {session.GracePeriodEndTime.Value.AddHours(7):HH:mm}). Vui lòng nhanh chóng đưa xe qua cổng để tránh phát sinh thêm phí.",
                            "GracePeriodWarning",
                            session.Id);
                    }

                    session.GraceWarningSent = true;
                }

                if (sessionsToWarn.Any())
                {
                    await context.SaveChangesAsync(stoppingToken);
                    _logger.LogInformation($"Sent grace period warning to {sessionsToWarn.Count} sessions.");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred in GracePeriodNotifierService");
            }

            // Chạy mỗi 1 phút
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}
