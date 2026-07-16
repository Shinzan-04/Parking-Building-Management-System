namespace ParkingSystem.Application.Interfaces;

public interface IRealtimeService
{
    // Bắn trigger yêu cầu Dashboard tự update
    Task SendDashboardUpdateAsync();
    
    // Gửi cập nhật trạng thái của 1 ô đỗ xe (Trống/Đã có xe)
    Task SendSlotStatusUpdateAsync(Guid slotId, string status);
    
    // Gửi thông báo thanh toán thành công cho App của khách
    Task SendPaymentSuccessAsync(Guid reservationId);

    // Gửi thông báo hoàn thành phiên đỗ xe (Checkout thành công) cho User
    Task SendCheckoutSuccessAsync(Guid userId, Guid sessionId);

    // Gửi Notification cho 1 user cụ thể (theo userId)
    Task SendNotificationAsync(Guid userId, string message);

    // Báo động cho toàn bộ Staff
    Task BroadcastNotificationToStaffAsync(string message);

    // Gửi cập nhật số dư ví cho user cụ thể
    Task SendWalletUpdateAsync(Guid userId, decimal newBalance);
}
