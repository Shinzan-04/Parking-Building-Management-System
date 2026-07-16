namespace ParkingSystem.Application.DTOs.Vehicle;

public class VehicleResponse
{
    public Guid Id { get; set; }
    public string PlateNumber { get; set; } = string.Empty;
    public Guid VehicleTypeId { get; set; }
    public string VehicleTypeName { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateVehicleRequest
{
    public string PlateNumber { get; set; } = string.Empty;
    public Guid VehicleTypeId { get; set; }
}

public class UpdateVehicleRequest
{
    public string PlateNumber { get; set; } = string.Empty;
    public Guid VehicleTypeId { get; set; }
}
