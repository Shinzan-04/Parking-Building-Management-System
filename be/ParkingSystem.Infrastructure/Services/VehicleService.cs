using Microsoft.EntityFrameworkCore;
using ParkingSystem.Application.DTOs.Vehicle;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

public class VehicleService : IVehicleService
{
    private readonly ApplicationDbContext _context;

    public VehicleService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<VehicleResponse>> GetMyVehiclesAsync(Guid driverId)
    {
        return await _context.Vehicles
            .Include(v => v.VehicleType)
            .Where(v => v.DriverId == driverId)
            .Select(v => new VehicleResponse
            {
                Id = v.Id,
                PlateNumber = v.PlateNumber,
                VehicleTypeId = v.VehicleTypeId,
                VehicleTypeName = v.VehicleType.Name,
                IsPrimary = v.IsPrimary,
                CreatedAt = v.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<VehicleResponse> CreateVehicleAsync(Guid driverId, CreateVehicleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PlateNumber))
            throw new InvalidOperationException("Biển số xe không được để trống.");

        var existing = await _context.Vehicles
            .AnyAsync(v => v.PlateNumber == request.PlateNumber && v.DriverId == driverId);
        if (existing)
            throw new InvalidOperationException("Biển số xe này đã được đăng ký trong tài khoản của bạn.");

        var vehicleType = await _context.VehicleTypes.FindAsync(request.VehicleTypeId);
        if (vehicleType == null)
            throw new InvalidOperationException("Loại xe không hợp lệ.");

        // Nếu đây là xe đầu tiên thì tự động set IsPrimary
        var isFirstVehicle = !await _context.Vehicles.AnyAsync(v => v.DriverId == driverId);

        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid(),
            DriverId = driverId,
            PlateNumber = request.PlateNumber.Trim(),
            VehicleTypeId = request.VehicleTypeId,
            IsPrimary = isFirstVehicle,
            CreatedAt = DateTime.UtcNow
        };

        _context.Vehicles.Add(vehicle);
        await _context.SaveChangesAsync();

        return new VehicleResponse
        {
            Id = vehicle.Id,
            PlateNumber = vehicle.PlateNumber,
            VehicleTypeId = vehicle.VehicleTypeId,
            VehicleTypeName = vehicleType.Name,
            IsPrimary = vehicle.IsPrimary,
            CreatedAt = vehicle.CreatedAt
        };
    }

    public async Task<VehicleResponse> UpdateVehicleAsync(Guid id, Guid driverId, UpdateVehicleRequest request)
    {
        var vehicle = await _context.Vehicles
            .Include(v => v.VehicleType)
            .FirstOrDefaultAsync(v => v.Id == id && v.DriverId == driverId);

        if (vehicle == null)
            throw new InvalidOperationException("Không tìm thấy phương tiện.");

        if (string.IsNullOrWhiteSpace(request.PlateNumber))
            throw new InvalidOperationException("Biển số xe không được để trống.");

        var existing = await _context.Vehicles
            .AnyAsync(v => v.PlateNumber == request.PlateNumber && v.DriverId == driverId && v.Id != id);
        if (existing)
            throw new InvalidOperationException("Biển số xe này đã bị trùng lặp với xe khác của bạn.");

        var vehicleType = await _context.VehicleTypes.FindAsync(request.VehicleTypeId);
        if (vehicleType == null)
            throw new InvalidOperationException("Loại xe không hợp lệ.");

        vehicle.PlateNumber = request.PlateNumber.Trim();
        vehicle.VehicleTypeId = request.VehicleTypeId;
        vehicle.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return new VehicleResponse
        {
            Id = vehicle.Id,
            PlateNumber = vehicle.PlateNumber,
            VehicleTypeId = vehicle.VehicleTypeId,
            VehicleTypeName = vehicleType.Name,
            IsPrimary = vehicle.IsPrimary,
            CreatedAt = vehicle.CreatedAt
        };
    }

    public async Task<bool> DeleteVehicleAsync(Guid id, Guid driverId)
    {
        var vehicle = await _context.Vehicles.FirstOrDefaultAsync(v => v.Id == id && v.DriverId == driverId);
        if (vehicle == null) return false;

        // Xóa xe thì không cần xét constraints nhiều (hoặc set IsDeleted = true tùy rule). 
        // Trong context EF Core nếu có quan hệ sẽ bị bắt ráng. 
        // Tạm thời hard delete vì vehicles ít dính khóa ngoại tới logic cứng.
        _context.Vehicles.Remove(vehicle);
        
        // Nếu xóa xe primary, lấy xe kế tiếp (nếu có) set thành primary
        if (vehicle.IsPrimary)
        {
            var nextVehicle = await _context.Vehicles.FirstOrDefaultAsync(v => v.DriverId == driverId && v.Id != id);
            if (nextVehicle != null)
            {
                nextVehicle.IsPrimary = true;
            }
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> SetPrimaryVehicleAsync(Guid id, Guid driverId)
    {
        var vehicles = await _context.Vehicles.Where(v => v.DriverId == driverId).ToListAsync();
        var targetVehicle = vehicles.FirstOrDefault(v => v.Id == id);
        if (targetVehicle == null) throw new InvalidOperationException("Không tìm thấy phương tiện.");

        foreach (var v in vehicles)
        {
            v.IsPrimary = (v.Id == id);
            v.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return true;
    }
}
