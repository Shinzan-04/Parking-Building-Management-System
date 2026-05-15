using ParkingSystem.Application.DTOs.Floor;

namespace ParkingSystem.Application.Interfaces;

public interface IFloorService
{
    Task<IEnumerable<FloorResponse>> GetAllAsync();
    Task<IEnumerable<FloorResponse>> GetByBuildingIdAsync(Guid buildingId);
    Task<FloorResponse?> GetByIdAsync(Guid id);
    Task<FloorResponse> CreateAsync(CreateFloorRequest request);
    Task<FloorResponse?> UpdateAsync(Guid id, UpdateFloorRequest request);
    Task<bool> DeleteAsync(Guid id);
}
