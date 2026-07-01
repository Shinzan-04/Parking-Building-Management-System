using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ParkingSystem.Application.DTOs.MonthlyPass;
using ParkingSystem.Application.DTOs.Payment;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

public class SubscriptionService : ISubscriptionService
{
    private readonly ApplicationDbContext _context;
    private readonly IPaymentService _paymentService;
    private readonly ILogger<SubscriptionService> _logger;
    private readonly IAuditLogService _auditLogService;

    public SubscriptionService(ApplicationDbContext context, IPaymentService paymentService, ILogger<SubscriptionService> logger, IAuditLogService auditLogService)
    {
        _context = context;
        _paymentService = paymentService;
        _logger = logger;
        _auditLogService = auditLogService;
    }

    // ===== POLICIES =====
    public async Task<List<MonthlyPassPolicyResponse>> GetAllPoliciesAsync()
    {
        var policies = await _context.MonthlyPassPolicies
            .Include(p => p.VehicleType)
            .ToListAsync();

        return policies.Select(MapToPolicyResponse).ToList();
    }

    public async Task<MonthlyPassPolicyResponse?> GetPolicyByVehicleTypeIdAsync(Guid vehicleTypeId)
    {
        var policy = await _context.MonthlyPassPolicies
            .Include(p => p.VehicleType)
            .FirstOrDefaultAsync(p => p.VehicleTypeId == vehicleTypeId && p.IsActive);

        return policy != null ? MapToPolicyResponse(policy) : null;
    }

