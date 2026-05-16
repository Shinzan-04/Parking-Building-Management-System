using ParkingSystem.Application.DTOs.VehicleType;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Interfaces;

namespace ParkingSystem.Application.Services;

public class VehicleTypeService : IVehicleTypeService
{
    private readonly IGenericRepository<VehicleType> _repository;

    public VehicleTypeService(IGenericRepository<VehicleType> repository)
    {
        _repository = repository;
    }

    public async Task<IEnumerable<VehicleTypeResponse>> GetAllAsync()
    {
        var types = await _repository.GetAllAsync();
        return types.Select(v => MapToResponse(v));
    }

    public async Task<VehicleTypeResponse?> GetByIdAsync(Guid id)
    {
        var type = await _repository.GetByIdAsync(id);
        return type == null ? null : MapToResponse(type);
    }

    public async Task<VehicleTypeResponse> CreateAsync(CreateVehicleTypeRequest request)
    {
        var type = new VehicleType
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description
        };

        await _repository.AddAsync(type);
        return MapToResponse(type);
    }

    public async Task<VehicleTypeResponse?> UpdateAsync(Guid id, UpdateVehicleTypeRequest request)
    {
        var type = await _repository.GetByIdAsync(id);
        if (type == null) return null;

        type.Name = request.Name;
        type.Description = request.Description;
        type.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(type);
        return MapToResponse(type);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var type = await _repository.GetByIdAsync(id);
        if (type == null) return false;

        await _repository.DeleteAsync(type);
        return true;
    }

    private static VehicleTypeResponse MapToResponse(VehicleType v) => new()
    {
        Id = v.Id,
        Name = v.Name,
        Description = v.Description,
        CreatedAt = v.CreatedAt
    };
}
