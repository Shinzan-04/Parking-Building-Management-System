namespace ParkingSystem.Application.DTOs.Floor;

public class CreateFloorRequest
{
    public Guid BuildingId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int FloorIndex { get; set; }
}

public class UpdateFloorRequest
{
    public string Name { get; set; } = string.Empty;
    public int FloorIndex { get; set; }
}

public class FloorResponse
{
    public Guid Id { get; set; }
    public Guid BuildingId { get; set; }
    public string BuildingName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int FloorIndex { get; set; }
    public int SlotCount { get; set; }
    public DateTime CreatedAt { get; set; }
}
