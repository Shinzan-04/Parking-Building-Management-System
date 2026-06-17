namespace ParkingSystem.Application.Interfaces;

public interface IRealtimeService
{
    // Bắn trigger yêu cầu Dashboard tự update
    Task SendDashboardUpdateAsync();
    
    // Gửi cập nhật trạng thái của 1 ô đỗ xe (Trống/Đã có xe)
    Task SendSlotStatusUpdateAsync(Guid slotId, string status);
    
    // Gửi thông báo thanh toán thành công cho App của khách
    Task SendPaymentSuccessAsync(Guid reservationId);

    // Gửi Notification chung
    Task SendNotificationAsync(string message);
}
