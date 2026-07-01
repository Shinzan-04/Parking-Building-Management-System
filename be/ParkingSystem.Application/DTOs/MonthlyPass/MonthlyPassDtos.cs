using System.ComponentModel.DataAnnotations;
using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.DTOs.MonthlyPass;

// ===== POLICIES =====
public class MonthlyPassPolicyResponse
{
    public Guid Id { get; set; }
    public Guid VehicleTypeId { get; set; }
    public string VehicleTypeName { get; set; } = string.Empty;
    public decimal MonthlyPrice { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateMonthlyPassPolicyRequest
{
    [Required]
    public Guid VehicleTypeId { get; set; }

    [Required]
    [Range(0, double.MaxValue, ErrorMessage = "Giá tháng phải >= 0")]
    public decimal MonthlyPrice { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }
}

public class UpdateMonthlyPassPolicyRequest
{
    [Range(0, double.MaxValue, ErrorMessage = "Giá tháng phải >= 0")]
    public decimal MonthlyPrice { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    public bool IsActive { get; set; }
}

// ===== SUBSCRIPTIONS =====
public class SubscriptionResponse
{
    public Guid Id { get; set; }
    public Guid DriverId { get; set; }
    public string DriverName { get; set; } = string.Empty;
    public Guid VehicleTypeId { get; set; }
    public string VehicleTypeName { get; set; } = string.Empty;
    public string LicensePlate { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public SubscriptionStatus Status { get; set; }
    public string StatusText => Status.ToString();
    public Guid? PaymentId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class RegisterSubscriptionRequest
{
    [Required]
    public Guid VehicleId { get; set; }

    [Required]
    public PaymentMethod PaymentMethod { get; set; }
}
