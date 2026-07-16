using ParkingSystem.Application.DTOs.PricingPolicy;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Interfaces;

namespace ParkingSystem.Application.Services;

public class PricingPolicyService : IPricingPolicyService
{
    private readonly IGenericRepository<PricingPolicy> _repository;
    private readonly IAuditLogService _auditLogService;

    public PricingPolicyService(IGenericRepository<PricingPolicy> repository, IAuditLogService auditLogService)
    {
        _repository = repository;
        _auditLogService = auditLogService;
    }

    public async Task<IEnumerable<PricingPolicyResponse>> GetAllAsync()
    {
        var policies = await _repository.GetAllAsync("VehicleType");
        
        // Lấy Policy đang Active, nếu không có thì lấy cái mới nhất (để hiển thị giá cũ sau khi chạy Migration)
        var latestPolicies = policies
            .GroupBy(p => p.VehicleTypeId)
            .Select(g => g.FirstOrDefault(p => p.IsActive) ?? g.OrderByDescending(p => p.CreatedAt).FirstOrDefault())
            .Where(p => p != null)
            .Select(p => MapToResponse(p!));
            
        return latestPolicies;
    }

    public async Task<PricingPolicyResponse?> GetByIdAsync(Guid id)
    {
        var policy = await _repository.GetByIdAsync(id);
        return policy == null ? null : MapToResponse(policy);
    }

    public async Task<PricingPolicyResponse?> GetByVehicleTypeIdAsync(Guid vehicleTypeId)
    {
        var policies = await _repository.FindAsync(p => p.VehicleTypeId == vehicleTypeId, "VehicleType");
        var policy = policies.FirstOrDefault(p => p.IsActive) ?? policies.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
        return policy == null ? null : MapToResponse(policy);
    }

    public async Task<PricingPolicyResponse> CreateAsync(CreatePricingPolicyRequest request, Guid adminId)
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

        await _auditLogService.LogAsync(
            userId: adminId,
            actionType: "CreatePricingPolicy",
            entityName: "PricingPolicy",
            entityId: policy.Id,
            oldValues: null,
            newValues: policy,
            reason: "Tạo bảng giá mới"
        );

        return MapToResponse(policy);
    }

    public async Task<PricingPolicyResponse?> UpdateAsync(Guid id, UpdatePricingPolicyRequest request, Guid adminId)
    {
        var policy = await _repository.GetByIdAsync(id);
        if (policy == null) return null;

        var oldValues = new 
        {
            HourlyRate = policy.HourlyRate,
            BlockPrice = policy.BlockPrice,
            DailyMaxRate = policy.DailyMaxRate,
            BlockDurationHours = policy.BlockDurationHours,
            DayBlockRate = policy.DayBlockRate,
            NightBlockRate = policy.NightBlockRate,
            DailyRate = policy.DailyRate
        };

        // Soft Update: Tắt bảng giá cũ, tạo bảng giá mới
        policy.IsActive = false;
        policy.UpdatedAt = DateTime.UtcNow;
        await _repository.UpdateAsync(policy);

        var newPolicy = new PricingPolicy
        {
            Id = Guid.NewGuid(),
            VehicleTypeId = policy.VehicleTypeId,
            Version = policy.Version + 1,
            PreviousVersionId = policy.Id,
            IsActive = true,
            EffectiveDate = DateTime.UtcNow,

            HourlyRate = request.HourlyRate,
            BlockPrice = request.BlockPrice,
            DailyMaxRate = request.DailyMaxRate,
            BlockDurationHours = request.BlockDurationHours,
            DayBlockRate = request.DayBlockRate,
            NightBlockRate = request.NightBlockRate,
            NightStartHour = request.NightStartHour,
            NightEndHour = request.NightEndHour,
            DailyRate = request.DailyRate,
            OvertimeMultiplier = request.OvertimeMultiplier
        };

        await _repository.AddAsync(newPolicy);

        await _auditLogService.LogAsync(
            userId: adminId,
            actionType: "UpdatePricingPolicy",
            entityName: "PricingPolicy",
            entityId: policy.Id,
            oldValues: oldValues,
            newValues: new 
            {
                HourlyRate = policy.HourlyRate,
                BlockPrice = policy.BlockPrice,
                DailyMaxRate = policy.DailyMaxRate,
                BlockDurationHours = policy.BlockDurationHours,
                DayBlockRate = policy.DayBlockRate,
                NightBlockRate = policy.NightBlockRate,
                DailyRate = policy.DailyRate
            },
            reason: $"Cập nhật bảng giá (Tạo version {newPolicy.Version})"
        );

        return MapToResponse(newPolicy);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid adminId)
    {
        var policy = await _repository.GetByIdAsync(id);
        if (policy == null || !policy.IsActive) return false;

        policy.IsActive = false;
        policy.UpdatedAt = DateTime.UtcNow;
        await _repository.UpdateAsync(policy);

        await _auditLogService.LogAsync(
            userId: adminId,
            actionType: "DeletePricingPolicy",
            entityName: "PricingPolicy",
            entityId: policy.Id,
            oldValues: policy,
            newValues: null,
            reason: "Xóa bảng giá"
        );

        return true;
    }

    private static PricingPolicyResponse MapToResponse(PricingPolicy p) => new()
    {
        Id = p.Id,
        VehicleTypeId = p.VehicleTypeId,
        VehicleTypeName = p.VehicleType?.Name ?? string.Empty,
        IsActive = p.IsActive,
        Version = p.Version,

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
