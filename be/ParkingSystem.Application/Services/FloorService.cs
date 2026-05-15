using ParkingSystem.Application.DTOs.Floor;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Interfaces;

namespace ParkingSystem.Application.Services;

public class FloorService : IFloorService
{
    private readonly IGenericRepository<Floor> _repository;

    public FloorService(IGenericRepository<Floor> repository)
    {
        _repository = repository;
    }

    public async Task<IEnumerable<FloorResponse>> GetAllAsync()
    {
        var floors = await _repository.GetAllAsync();
        return floors.Select(f => MapToResponse(f));
    }

    public async Task<IEnumerable<FloorResponse>> GetByBuildingIdAsync(Guid buildingId)
    {
        var floors = await _repository.FindAsync(f => f.BuildingId == buildingId);
        return floors.Select(f => MapToResponse(f));
    }

    public async Task<FloorResponse?> GetByIdAsync(Guid id)
    {
        var floor = await _repository.GetByIdAsync(id);
        return floor == null ? null : MapToResponse(floor);
    }

    public async Task<FloorResponse> CreateAsync(CreateFloorRequest request)
    {
        var floor = new Floor
        {
            Id = Guid.NewGuid(),
            BuildingId = request.BuildingId,
            Name = request.Name,
            FloorIndex = request.FloorIndex
        };

        await _repository.AddAsync(floor);
        return MapToResponse(floor);
    }

    public async Task<FloorResponse?> UpdateAsync(Guid id, UpdateFloorRequest request)
    {
        var floor = await _repository.GetByIdAsync(id);
        if (floor == null) return null;

        floor.Name = request.Name;
        floor.FloorIndex = request.FloorIndex;
        floor.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(floor);
        return MapToResponse(floor);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var floor = await _repository.GetByIdAsync(id);
        if (floor == null) return false;

        await _repository.DeleteAsync(floor);
        return true;
    }

    private static FloorResponse MapToResponse(Floor f) => new()
    {
        Id = f.Id,
        BuildingId = f.BuildingId,
        BuildingName = f.Building?.Name ?? string.Empty,
        Name = f.Name,
        FloorIndex = f.FloorIndex,
        SlotCount = f.ParkingSlots?.Count ?? 0,
        CreatedAt = f.CreatedAt
    };
}
