namespace ParkingSystem.Application.DTOs.Building;

public class CreateBuildingRequest
{
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public int TotalCapacity { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}

public class UpdateBuildingRequest
{
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public int TotalCapacity { get; set; }
    public ParkingSystem.Domain.Enums.ReservationApprovalMode? ApprovalMode { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}

public class BuildingResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public int TotalCapacity { get; set; }
    public int AvailableSpots { get; set; }
    public int FloorCount { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public ParkingSystem.Domain.Enums.ReservationApprovalMode ApprovalMode { get; set; }
    public DateTime CreatedAt { get; set; }
}
