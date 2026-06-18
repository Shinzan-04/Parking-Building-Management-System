using ParkingSystem.Application.DTOs.Dashboard;

namespace ParkingSystem.Application.Interfaces;

public interface IDashboardService
{
    Task<DashboardStatsResponse> GetRealtimeStatsAsync();
    Task<TrafficStatsResponse> GetTrafficStatsAsync(DateTime? fromDate = null, DateTime? toDate = null);
}
