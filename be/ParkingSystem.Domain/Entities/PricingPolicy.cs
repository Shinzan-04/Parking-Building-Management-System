namespace ParkingSystem.Domain.Entities;

public class PricingPolicy : BaseEntity
{
    public Guid VehicleTypeId { get; set; }
    public decimal BlockPrice { get; set; }
    public int BlockMinutes { get; set; }
    public decimal HourlyRate { get; set; }
    public decimal DailyMaxRate { get; set; }

    public VehicleType VehicleType { get; set; } = null!;
}
