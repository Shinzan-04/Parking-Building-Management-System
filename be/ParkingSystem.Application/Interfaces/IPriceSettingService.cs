using ParkingSystem.Application.DTOs.PriceSetting;

namespace ParkingSystem.Application.Interfaces;

public interface IPriceSettingService
{
    Task<List<PriceSettingResponse>> GetAllAsync();
    Task<PriceSettingResponse?> GetByVehicleTypeIdAsync(Guid vehicleTypeId);
    Task<PriceSettingResponse> CreateAsync(CreatePriceSettingRequest request);
    Task<PriceSettingResponse?> UpdateAsync(Guid vehicleTypeId, UpdatePriceSettingRequest request, Guid updatedBy);
    Task<bool> DeleteAsync(Guid vehicleTypeId);
}
