namespace ParkingSystem.Application.DTOs.PricingPolicy;

public class CreatePricingPolicyRequest
{
    public Guid VehicleTypeId { get; set; }
    public decimal BlockPrice { get; set; }
    public int BlockMinutes { get; set; }
    public decimal HourlyRate { get; set; }
    public decimal DailyMaxRate { get; set; }
}

public class UpdatePricingPolicyRequest
{
    public decimal BlockPrice { get; set; }
    public int BlockMinutes { get; set; }
    public decimal HourlyRate { get; set; }
    public decimal DailyMaxRate { get; set; }
}

public class PricingPolicyResponse
{
    public Guid Id { get; set; }
    public Guid VehicleTypeId { get; set; }
    public string VehicleTypeName { get; set; } = string.Empty;
    public decimal BlockPrice { get; set; }
    public int BlockMinutes { get; set; }
    public decimal HourlyRate { get; set; }
    public decimal DailyMaxRate { get; set; }
    public DateTime CreatedAt { get; set; }
}
