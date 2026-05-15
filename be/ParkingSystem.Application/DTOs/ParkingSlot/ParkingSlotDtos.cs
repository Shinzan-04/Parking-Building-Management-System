using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.DTOs.ParkingSlot;

public class CreateParkingSlotRequest
{
    public Guid FloorId { get; set; }
    public Guid VehicleTypeId { get; set; }
    public string SlotNumber { get; set; } = string.Empty;
}

public class UpdateParkingSlotStatusRequest
{
    public SlotStatus Status { get; set; }
}

public class ParkingSlotResponse
{
    public Guid Id { get; set; }
    public Guid FloorId { get; set; }
    public string FloorName { get; set; } = string.Empty;
    public Guid VehicleTypeId { get; set; }
    public string VehicleTypeName { get; set; } = string.Empty;
    public string SlotNumber { get; set; } = string.Empty;
    public SlotStatus Status { get; set; }
    public bool IsAIRecommended { get; set; }
    public DateTime CreatedAt { get; set; }
}
