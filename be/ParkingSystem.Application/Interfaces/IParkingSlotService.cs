using ParkingSystem.Application.DTOs.ParkingSlot;
using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.Interfaces;

public interface IParkingSlotService
{
    Task<IEnumerable<ParkingSlotResponse>> GetAllAsync();
    Task<IEnumerable<ParkingSlotResponse>> GetByFloorIdAsync(Guid floorId);
    Task<IEnumerable<ParkingSlotResponse>> GetAvailableByVehicleTypeAsync(Guid vehicleTypeId);
    Task<ParkingSlotResponse?> GetByIdAsync(Guid id);
    Task<ParkingSlotResponse> CreateAsync(CreateParkingSlotRequest request);
    Task<ParkingSlotResponse?> UpdateStatusAsync(Guid id, UpdateParkingSlotStatusRequest request);
    Task<bool> DeleteAsync(Guid id);
}
