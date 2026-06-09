using Microsoft.EntityFrameworkCore;
using ParkingSystem.Application.DTOs.Notification;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

/// <summary>
/// Service quản lý notification in-app.
/// Lưu thông báo vào DB, Driver query qua API.
/// </summary>
public class NotificationService : INotificationService
{
    private readonly ApplicationDbContext _context;

    public NotificationService(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Tạo thông báo mới cho user
    /// </summary>
    public async Task SendAsync(Guid userId, string title, string message, string type, Guid? referenceId = null)
    {
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = title,
            Message = message,
            Type = type,
            ReferenceId = referenceId,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Lấy danh sách thông báo (phân trang, mới nhất trước)
    /// </summary>
    public async Task<IEnumerable<NotificationResponse>> GetByUserIdAsync(Guid userId, int page = 1, int pageSize = 20)
    {
        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new NotificationResponse
            {
                Id = n.Id,
                Title = n.Title,
                Message = n.Message,
                Type = n.Type,
                ReferenceId = n.ReferenceId,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync();

        return notifications;
    }

    /// <summary>
    /// Đếm số thông báo chưa đọc
    /// </summary>
    public async Task<int> GetUnreadCountAsync(Guid userId)
    {
        return await _context.Notifications
            .CountAsync(n => n.UserId == userId && !n.IsRead);
    }

    /// <summary>
    /// Đánh dấu 1 thông báo đã đọc
    /// </summary>
    public async Task MarkAsReadAsync(Guid notificationId, Guid userId)
    {
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId);

        if (notification != null && !notification.IsRead)
        {
            notification.IsRead = true;
            notification.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Đánh dấu tất cả thông báo đã đọc
    /// </summary>
    public async Task MarkAllAsReadAsync(Guid userId)
    {
        var unread = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();

        foreach (var n in unread)
        {
            n.IsRead = true;
            n.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
    }
}
