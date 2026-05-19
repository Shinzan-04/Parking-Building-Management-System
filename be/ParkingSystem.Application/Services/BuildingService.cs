using ParkingSystem.Application.DTOs.Building;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Interfaces;

namespace ParkingSystem.Application.Services;

public class BuildingService : IBuildingService
{
    private readonly IGenericRepository<Building> _repository;

    public BuildingService(IGenericRepository<Building> repository)
    {
        _repository = repository;
    }

    public async Task<IEnumerable<BuildingResponse>> GetAllAsync()
    {
        var buildings = await _repository.GetAllAsync();
        return buildings.Select(b => MapToResponse(b));
    }

    public async Task<BuildingResponse?> GetByIdAsync(Guid id)
    {
        var building = await _repository.GetByIdAsync(id);
        return building == null ? null : MapToResponse(building);
    }

    public async Task<BuildingResponse> CreateAsync(CreateBuildingRequest request)
    {
        var building = new Building
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Address = request.Address,
            TotalCapacity = request.TotalCapacity
        };

        await _repository.AddAsync(building);
        return MapToResponse(building);
    }

    public async Task<BuildingResponse?> UpdateAsync(Guid id, UpdateBuildingRequest request)
    {
        var building = await _repository.GetByIdAsync(id);
        if (building == null) return null;

        building.Name = request.Name;
        building.Address = request.Address;
        building.TotalCapacity = request.TotalCapacity;
        building.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(building);
        return MapToResponse(building);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var building = await _repository.GetByIdAsync(id);
        if (building == null) return false;

        await _repository.DeleteAsync(building);
        return true;
    }

    private static BuildingResponse MapToResponse(Building b) => new()
    {
        Id = b.Id,
        Name = b.Name,
        Address = b.Address,
        TotalCapacity = b.TotalCapacity,
        FloorCount = b.Floors?.Count ?? 0,
        CreatedAt = b.CreatedAt
    };
}
