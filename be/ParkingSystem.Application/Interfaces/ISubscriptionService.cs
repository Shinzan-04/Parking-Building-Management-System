using ParkingSystem.Application.DTOs.MonthlyPass;

namespace ParkingSystem.Application.Interfaces;

public interface ISubscriptionService
{
    // Policies
    Task<List<MonthlyPassPolicyResponse>> GetAllPoliciesAsync();
    Task<MonthlyPassPolicyResponse?> GetPolicyByVehicleTypeIdAsync(Guid vehicleTypeId);
    Task<MonthlyPassPolicyResponse> CreatePolicyAsync(CreateMonthlyPassPolicyRequest request, Guid adminId);
    Task<MonthlyPassPolicyResponse?> UpdatePolicyAsync(Guid id, UpdateMonthlyPassPolicyRequest request, Guid adminId);
    Task<bool> DeletePolicyAsync(Guid id, Guid adminId);

    // Subscriptions
    Task<List<SubscriptionResponse>> GetMySubscriptionsAsync(Guid driverId);
    Task<List<SubscriptionResponse>> GetAllSubscriptionsAsync();
    
    /// <summary>
    /// Đăng ký vé tháng: Tạo Subscription + tạo Payment (trả về QR PayOS hoặc thanh toán Ví trực tiếp)
    /// </summary>
    Task<object> RegisterSubscriptionAsync(Guid driverId, RegisterSubscriptionRequest request);

    Task<bool> CancelSubscriptionAsync(Guid id, Guid driverId);
    
    Task<bool> RequestCancelAsync(Guid id, Guid driverId, string reason);
    Task<bool> ProcessCancelRequestAsync(Guid id, Guid adminId, bool isApproved, decimal refundAmount, string? rejectReason);
    Task<bool> AdminForceCancelAsync(Guid id, Guid adminId, decimal refundAmount, string reason);
}
