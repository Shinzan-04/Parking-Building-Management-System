using System;
using System.Text.Json;
using System.Threading.Tasks;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services
{
    public class AuditLogService : IAuditLogService
    {
        private readonly ApplicationDbContext _context;

        public AuditLogService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task LogAsync(
            Guid userId, 
            string actionType, 
            string entityName, 
            Guid? entityId, 
            object? oldValues = null, 
            object? newValues = null, 
            string? reason = null, 
            string? ipAddress = null)
        {
            var auditLog = new AuditLog
            {
                UserId = userId,
                ActionType = actionType,
                EntityName = entityName,
                EntityId = entityId,
                OldValues = oldValues != null ? JsonSerializer.Serialize(oldValues) : null,
                NewValues = newValues != null ? JsonSerializer.Serialize(newValues) : null,
                Reason = reason,
                IpAddress = ipAddress,
                CreatedAt = DateTime.UtcNow
            };

            _context.AuditLogs.Add(auditLog);
            await _context.SaveChangesAsync();
        }
    }
}
