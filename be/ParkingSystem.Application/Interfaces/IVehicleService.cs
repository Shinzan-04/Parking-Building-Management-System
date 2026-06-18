using ParkingSystem.Application.DTOs.Vehicle;

namespace ParkingSystem.Application.Interfaces;

public interface IVehicleService
{
    Task<List<VehicleResponse>> GetMyVehiclesAsync(Guid driverId);
    Task<VehicleResponse> CreateVehicleAsync(Guid driverId, CreateVehicleRequest request);
    Task<VehicleResponse> UpdateVehicleAsync(Guid id, Guid driverId, UpdateVehicleRequest request);
    Task<bool> DeleteVehicleAsync(Guid id, Guid driverId);
    Task<bool> SetPrimaryVehicleAsync(Guid id, Guid driverId);
}
