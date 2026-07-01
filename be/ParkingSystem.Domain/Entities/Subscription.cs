using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Entities;

/// <summary>
/// Quản lý Vé tháng của Tài xế
/// </summary>
public class Subscription
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid DriverId { get; set; }

    [ForeignKey("DriverId")]
    public User? Driver { get; set; }

    [Required]
    public Guid VehicleTypeId { get; set; }

    [ForeignKey("VehicleTypeId")]
    public VehicleType? VehicleType { get; set; }

    [Required]
    [MaxLength(20)]
    public string LicensePlate { get; set; } = string.Empty;

    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.PendingPayment;

    // Liên kết với thanh toán (PaymentId)
    public Guid? PaymentId { get; set; }
    
    [ForeignKey("PaymentId")]
    public Payment? Payment { get; set; }

    // Lưu lại Id của bảng giá vé tháng lúc đăng ký
    public Guid? MonthlyPassPolicyId { get; set; }

    [ForeignKey("MonthlyPassPolicyId")]
    public MonthlyPassPolicy? MonthlyPassPolicy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
