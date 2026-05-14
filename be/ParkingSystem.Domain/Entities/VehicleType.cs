namespace ParkingSystem.Domain.Entities;

public class VehicleType : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    public ICollection<ParkingSlot> ParkingSlots { get; set; } = new List<ParkingSlot>();
    public ICollection<PricingPolicy> PricingPolicies { get; set; } = new List<PricingPolicy>();
}
