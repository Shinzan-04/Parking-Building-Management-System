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

    public async Task SendNotificationAsync(string message)
    {
        await _hubContext.Clients.All.SendAsync("ReceiveNotification", message);
    }
}
