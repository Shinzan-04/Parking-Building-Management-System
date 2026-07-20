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

                var checkOutService = scope.ServiceProvider.GetRequiredService<ICheckOutService>();

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
                    try 
                    {
                        // Tính thử xem nếu quá hạn 1 phút thì phí có tăng không (có vượt qua Block hiện tại không)
                        var futureTime = session.GracePeriodEndTime.Value.AddMinutes(1);
                        var futureFeeResult = await checkOutService.CalculateFeeAsync(session.VehicleTypeId, session.EntryTime, futureTime, pricingPolicyId: session.PricingPolicyId);

                        if (futureFeeResult.TotalFee > session.PrePaidAmount && session.DriverId.HasValue)
                        {
                            await notificationService.SendAsync(
                                session.DriverId.Value,
                                "⏳ Grace Period Expiring Soon",
                                $"Thời gian ân hạn 15 phút sau khi thanh toán sắp hết (đến {session.GracePeriodEndTime.Value.AddHours(7):HH:mm}). Nếu bạn vẫn tiếp tục gửi, hệ thống sẽ trở lại tính phí theo Block bình thường.",
                                "GracePeriodWarning",
                                session.Id);
                        }

                        session.GraceWarningSent = true;
                    } 
                    catch (Exception sessionEx)
                    {
                        _logger.LogWarning(sessionEx, $"Failed to process grace period warning for session {session.Id}");
                    }
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
