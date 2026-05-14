namespace ParkingSystem.Domain.Entities;

public class Building : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public int TotalCapacity { get; set; }

    public ICollection<Floor> Floors { get; set; } = new List<Floor>();
}
