using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ParkingSystem.Domain.Entities
{
    public class AuditLog
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid UserId { get; set; }

        [Required]
        [MaxLength(255)]
        public string ActionType { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string EntityName { get; set; } = string.Empty;

        public Guid? EntityId { get; set; }

        public string? OldValues { get; set; }

        public string? NewValues { get; set; }

        public string? Reason { get; set; }

        [MaxLength(45)]
        public string? IpAddress { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation property (Optional)
        // [ForeignKey("UserId")]
        // public User User { get; set; }
    }
}
