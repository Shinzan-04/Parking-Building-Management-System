using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

public class PaymentCleanupService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<PaymentCleanupService> _logger;

    public PaymentCleanupService(IServiceProvider serviceProvider, ILogger<PaymentCleanupService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PaymentCleanupService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupExpiredPaymentsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred executing PaymentCleanupService.");
            }

            // Chạy mỗi 5 phút
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }

    private async Task CleanupExpiredPaymentsAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var paymentService = scope.ServiceProvider.GetRequiredService<ParkingSystem.Application.Interfaces.IPaymentService>();

        // Lấy thời điểm hiện tại trừ đi 15 phút
        var expireTime = DateTime.UtcNow.AddMinutes(-15);

        // Tìm các giao dịch Pending và đã quá hạn 15 phút
        var expiredPayments = await context.Payments
            .Where(p => p.Status == PaymentStatus.Pending && p.CreatedAt < expireTime)
            .ToListAsync();

        if (expiredPayments.Any())
        {
            foreach (var payment in expiredPayments)
            {
                if (payment.PaymentMethod == PaymentMethod.PayOS)
                {
                    // Xác minh với PayOS trước khi hủy để tránh hủy nhầm giao dịch đã thanh toán
                    var (_, status) = await paymentService.VerifyPayOSPaymentAsync(payment.PayOSOrderCode);
                    if (status == PaymentStatus.Success)
                    {
                        payment.Status = PaymentStatus.Success;
                        payment.UpdatedAt = DateTime.UtcNow;
                        
                        // Cập nhật các entity liên quan nếu cần
                        // (SubscriptionCleanupService và ReservationCleanupService sẽ tự xử lý phần của nó)
                        _logger.LogInformation("Payment {PaymentId} marked as Success after verification.", payment.Id);
                        continue;
                    }
                }

                payment.Status = PaymentStatus.Failed;
                payment.UpdatedAt = DateTime.UtcNow;
                _logger.LogInformation("Payment {PaymentId} marked as Failed due to expiration.", payment.Id);
            }

            await context.SaveChangesAsync();
            _logger.LogInformation("Cleaned up {Count} expired payments.", expiredPayments.Count);
        }
    }
}
