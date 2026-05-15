namespace ParkingSystem.Application.DTOs.Building;

public class CreateBuildingRequest
{
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public int TotalCapacity { get; set; }
}

public class UpdateBuildingRequest
{
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public int TotalCapacity { get; set; }
}

public class BuildingResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public int TotalCapacity { get; set; }
    public int FloorCount { get; set; }
    public DateTime CreatedAt { get; set; }
}
