using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SeedController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public SeedController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost("history")]
    public async Task<IActionResult> SeedHistory([FromBody] List<Guid> buildingIds)
    {
        if (buildingIds == null || !buildingIds.Any())
            return BadRequest("Vui lòng cung cấp danh sách BuildingId.");

        var random = new Random();
        var sessionsToAdd = new List<ParkingSession>();

        // Lấy tất cả slot thuộc các tòa nhà được cung cấp
        var slots = await _context.ParkingSlots
            .Include(s => s.Floor)
            .Where(s => s.Floor != null && buildingIds.Contains(s.Floor.BuildingId))
            .ToListAsync();

        if (!slots.Any())
            return BadRequest("Không tìm thấy slot nào cho các tòa nhà này.");

        // Lấy danh sách loại xe để random
        var vehicleTypes = await _context.VehicleTypes.ToListAsync();
        if (!vehicleTypes.Any())
            return BadRequest("Hệ thống chưa có VehicleType nào.");

        // Lấy danh sách user có role Driver để random
        var drivers = await _context.Users.Where(u => u.Role == Role.Driver).ToListAsync();
        
        var now = DateTime.UtcNow;
        // Seed dữ liệu cho 12 tháng qua
        var startDate = now.AddMonths(-12);

        // Sinh khoảng 1000 phiên giao dịch
        for (int i = 0; i < 1000; i++)
        {
            var slot = slots[random.Next(slots.Count)];
            var vt = vehicleTypes[random.Next(vehicleTypes.Count)];
            
            // Random ngày giờ trong 12 tháng qua
            var randomDays = random.Next((now - startDate).Days);
            var entryTime = startDate.AddDays(randomDays).AddHours(random.Next(6, 20)).AddMinutes(random.Next(0, 60));
            
            // Thời gian đỗ từ 1 đến 8 tiếng
            var durationHours = random.Next(1, 8);
            var exitTime = entryTime.AddHours(durationHours).AddMinutes(random.Next(0, 60));

            // Tính tiền cơ bản (giả lập)
            var fee = durationHours * (vt.Name.Contains("Car") ? 20000m : 5000m);

            var driver = drivers.Any() ? drivers[random.Next(drivers.Count)] : null;

            var session = new ParkingSession
            {
                Id = Guid.NewGuid(),
                DriverId = driver?.Id,
                ParkingSlotId = slot.Id,
                VehicleTypeId = vt.Id,
                LicensePlate = $"SEED-{random.Next(1000, 9999)}",
                SessionCode = $"SS-SEED-{DateTime.UtcNow.Ticks}-{i}",
                CheckInMethod = CheckInMethod.WalkIn,
                EntryTime = entryTime,
                ExitTime = exitTime,
                TotalFee = fee,
                Status = SessionStatus.Completed,
                CreatedAt = entryTime,
                UpdatedAt = exitTime
            };
            
            sessionsToAdd.Add(session);
        }

        _context.ParkingSessions.AddRange(sessionsToAdd);
        await _context.SaveChangesAsync();

        return Ok(new { message = $"Đã tạo thành công {sessionsToAdd.Count} phiên đỗ xe giả lập trong quá khứ cho {buildingIds.Count} tòa nhà." });
    }
}
