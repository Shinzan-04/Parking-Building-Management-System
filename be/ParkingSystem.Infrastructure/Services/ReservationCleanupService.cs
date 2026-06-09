using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

/// <summary>
/// Background Service tự động hủy reservation quá hạn.
/// Chạy mỗi 5 phút, kiểm tra và cancel các reservation:
/// - Pending quá 30 phút không được Staff duyệt → Cancel
/// - Confirmed nhưng Driver không đến sau StartTime + 30 phút → Cancel
/// </summary>
public class ReservationCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ReservationCleanupService> _logger;

    // Thời gian chờ trước khi auto-cancel (phút)
    private const int PendingTimeoutMinutes = 30;    // Pending quá 30 phút → cancel
    private const int ConfirmedGraceMinutes = 30;    // Confirmed nhưng quá StartTime 30 phút → cancel
    // Chu kỳ quét (phút)
    private const int ScanIntervalMinutes = 5;

    public ReservationCleanupService(IServiceScopeFactory scopeFactory, ILogger<ReservationCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("🔄 ReservationCleanupService đã khởi động. Quét mỗi {Interval} phút.", ScanIntervalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupExpiredReservationsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Lỗi khi quét reservation hết hạn.");
            }

            // Chờ N phút trước khi quét lại
            await Task.Delay(TimeSpan.FromMinutes(ScanIntervalMinutes), stoppingToken);
        }

        _logger.LogInformation("🛑 ReservationCleanupService đã dừng.");
    }

    private async Task CleanupExpiredReservationsAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var notificationService = scope.ServiceProvider.GetRequiredService<Application.Interfaces.INotificationService>();
        var now = DateTime.UtcNow;

        // 1. Pending quá lâu không được duyệt → Auto-cancel
        var expiredPending = await context.Reservations
            .Where(r => r.Status == ReservationStatus.Pending
                     && r.CreatedAt.AddMinutes(PendingTimeoutMinutes) < now)
            .ToListAsync();

        foreach (var reservation in expiredPending)
        {
            reservation.Status = ReservationStatus.Cancelled;
            reservation.RejectReason = $"Tự động hủy — không được duyệt trong {PendingTimeoutMinutes} phút.";
            reservation.UpdatedAt = now;
        }

        // 2. Confirmed nhưng Driver không đến đúng giờ → Auto-cancel
        var expiredConfirmed = await context.Reservations
            .Where(r => r.Status == ReservationStatus.Confirmed
                     && r.StartTime.AddMinutes(ConfirmedGraceMinutes) < now)
            .ToListAsync();

        foreach (var reservation in expiredConfirmed)
        {
            reservation.Status = ReservationStatus.Cancelled;
            reservation.RejectReason = $"Tự động hủy — không check-in trong {ConfirmedGraceMinutes} phút sau giờ hẹn.";
            reservation.UpdatedAt = now;
        }

        var allCancelled = expiredPending.Concat(expiredConfirmed).ToList();
        if (allCancelled.Count > 0)
        {
            await context.SaveChangesAsync();

            // Gửi notification cho từng Driver bị hủy
            foreach (var reservation in allCancelled)
            {
                try
                {
                    await notificationService.SendAsync(
                        reservation.DriverId,
                        "⏰ Đặt chỗ đã bị hủy tự động",
                        $"Đặt chỗ biển số {reservation.LicensePlate} đã bị hủy. {reservation.RejectReason}",
                        "ReservationCancelled",
                        reservation.Id);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Không gửi được notification cho reservation {Id}", reservation.Id);
                }
            }

            _logger.LogInformation(
                "🧹 Auto-cancel: {Pending} pending + {Confirmed} confirmed = {Total} reservation đã bị hủy.",
                expiredPending.Count, expiredConfirmed.Count, allCancelled.Count);
        }
    }
}
