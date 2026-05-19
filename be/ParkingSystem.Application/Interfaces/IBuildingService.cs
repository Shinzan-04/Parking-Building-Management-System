using ParkingSystem.Application.DTOs.Building;

namespace ParkingSystem.Application.Interfaces;

public interface IBuildingService
{
    Task<IEnumerable<BuildingResponse>> GetAllAsync();
    Task<BuildingResponse?> GetByIdAsync(Guid id);
    Task<BuildingResponse> CreateAsync(CreateBuildingRequest request);
    Task<BuildingResponse?> UpdateAsync(Guid id, UpdateBuildingRequest request);
    Task<bool> DeleteAsync(Guid id);
}