    public async Task<MonthlyPassPolicyResponse> CreatePolicyAsync(CreateMonthlyPassPolicyRequest request, Guid adminId)
    {
        // Vô hiệu hóa các policy cũ của VehicleType này
        var existingPolicies = await _context.MonthlyPassPolicies
            .Where(p => p.VehicleTypeId == request.VehicleTypeId && p.IsActive)
            .ToListAsync();

        foreach (var p in existingPolicies)
        {
            p.IsActive = false;
            p.UpdatedAt = DateTime.UtcNow;
        }

        var newPolicy = new MonthlyPassPolicy
        {
            Id = Guid.NewGuid(),
            VehicleTypeId = request.VehicleTypeId,
            MonthlyPrice = request.MonthlyPrice,
            Description = request.Description,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.MonthlyPassPolicies.Add(newPolicy);
        await _context.SaveChangesAsync();

        var vehicleType = await _context.VehicleTypes.FindAsync(request.VehicleTypeId);
        newPolicy.VehicleType = vehicleType;

        await _auditLogService.LogAsync(adminId, "Create", "MonthlyPassPolicy", newPolicy.Id, null, null, $"Tạo bảng giá vé tháng mới cho {vehicleType?.Name} với giá {request.MonthlyPrice:N0} VND");

        return MapToPolicyResponse(newPolicy);
    }

    public async Task<MonthlyPassPolicyResponse?> UpdatePolicyAsync(Guid id, UpdateMonthlyPassPolicyRequest request, Guid adminId)
    {
        var policy = await _context.MonthlyPassPolicies
            .Include(p => p.VehicleType)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (policy == null) return null;

        var oldPrice = policy.MonthlyPrice;
        policy.MonthlyPrice = request.MonthlyPrice;
        policy.Description = request.Description;
        policy.IsActive = request.IsActive;
        policy.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _auditLogService.LogAsync(adminId, "Update", "MonthlyPassPolicy", policy.Id, null, null, $"Cập nhật bảng giá vé tháng. Giá: {oldPrice:N0} -> {request.MonthlyPrice:N0} VND");

        return MapToPolicyResponse(policy);
    }

    public async Task<bool> DeletePolicyAsync(Guid id, Guid adminId)
    {
        var policy = await _context.MonthlyPassPolicies.FindAsync(id);
        if (policy == null) return false;

        policy.IsActive = false;
        policy.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLogService.LogAsync(adminId, "Delete", "MonthlyPassPolicy", policy.Id, null, null, "Vô hiệu hóa bảng giá vé tháng");
        return true;
    }

    // ===== SUBSCRIPTIONS =====
    public async Task<List<SubscriptionResponse>> GetMySubscriptionsAsync(Guid driverId)
    {
        var subs = await _context.Subscriptions
            .Include(s => s.VehicleType)
            .Include(s => s.Driver)
            .Where(s => s.DriverId == driverId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        return subs.Select(MapToSubscriptionResponse).ToList();
    }

    public async Task<List<SubscriptionResponse>> GetAllSubscriptionsAsync()
    {
        var subs = await _context.Subscriptions
            .Include(s => s.VehicleType)
            .Include(s => s.Driver)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        return subs.Select(MapToSubscriptionResponse).ToList();
    }

    public async Task<object> RegisterSubscriptionAsync(Guid driverId, RegisterSubscriptionRequest request)
    {
        // 1. Tìm thông tin xe từ Profile của Driver
        var vehicle = await _context.Vehicles
            .Include(v => v.VehicleType)
            .FirstOrDefaultAsync(v => v.Id == request.VehicleId && v.DriverId == driverId);

        if (vehicle == null)
            throw new InvalidOperationException("Xe không tồn tại trong danh sách của bạn.");

        // 2. Kiểm tra xem xe này đã có vé tháng Active chưa
        var now = DateTime.UtcNow;
        var existingSub = await _context.Subscriptions
            .FirstOrDefaultAsync(s => s.LicensePlate == vehicle.PlateNumber
                                   && s.Status == SubscriptionStatus.Active
                                   && s.EndDate >= now);
        
        if (existingSub != null)
            throw new InvalidOperationException($"Biển số {vehicle.PlateNumber} đã có vé tháng có hiệu lực đến {existingSub.EndDate:dd/MM/yyyy}.");

        // 3. Lấy giá tiền từ MonthlyPassPolicy
        var policy = await _context.MonthlyPassPolicies
            .FirstOrDefaultAsync(p => p.VehicleTypeId == vehicle.VehicleTypeId && p.IsActive);
        
        if (policy == null)
            throw new InvalidOperationException($"Không có gói vé tháng nào được áp dụng cho loại xe {vehicle.VehicleType?.Name}.");

        var fee = policy.MonthlyPrice;

        // 4. Tạo Subscription Pending
        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            DriverId = driverId,
            VehicleTypeId = vehicle.VehicleTypeId,
            LicensePlate = vehicle.PlateNumber,
            StartDate = now,
            EndDate = now.AddDays(30), // Vé 30 ngày
            Status = SubscriptionStatus.PendingPayment,
            MonthlyPassPolicyId = policy.Id,
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.Subscriptions.Add(subscription);

        // 5. Nếu giá = 0, Active luôn
        if (fee == 0)
        {
            subscription.Status = SubscriptionStatus.Active;
            await _context.SaveChangesAsync();
            return new { Message = "Đăng ký vé tháng thành công (Miễn phí).", SubscriptionId = subscription.Id };
        }

        // 6. Xử lý thanh toán
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            if (request.PaymentMethod == PaymentMethod.Wallet)
            {
                var driver = await _context.Users.FindAsync(driverId);
                if (driver == null) throw new InvalidOperationException("Không tìm thấy người dùng.");

                if (driver.Balance < fee)
                    throw new InvalidOperationException($"INSUFFICIENT_BALANCE:{fee - driver.Balance}:{fee}:{driver.Balance}");

                driver.Balance -= fee;
                
                _context.WalletTransactions.Add(new WalletTransaction
                {
                    Id = Guid.NewGuid(),
                    UserId = driver.Id,
                    Amount = fee,
                    Type = "MonthlyPassPayment",
                    Status = "Success",
                    Description = $"Thanh toán vé tháng cho xe {vehicle.PlateNumber}",
                    CreatedAt = now
                });

                var payment = new Payment
                {
                    Id = Guid.NewGuid(),
                    Amount = fee,
                    Description = $"Thanh toán Ví cho Vé tháng xe {vehicle.PlateNumber}",
                    PaymentDate = now,
                    PaymentMethod = PaymentMethod.Wallet,
                    Status = PaymentStatus.Success,
                    PayOSOrderCode = long.Parse($"{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}{Random.Shared.Next(1000, 9999)}"),
                    CreatedAt = now,
                    UpdatedAt = now
                };
                _context.Payments.Add(payment);

                subscription.PaymentId = payment.Id;
                subscription.Status = SubscriptionStatus.Active;
                
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return new { Message = "Thanh toán bằng Ví thành công. Đã kích hoạt vé tháng.", SubscriptionId = subscription.Id };
            }
            else if (request.PaymentMethod == PaymentMethod.PayOS)
            {
                var returnUrl = "http://localhost:5500/monthlypass-result.html";
                var cancelUrl = "http://localhost:5500/monthlypass.html";
                var requestPayOs = new CreatePayOSPaymentRequest
                {
                    Amount = fee,
                    Description = $"Thanh toan ve thang xe {vehicle.PlateNumber}",
                    UserId = driverId,
                    ReturnUrl = returnUrl,
                    CancelUrl = cancelUrl
                };
                var payOSResponse = await _paymentService.CreatePayOSPaymentAsync(requestPayOs);

                subscription.PaymentId = payOSResponse.PaymentId;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return new
                {
                    Message = "Vui lòng thanh toán qua link PayOS.",
                    SubscriptionId = subscription.Id,
                    CheckoutUrl = payOSResponse.CheckoutUrl
                };
            }
            else
            {
                throw new InvalidOperationException("Phương thức thanh toán không được hỗ trợ cho vé tháng.");
            }
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> CancelSubscriptionAsync(Guid id, Guid driverId)
    {
        var sub = await _context.Subscriptions.FirstOrDefaultAsync(s => s.Id == id && s.DriverId == driverId);
        if (sub == null) return false;

        if (sub.Status == SubscriptionStatus.Active)
        {
            sub.Status = SubscriptionStatus.Canceled;
            sub.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }
        return false;
    }

    // ===== HELPERS =====
    private MonthlyPassPolicyResponse MapToPolicyResponse(MonthlyPassPolicy p) => new()
    {
        Id = p.Id,
        VehicleTypeId = p.VehicleTypeId,
        VehicleTypeName = p.VehicleType?.Name ?? string.Empty,
        MonthlyPrice = p.MonthlyPrice,
        Description = p.Description,
        IsActive = p.IsActive,
        CreatedAt = p.CreatedAt
    };

    private SubscriptionResponse MapToSubscriptionResponse(Subscription s) => new()
    {
        Id = s.Id,
        DriverId = s.DriverId,
        DriverName = s.Driver?.FullName ?? string.Empty,
        VehicleTypeId = s.VehicleTypeId,
        VehicleTypeName = s.VehicleType?.Name ?? string.Empty,
        LicensePlate = s.LicensePlate,
        StartDate = s.StartDate,
        EndDate = s.EndDate,
        Status = s.Status,
        PaymentId = s.PaymentId,
        CreatedAt = s.CreatedAt
    };
}
