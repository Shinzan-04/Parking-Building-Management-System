using ParkingSystem.Application.DTOs.PricingPolicy;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Interfaces;

namespace ParkingSystem.Application.Services;

public class PricingPolicyService : IPricingPolicyService
{
    private readonly IGenericRepository<PricingPolicy> _repository;

    public PricingPolicyService(IGenericRepository<PricingPolicy> repository)
    {
        _repository = repository;
    }

    public async Task<IEnumerable<PricingPolicyResponse>> GetAllAsync()
    {
        var policies = await _repository.GetAllAsync("VehicleType");
        return policies.Select(p => MapToResponse(p));
    }

    public async Task<PricingPolicyResponse?> GetByIdAsync(Guid id)
    {
        var policy = await _repository.GetByIdAsync(id);
        return policy == null ? null : MapToResponse(policy);
    }

    public async Task<PricingPolicyResponse?> GetByVehicleTypeIdAsync(Guid vehicleTypeId)
    {
        var policies = await _repository.FindAsync(p => p.VehicleTypeId == vehicleTypeId, "VehicleType");
        var policy = policies.FirstOrDefault();
        return policy == null ? null : MapToResponse(policy);
    }

    public async Task<PricingPolicyResponse> CreateAsync(CreatePricingPolicyRequest request)
    {
        var policy = new PricingPolicy
        {
            Id = Guid.NewGuid(),
            VehicleTypeId = request.VehicleTypeId,

            // Các trường cũ (dùng cho checkout xe thường)
            HourlyRate = request.HourlyRate,
            BlockPrice = request.BlockPrice,
            DailyMaxRate = request.DailyMaxRate,

            // Các trường mới (Block Ngày/Đêm cho Booking)
            BlockDurationHours = request.BlockDurationHours,
            DayBlockRate = request.DayBlockRate,
            NightBlockRate = request.NightBlockRate,
            NightStartHour = request.NightStartHour,
            NightEndHour = request.NightEndHour,
            DailyRate = request.DailyRate,
            OvertimeMultiplier = request.OvertimeMultiplier
        };

        await _repository.AddAsync(policy);
        return MapToResponse(policy);
    }

    public async Task<PricingPolicyResponse?> UpdateAsync(Guid id, UpdatePricingPolicyRequest request)
    {
        var policy = await _repository.GetByIdAsync(id);
        if (policy == null) return null;

        // Cập nhật trường cũ (checkout xe thường)
        policy.HourlyRate = request.HourlyRate;
        policy.BlockPrice = request.BlockPrice;
        policy.DailyMaxRate = request.DailyMaxRate;

        // Cập nhật trường mới (Block Ngày/Đêm cho Booking)
        policy.BlockDurationHours = request.BlockDurationHours;
        policy.DayBlockRate = request.DayBlockRate;
        policy.NightBlockRate = request.NightBlockRate;
        policy.NightStartHour = request.NightStartHour;
        policy.NightEndHour = request.NightEndHour;
        policy.DailyRate = request.DailyRate;
        policy.OvertimeMultiplier = request.OvertimeMultiplier;
        policy.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(policy);
        return MapToResponse(policy);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var policy = await _repository.GetByIdAsync(id);
        if (policy == null) return false;

        await _repository.DeleteAsync(policy);
        return true;
    }

    private static PricingPolicyResponse MapToResponse(PricingPolicy p) => new()
    {
        Id = p.Id,
        VehicleTypeId = p.VehicleTypeId,
        VehicleTypeName = p.VehicleType?.Name ?? string.Empty,

        // Trường cũ
        HourlyRate = p.HourlyRate,
        BlockPrice = p.BlockPrice,
        DailyMaxRate = p.DailyMaxRate,

        // Trường mới
        BlockDurationHours = p.BlockDurationHours,
        DayBlockRate = p.DayBlockRate,
        NightBlockRate = p.NightBlockRate,
        NightStartHour = p.NightStartHour,
        NightEndHour = p.NightEndHour,
        DailyRate = p.DailyRate,
        OvertimeMultiplier = p.OvertimeMultiplier,
        CreatedAt = p.CreatedAt
    };
}
