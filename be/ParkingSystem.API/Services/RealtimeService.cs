using Microsoft.AspNetCore.SignalR;
using ParkingSystem.API.Hubs;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Services;

public class RealtimeService : IRealtimeService
{
    private readonly IHubContext<ParkingHub> _hubContext;

    public RealtimeService(IHubContext<ParkingHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task SendDashboardUpdateAsync()
    {
        // Gửi tín hiệu báo cho Client tự gọi lại API GetRealtimeStats 
        // hoặc push thẳng Data (nhưng gọi lại API sẽ sạch hơn nếu data lớn).
        await _hubContext.Clients.All.SendAsync("ReceiveDashboardUpdate");
    }

    public async Task SendSlotStatusUpdateAsync(Guid slotId, string status)
    {
        await _hubContext.Clients.All.SendAsync("ReceiveSlotUpdate", new { slotId, status });
    }

    public async Task SendPaymentSuccessAsync(Guid reservationId)
    {
        await _hubContext.Clients.All.SendAsync("ReceivePaymentSuccess", reservationId);
    }

    /// <summary>
    /// Gửi tín hiệu realtime thông báo cho 1 user cụ thể (theo UserId trong JWT claim)
    /// </summary>
    public async Task SendNotificationAsync(Guid userId, string message)
    {
        await _hubContext.Clients.User(userId.ToString()).SendAsync("ReceiveNotification", message);
    }
}
