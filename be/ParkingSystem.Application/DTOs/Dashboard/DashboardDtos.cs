namespace ParkingSystem.Application.DTOs.Dashboard;

public class DashboardStatsResponse
{
    public int TotalSlots { get; set; }
    public int AvailableSlots { get; set; }
    public int OccupiedSlots { get; set; }
    public int ActiveSessions { get; set; }
}

public class TrafficStatsResponse
{
    public int TotalCheckIns { get; set; }
    public int TotalCheckOuts { get; set; }
    public List<HourlyTrafficDto> HourlyData { get; set; } = new();
}

public class HourlyTrafficDto
{
    public int Hour { get; set; }
    public int CheckIns { get; set; }
    public int CheckOuts { get; set; }
}
