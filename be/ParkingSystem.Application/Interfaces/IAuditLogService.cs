using System;
using System.Threading.Tasks;

namespace ParkingSystem.Application.Interfaces
{
    public interface IAuditLogService
    {
        Task LogAsync(
            Guid userId, 
            string actionType, 
            string entityName, 
            Guid? entityId, 
            object? oldValues = null, 
            object? newValues = null, 
            string? reason = null, 
            string? ipAddress = null);
    }
}
