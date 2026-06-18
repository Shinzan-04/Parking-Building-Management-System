using Microsoft.EntityFrameworkCore;
using ParkingSystem.Application.DTOs.Dashboard;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

public class DashboardService : IDashboardService
{
    private readonly ApplicationDbContext _context;

    public DashboardService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<DashboardStatsResponse> GetRealtimeStatsAsync()
    {
        var totalSlots = await _context.ParkingSlots.CountAsync();
        var availableSlots = await _context.ParkingSlots.CountAsync(s => s.Status == SlotStatus.Available);
        var occupiedSlots = await _context.ParkingSlots.CountAsync(s => s.Status == SlotStatus.Occupied);
        var activeSessions = await _context.ParkingSessions.CountAsync(s => s.Status == SessionStatus.Active);

        return new DashboardStatsResponse
        {
            TotalSlots = totalSlots,
            AvailableSlots = availableSlots,
            OccupiedSlots = occupiedSlots,
            ActiveSessions = activeSessions
        };
    }

    public async Task<DashboardStatsResponse> GetRealtimeStatsByBuildingAsync(Guid buildingId)
    {
        var totalSlots = await _context.ParkingSlots
            .CountAsync(s => s.Floor != null && s.Floor.BuildingId == buildingId);
        var availableSlots = await _context.ParkingSlots
            .CountAsync(s => s.Floor != null && s.Floor.BuildingId == buildingId && s.Status == SlotStatus.Available);
        var occupiedSlots = await _context.ParkingSlots
            .CountAsync(s => s.Floor != null && s.Floor.BuildingId == buildingId && s.Status == SlotStatus.Occupied);
        var activeSessions = await _context.ParkingSessions
            .CountAsync(s => s.Status == SessionStatus.Active
                          && s.ParkingSlot != null
                          && s.ParkingSlot.Floor != null
                          && s.ParkingSlot.Floor.BuildingId == buildingId);

        return new DashboardStatsResponse
        {
            TotalSlots = totalSlots,
            AvailableSlots = availableSlots,
            OccupiedSlots = occupiedSlots,
            ActiveSessions = activeSessions
        };
    }

    public async Task<TrafficStatsResponse> GetTrafficStatsAsync(DateTime? fromDate = null, DateTime? toDate = null)
    {
        var start = fromDate ?? DateTime.UtcNow.Date; // Mặc định đầu ngày hôm nay (UTC)
        var end = toDate ?? start.AddDays(1);         // Mặc định hết ngày hôm nay

        var sessions = await _context.ParkingSessions
            .Where(s => s.EntryTime >= start && s.EntryTime < end)
            .ToListAsync();

        // Xe vào
        var checkIns = sessions;
        // Xe ra (ExitTime nằm trong khoảng)
        var checkOuts = await _context.ParkingSessions
            .Where(s => s.ExitTime != null && s.ExitTime >= start && s.ExitTime < end)
            .ToListAsync();

        var hourlyData = new List<HourlyTrafficDto>();
        for (int i = 0; i < 24; i++)
        {
            var currentHourCheckIns = checkIns.Count(s => s.EntryTime.Hour == i);
            var currentHourCheckOuts = checkOuts.Count(s => s.ExitTime.HasValue && s.ExitTime.Value.Hour == i);

            hourlyData.Add(new HourlyTrafficDto
            {
                Hour = i,
                CheckIns = currentHourCheckIns,
                CheckOuts = currentHourCheckOuts
            });
        }

        return new TrafficStatsResponse
        {
            TotalCheckIns = checkIns.Count,
            TotalCheckOuts = checkOuts.Count,
            HourlyData = hourlyData
        };
    }
}
