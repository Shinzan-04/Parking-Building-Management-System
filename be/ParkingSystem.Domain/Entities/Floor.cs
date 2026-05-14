namespace ParkingSystem.Domain.Entities;

public class Floor : BaseEntity
{
    public Guid BuildingId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int FloorIndex { get; set; }

    public Building Building { get; set; } = null!;
    public ICollection<ParkingSlot> ParkingSlots { get; set; } = new List<ParkingSlot>();
}
