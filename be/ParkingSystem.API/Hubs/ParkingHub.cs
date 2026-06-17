using Microsoft.AspNetCore.SignalR;

namespace ParkingSystem.API.Hubs;

public class ParkingHub : Hub
{
    // Clients có thể gửi message lên đây nếu cần, 
    // nhưng phần lớn Server sẽ chủ động Push xuống Client.
}
