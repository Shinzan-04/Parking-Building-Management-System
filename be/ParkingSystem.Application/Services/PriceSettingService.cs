using ParkingSystem.Application.DTOs.PriceSetting;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Interfaces;

namespace ParkingSystem.Application.Services;

public class PriceSettingService : IPriceSettingService
{
    private readonly IGenericRepository<PriceSetting> _repository;
    private readonly IGenericRepository<User> _userRepository;

    public PriceSettingService(
        IGenericRepository<PriceSetting> repository,
        IGenericRepository<User> userRepository)
    {
        _repository = repository;
        _userRepository = userRepository;
    }

    public async Task<List<PriceSettingResponse>> GetAllAsync()
    {
        var settings = await _repository.GetAllAsync(include: "VehicleType");
        return settings.Select(MapToResponse).ToList();
    }

    public async Task<PriceSettingResponse?> GetByVehicleTypeIdAsync(Guid vehicleTypeId)
    {
        var settings = await _repository.FindAsync(
            p => p.VehicleTypeId == vehicleTypeId,
            include: "VehicleType");
        var setting = settings.FirstOrDefault();
        return setting == null ? null : MapToResponse(setting);
    }

    public async Task<PriceSettingResponse> CreateAsync(CreatePriceSettingRequest request)
    {
        var setting = new PriceSetting
        {
            Id = Guid.NewGuid(),
            VehicleTypeId = request.VehicleTypeId,
            DayPassPrice = request.DayPassPrice,
            NightPassPrice = request.NightPassPrice,
            DailyMaxPrice = request.DailyMaxPrice,
            DayStartHour = request.DayStartHour,
            NightStartHour = request.NightStartHour
        };

        await _repository.AddAsync(setting);

        var settings = await _repository.FindAsync(
            p => p.Id == setting.Id, include: "VehicleType");
        return MapToResponse(settings.First());
    }

    public async Task<PriceSettingResponse?> UpdateAsync(
        Guid vehicleTypeId,
        UpdatePriceSettingRequest request,
        Guid updatedBy)
    {
        var settings = await _repository.FindAsync(
            p => p.VehicleTypeId == vehicleTypeId,
            include: "VehicleType,UpdatedByUser");
        var setting = settings.FirstOrDefault();
        if (setting == null) return null;

        setting.DayPassPrice = request.DayPassPrice;
        setting.NightPassPrice = request.NightPassPrice;
        setting.DailyMaxPrice = request.DailyMaxPrice;
        setting.DayStartHour = request.DayStartHour;
        setting.NightStartHour = request.NightStartHour;
        setting.UpdatedBy = updatedBy;
        setting.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(setting);

        return MapToResponse(setting);
    }

    public async Task<bool> DeleteAsync(Guid vehicleTypeId)
    {
        var settings = await _repository.FindAsync(p => p.VehicleTypeId == vehicleTypeId);
        var setting = settings.FirstOrDefault();
        if (setting == null) return false;

        await _repository.DeleteAsync(setting);
        return true;
    }

    private static PriceSettingResponse MapToResponse(PriceSetting s) => new()
    {
        Id = s.Id,
        VehicleTypeId = s.VehicleTypeId,
        VehicleTypeName = s.VehicleType?.Name ?? string.Empty,
        DayPassPrice = s.DayPassPrice,
        NightPassPrice = s.NightPassPrice,
        DailyMaxPrice = s.DailyMaxPrice,
        DayStartHour = s.DayStartHour,
        NightStartHour = s.NightStartHour,
        UpdatedBy = s.UpdatedBy,
        UpdatedByName = s.UpdatedByUser?.FullName,
        UpdatedAt = s.UpdatedAt,
        CreatedAt = s.CreatedAt
    };
}
