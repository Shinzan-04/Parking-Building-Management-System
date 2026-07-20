using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

/// <summary>
/// Background Service tự động xử lý reservation quá hạn.
/// Chạy mỗi 5 phút, kiểm tra 3 rule:
/// 
/// Rule 1: PaymentPending > 15 phút → Cancelled (chưa thanh toán)
/// Rule 2: PendingReview > 30 phút → Rejected + Refund (Staff không duyệt)
/// Rule 3: Confirmed + Now > StartTime + 30 phút + chưa CheckIn → NoShow (không hoàn tiền)
/// </summary>
public class ReservationCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ReservationCleanupService> _logger;

    // Cấu hình thời gian (phút)
    private const int PaymentTimeoutMinutes = 15;     // Chưa thanh toán trong 15 phút → cancel
    private const int ReviewTimeoutMinutes = 30;      // Staff không duyệt trong 30 phút → reject
    private const int NoShowGraceMinutes = 30;        // Không check-in trong 30 phút sau StartTime → NoShow
    private const int ScanIntervalMinutes = 5;        // Chu kỳ quét

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

        int cancelledCount = 0, rejectedCount = 0, noShowCount = 0;

        // ===== RULE 1: PaymentPending > 15 phút → Cancelled =====
        var expiredPayment = await context.Reservations
            .Where(r => r.Status == ReservationStatus.PaymentPending
                     && r.CreatedAt.AddMinutes(PaymentTimeoutMinutes) < now)
            .ToListAsync();

        foreach (var reservation in expiredPayment)
        {
            reservation.Status = ReservationStatus.Cancelled;
            reservation.RejectReason = $"Tự động hủy — không thanh toán trong {PaymentTimeoutMinutes} phút.";
            reservation.UpdatedAt = now;
            
            // Trả slot về Available
            var slot = await context.ParkingSlots.FindAsync(reservation.ParkingSlotId);
            if (slot != null && slot.Status == SlotStatus.TemporaryHeld)
            {
                slot.Status = SlotStatus.Available;
                slot.UpdatedAt = now;
            }

            cancelledCount++;
        }

        // ===== RULE 2: PendingReview > 30 phút → Rejected + Refund =====
        var expiredReview = await context.Reservations
            .Where(r => r.Status == ReservationStatus.PendingReview
                     && (r.UpdatedAt.HasValue
                        ? r.UpdatedAt.Value.AddMinutes(ReviewTimeoutMinutes) < now
                        : r.CreatedAt.AddMinutes(ReviewTimeoutMinutes) < now))
            .ToListAsync();

        foreach (var reservation in expiredReview)
        {
            reservation.Status = ReservationStatus.Rejected;
            reservation.RejectReason = $"Tự động từ chối — Staff không duyệt trong {ReviewTimeoutMinutes} phút.";
            reservation.UpdatedAt = now;

            // Đánh dấu Payment cần hoàn tiền
            var payment = await context.Payments
                .FirstOrDefaultAsync(p => p.ReservationId == reservation.Id
                                       && p.Status == PaymentStatus.Success);
            if (payment != null)
            {
                payment.Status = PaymentStatus.Refunding;
                payment.UpdatedAt = now;
            }

            rejectedCount++;
        }

        // ===== RULE 3: Confirmed + quá StartTime + 30 phút + chưa CheckIn → NoShow =====
        var noShowReservations = await context.Reservations
            .Where(r => r.Status == ReservationStatus.Confirmed
                     && r.StartTime.AddMinutes(NoShowGraceMinutes) < now)
            .ToListAsync();

        foreach (var reservation in noShowReservations)
        {
            reservation.Status = ReservationStatus.NoShow;
            reservation.RejectReason = $"Không check-in trong {NoShowGraceMinutes} phút sau giờ hẹn. Không hoàn tiền.";
            reservation.UpdatedAt = now;

            // Trả slot về Available
            var slot = await context.ParkingSlots.FindAsync(reservation.ParkingSlotId);
            if (slot != null && slot.Status == SlotStatus.Reserved)
            {
                slot.Status = SlotStatus.Available;
                slot.UpdatedAt = now;
            }

            // NoShow KHÔNG hoàn tiền

            noShowCount++;
        }

        // ===== RULE 4: Khóa Slot cho xe sắp đến (trước 30 phút) =====
        var upcomingReservations = await context.Reservations
            .Where(r => r.Status == ReservationStatus.Confirmed
                     && r.StartTime <= now.AddMinutes(30)
                     && r.StartTime >= now.AddMinutes(-30)) // Không lấy quá khứ xa
            .ToListAsync();

        int lockedCount = 0;
        foreach (var reservation in upcomingReservations)
        {
            var slot = await context.ParkingSlots.FindAsync(reservation.ParkingSlotId);
            if (slot != null)
            {
                if (slot.Status == SlotStatus.Available)
                {
                    // Chỗ trống -> Khóa lại an toàn
                    slot.Status = SlotStatus.Reserved;
                    slot.UpdatedAt = now;
                    lockedCount++;

                    // Bắn SignalR cập nhật UI nếu có IRealtimeService
                    var realtimeService = scope.ServiceProvider.GetService<Application.Interfaces.IRealtimeService>();
                    if (realtimeService != null)
                    {
                        await realtimeService.SendSlotStatusUpdateAsync(slot.Id, slot.Status.ToString());
                    }
                }
                else if (slot.Status == SlotStatus.Occupied || slot.Status == SlotStatus.TemporaryHeld)
                {
                    // CHỖ ĐANG BỊ KẸT (Occupied/TemporaryHeld) -> Báo động cho Staff
                    var realtimeService = scope.ServiceProvider.GetService<Application.Interfaces.IRealtimeService>();
                    if (realtimeService != null)
                    {
                        await realtimeService.BroadcastNotificationToStaffAsync($"[BÁO ĐỘNG] Ô đỗ {slot.SlotNumber} đã được đặt trước bởi biển số {reservation.LicensePlate} (sắp tới giờ) nhưng hiện đang có xe khác đỗ. Vui lòng xử lý!");
                    }
                }
            }
        }

        // Lưu tất cả thay đổi
        var totalChanged = cancelledCount + rejectedCount + noShowCount + lockedCount;
        if (totalChanged > 0)
        {
            // Ghi log cho tất cả các thay đổi
            var allAffected = expiredPayment.Concat(expiredReview).Concat(noShowReservations);
            foreach (var r in allAffected)
            {
                var action = r.Status switch
                {
                    ReservationStatus.Cancelled => "Cancel",
                    ReservationStatus.Rejected => "Reject",
                    ReservationStatus.NoShow => "NoShow",
                    _ => "AutoCleanup"
                };

                context.ReservationLogs.Add(new ReservationLog
                {
                    Id = Guid.NewGuid(),
                    ReservationId = r.Id,
                    Action = action,
                    StatusSnapshot = r.Status,
                    Note = r.RejectReason,
                    CreatedAt = now
                });
            }

            await context.SaveChangesAsync();

            // Gửi notification cho từng Driver
            foreach (var reservation in allAffected)
            {
                try
                {
                    var (title, body) = reservation.Status switch
                    {
                        ReservationStatus.Cancelled => (
                            "Reservation Cancelled — Payment Timeout",
                            $"Reservation {reservation.BookingCode} has been cancelled due to no payment within {PaymentTimeoutMinutes} minutes."
                        ),
                        ReservationStatus.Rejected => (
                            "Reservation Rejected — Review Timeout",
                            $"Reservation {reservation.BookingCode} has been automatically rejected. The money will be refunded."
                        ),
                        ReservationStatus.NoShow => (
                            "🚫 No-Show",
                            $"Reservation {reservation.BookingCode} has been marked as No-Show because you did not check-in on time. No refund."
                        ),
                        _ => ("Reservation Notice", reservation.RejectReason ?? "")
                    };

                    await notificationService.SendAsync(
                        reservation.DriverId, title, body,
                        "ReservationAutoCleanup", reservation.Id);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Không gửi được notification cho reservation {Id}", reservation.Id);
                }
            }

            _logger.LogInformation(
                "🧹 Auto-cleanup: {Cancelled} cancelled (payment timeout) + {Rejected} rejected (review timeout) + {NoShow} no-show = {Total} total.",
                cancelledCount, rejectedCount, noShowCount, totalChanged);
        }
    }
}
