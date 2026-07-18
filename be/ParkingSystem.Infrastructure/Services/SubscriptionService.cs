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
    private readonly INotificationService _notificationService;

    public SubscriptionService(ApplicationDbContext context, IPaymentService paymentService, ILogger<SubscriptionService> logger, IAuditLogService auditLogService, INotificationService notificationService)
    {
        _context = context;
        _paymentService = paymentService;
        _logger = logger;
        _auditLogService = auditLogService;
        _notificationService = notificationService;
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
        var myLicensePlates = await _context.Vehicles
            .Where(v => v.DriverId == driverId)
            .Select(v => v.PlateNumber)
            .ToListAsync();

        var subs = await _context.Subscriptions
            .Include(s => s.VehicleType)
            .Include(s => s.Driver)
            .Where(s => s.DriverId == driverId || myLicensePlates.Contains(s.LicensePlate))
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        var responses = new List<SubscriptionResponse>();
        var now = DateTime.UtcNow;

        foreach (var s in subs)
        {
            var res = MapToSubscriptionResponse(s);
            
            if (s.Status == SubscriptionStatus.Active)
            {
                bool isUsed = await _context.ParkingSessions.AnyAsync(p => p.LicensePlate == s.LicensePlate && p.EntryTime >= s.StartDate && p.EntryTime <= now);
                bool isExpired = (now - s.StartDate).TotalDays > 3;

                if (isUsed)
                {
                    res.CanCancel = false;
                    res.CancelValidationMessage = "Vé đã được sử dụng (có lượt vào ra), không thể hủy.";
                }
                else if (isExpired)
                {
                    res.CanCancel = false;
                    res.CancelValidationMessage = "Vé đã đăng ký quá 3 ngày, không thể hủy.";
                }
                else
                {
                    res.CanCancel = true;
                    res.CancelValidationMessage = null;
                }
            }
            else
            {
                res.CanCancel = false;
                res.CancelValidationMessage = "Vé không ở trạng thái Active.";
            }

            responses.Add(res);
        }

        return responses;
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
            .Where(s => s.LicensePlate == vehicle.PlateNumber && s.Status == SubscriptionStatus.Active)
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync();
        
        DateTime newStartDate;
        DateTime newEndDate;

        if (existingSub != null && existingSub.EndDate > now)
        {
            // Nối tiếp thời gian nếu vé cũ vẫn còn hạn
            newStartDate = existingSub.EndDate;
            newEndDate = existingSub.EndDate.AddDays(30);
        }
        else
        {
            // Nếu không có vé cũ hoặc vé cũ đã hết hạn
            newStartDate = now;
            newEndDate = now.AddDays(30);
        }

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
            StartDate = newStartDate,
            EndDate = newEndDate, // Vé 30 ngày
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
                    throw new InvalidOperationException($"Số dư trong ví không đủ! Phí vé tháng là {fee:N0} VND, nhưng số dư của bạn chỉ còn {driver.Balance:N0} VND. Vui lòng chọn PayOS hoặc nạp thêm tiền vào ví.");

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
                    Message = "Vui lòng thanh toán qua PayOS.",
                    SubscriptionId = subscription.Id,
                    CheckoutUrl = payOSResponse.CheckoutUrl,
                    // Chuỗi QR VietQR thật — frontend render thành ảnh QR để user quét
                    QrCode = payOSResponse.QrCode,
                    // OrderCode — dùng để FE poll GET /api/payments/verify/{orderCode} và kích hoạt vé
                    // ngay cả khi webhook PayOS không gọi tới được (vd. backend chạy local)
                    OrderCode = payOSResponse.OrderCode
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

        if (sub.Status == SubscriptionStatus.Active || sub.Status == SubscriptionStatus.PendingPayment)
        {
            sub.Status = SubscriptionStatus.Canceled;
            sub.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }
        return false;
    }

    public async Task<bool> VerifySubscriptionPaymentAsync(Guid id, Guid driverId)
    {
        var sub = await _context.Subscriptions.FirstOrDefaultAsync(s => s.Id == id && s.DriverId == driverId);
        if (sub == null || sub.Status != SubscriptionStatus.PendingPayment || !sub.PaymentId.HasValue)
            return sub?.Status == SubscriptionStatus.Active;

        var payment = await _context.Payments.FindAsync(sub.PaymentId.Value);
        if (payment == null || payment.PaymentMethod != PaymentMethod.PayOS)
            return false;

        var (_, status) = await _paymentService.VerifyPayOSPaymentAsync(payment.PayOSOrderCode);
        if (status != PaymentStatus.Success)
            return false;

        payment.Status = PaymentStatus.Success;
        payment.UpdatedAt = DateTime.UtcNow;
        sub.Status = SubscriptionStatus.Active;
        sub.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _notificationService.SendAsync(
            sub.DriverId,
            "Vé tháng đã kích hoạt",
            $"Vé tháng cho xe {sub.LicensePlate} đã thanh toán thành công và có hiệu lực đến {sub.EndDate:dd/MM/yyyy}.",
            "SubscriptionActivated",
            sub.Id
        );

        return true;
    }

    public async Task<bool> RequestCancelAsync(Guid id, Guid driverId, string reason)
    {
        var sub = await _context.Subscriptions
            .Include(s => s.VehicleType)
            .FirstOrDefaultAsync(s => s.Id == id && s.DriverId == driverId);
            
        if (sub == null || sub.Status != SubscriptionStatus.Active) return false;

        // Check if used (has any ParkingSession)
        var isUsed = await _context.ParkingSessions.AnyAsync(p => p.LicensePlate == sub.LicensePlate && p.EntryTime >= sub.StartDate && p.EntryTime <= DateTime.UtcNow);
        if (isUsed) throw new InvalidOperationException("Vé đã được sử dụng (có lượt vào ra), không thể yêu cầu hủy.");

        // Check if > 3 days
        if ((DateTime.UtcNow - sub.StartDate).TotalDays > 3)
            throw new InvalidOperationException("Vé đã đăng ký quá 3 ngày, không thể yêu cầu hủy.");

        sub.Status = SubscriptionStatus.PendingCancel;
        sub.CancelReason = reason;
        sub.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync();
        
        // Gửi thông báo cho Admin (tất cả user có role Admin/Manager)
        var admins = await _context.Users.Where(u => u.Role == Role.Admin || u.Role == Role.Manager).ToListAsync();
        foreach (var admin in admins)
        {
            await _notificationService.SendAsync(
                admin.Id,
                "Yêu cầu hủy vé tháng",
                $"Tài xế yêu cầu hủy vé tháng xe {sub.LicensePlate}. Lý do: {reason}",
                "CancelRequest",
                sub.Id
            );
        }

        await _auditLogService.LogAsync(driverId, "RequestCancelSub", "Subscription", sub.Id, 
            new { OldStatus = SubscriptionStatus.Active.ToString() }, 
            new { NewStatus = sub.Status.ToString(), Reason = reason });

        return true;
    }

    public async Task<bool> ProcessCancelRequestAsync(Guid id, Guid adminId, bool isApproved, decimal refundAmount, string? rejectReason)
    {
        var sub = await _context.Subscriptions
            .Include(s => s.Driver)
            .FirstOrDefaultAsync(s => s.Id == id);
            
        if (sub == null || sub.Status != SubscriptionStatus.PendingCancel) return false;

        if (isApproved)
        {
            sub.Status = SubscriptionStatus.Canceled;
            
            // Calculate 70% refund based on original Payment
            refundAmount = 0;
            if (sub.PaymentId.HasValue)
            {
                var payment = await _context.Payments.FindAsync(sub.PaymentId.Value);
                if (payment != null) refundAmount = payment.Amount * 0.7m;
            }

            // Hoàn tiền nếu có
            if (refundAmount > 0 && sub.Driver != null)
            {
                sub.Driver.Balance += refundAmount;
                _context.WalletTransactions.Add(new WalletTransaction
                {
                    Id = Guid.NewGuid(),
                    UserId = sub.DriverId,
                    Amount = refundAmount,
                    Type = "RefundMonthlyPass",
                    Status = "Success",
                    Description = $"Hoàn 70% tiền admin duyệt hủy vé tháng xe {sub.LicensePlate}",
                    ReferenceId = sub.Id.ToString(),
                    CreatedAt = DateTime.UtcNow
                });
            }

            await _notificationService.SendAsync(
                sub.DriverId,
                "Đã duyệt hủy vé tháng",
                $"Yêu cầu hủy vé tháng xe {sub.LicensePlate} đã được duyệt. Bạn được hoàn lại {refundAmount:N0} VND vào ví.",
                "CancelApproved",
                sub.Id
            );
        }
        else
        {
            sub.Status = SubscriptionStatus.Active;
            sub.CancelRejectReason = rejectReason;
            
            await _notificationService.SendAsync(
                sub.DriverId,
                "Từ chối hủy vé tháng",
                $"Yêu cầu hủy vé tháng xe {sub.LicensePlate} bị từ chối. Lý do: {rejectReason}",
                "CancelRejected",
                sub.Id
            );
        }

        sub.UpdatedAt = DateTime.UtcNow;
        
        await _auditLogService.LogAsync(adminId, isApproved ? "ApproveCancelSub" : "RejectCancelSub", "Subscription", sub.Id, 
            new { OldStatus = SubscriptionStatus.PendingCancel.ToString() }, 
            new { NewStatus = sub.Status.ToString(), RefundAmount = refundAmount, RejectReason = rejectReason });
            
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> AdminForceCancelAsync(Guid id, Guid adminId, decimal refundAmount, string reason)
    {
        var sub = await _context.Subscriptions
            .Include(s => s.Driver)
            .FirstOrDefaultAsync(s => s.Id == id);
            
        if (sub == null || (sub.Status != SubscriptionStatus.Active && sub.Status != SubscriptionStatus.PendingCancel && sub.Status != SubscriptionStatus.PendingPayment)) 
            return false;

        var oldStatus = sub.Status.ToString();
        sub.Status = SubscriptionStatus.Canceled;
        sub.CancelReason = "Admin tự hủy: " + reason;
        sub.UpdatedAt = DateTime.UtcNow;
        
        // Hoàn tiền nếu có (chỉ cho Active hoặc PendingCancel)
        if (refundAmount > 0 && sub.Driver != null && oldStatus != "PendingPayment")
        {
            sub.Driver.Balance += refundAmount;
            _context.WalletTransactions.Add(new WalletTransaction
            {
                Id = Guid.NewGuid(),
                UserId = sub.DriverId,
                Amount = refundAmount,
                Type = "RefundMonthlyPass",
                Status = "Success",
                Description = $"Hoàn tiền admin hủy vé tháng xe {sub.LicensePlate}",
                ReferenceId = sub.Id.ToString(),
                CreatedAt = DateTime.UtcNow
            });
        }

        await _notificationService.SendAsync(
            sub.DriverId,
            "Vé tháng bị hủy",
            $"Vé tháng xe {sub.LicensePlate} của bạn đã bị quản trị viên hủy. Lý do: {reason}. Bạn được hoàn lại {refundAmount:N0} VND vào ví.",
            "AdminForceCancel",
            sub.Id
        );

        await _auditLogService.LogAsync(adminId, "AdminForceCancelSub", "Subscription", sub.Id, 
            new { OldStatus = oldStatus }, 
            new { NewStatus = sub.Status.ToString(), RefundAmount = refundAmount, Reason = reason });
            
        await _context.SaveChangesAsync();
        return true;
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
        CreatedAt = s.CreatedAt,
        CancelReason = s.CancelReason,
        CancelRejectReason = s.CancelRejectReason
    };
}
