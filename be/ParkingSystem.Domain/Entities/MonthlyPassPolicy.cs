using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ParkingSystem.Domain.Entities;

/// <summary>
/// Bảng giá cấu hình Vé Tháng (Do Admin thiết lập)
/// </summary>
public class MonthlyPassPolicy
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid VehicleTypeId { get; set; }

    [ForeignKey("VehicleTypeId")]
    public VehicleType? VehicleType { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal MonthlyPrice { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
