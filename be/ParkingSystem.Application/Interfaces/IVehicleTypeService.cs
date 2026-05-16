using ParkingSystem.Application.DTOs.VehicleType;

namespace ParkingSystem.Application.Interfaces;

public interface IVehicleTypeService
{
    Task<IEnumerable<VehicleTypeResponse>> GetAllAsync();
    Task<VehicleTypeResponse?> GetByIdAsync(Guid id);
    Task<VehicleTypeResponse> CreateAsync(CreateVehicleTypeRequest request);
    Task<VehicleTypeResponse?> UpdateAsync(Guid id, UpdateVehicleTypeRequest request);
    Task<bool> DeleteAsync(Guid id);
}
