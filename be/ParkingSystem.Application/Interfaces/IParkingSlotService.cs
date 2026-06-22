using ParkingSystem.Application.DTOs.ParkingSlot;
using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.Interfaces;

public interface IParkingSlotService
{
    Task<IEnumerable<ParkingSlotResponse>> GetAllAsync(Guid? buildingId = null);
    Task<IEnumerable<ParkingSlotResponse>> GetByFloorIdAsync(Guid floorId);
    Task<IEnumerable<ParkingSlotResponse>> GetAvailableByVehicleTypeAsync(Guid vehicleTypeId);
    Task<ParkingSlotResponse?> GetByIdAsync(Guid id);
    Task<ParkingSlotResponse> CreateAsync(CreateParkingSlotRequest request);
    Task<ParkingSlotResponse?> UpdateStatusAsync(Guid id, UpdateParkingSlotStatusRequest request);
    Task<bool> DeleteAsync(Guid id);
    Task<IEnumerable<ParkingSlotResponse>> GetAvailabilityByFloorAsync(Guid floorId, DateTime startTime, DateTime endTime);
    Task<CurrentVehicleResponse?> GetCurrentVehicleAsync(Guid slotId);
}

public class CurrentVehicleResponse
{
    public string? LicensePlate { get; set; }
    public string Status { get; set; } = string.Empty; // "Occupied", "Reserved", "Available"
    public DateTime? ExpectedEndTime { get; set; }
}
