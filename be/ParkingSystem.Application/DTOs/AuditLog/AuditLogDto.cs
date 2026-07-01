using System;

namespace ParkingSystem.Application.DTOs.AuditLog
{
    public class AuditLogDto
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string ActionType { get; set; } = string.Empty;
        public string EntityName { get; set; } = string.Empty;
        public Guid? EntityId { get; set; }
        public string? OldValues { get; set; }
        public string? NewValues { get; set; }
        public string? Reason { get; set; }
        public string? IpAddress { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? UserFullName { get; set; } // Optional: To display who actually did it
    }
}
