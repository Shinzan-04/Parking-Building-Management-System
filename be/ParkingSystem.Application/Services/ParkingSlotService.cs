using ParkingSystem.Application.DTOs.ParkingSlot;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Domain.Interfaces;

namespace ParkingSystem.Application.Services;

public class ParkingSlotService : IParkingSlotService
{
    private readonly IGenericRepository<ParkingSlot> _repository;
    private readonly IGenericRepository<Reservation> _reservationRepo;
    private readonly IGenericRepository<ParkingSession> _sessionRepo;

    public ParkingSlotService(
        IGenericRepository<ParkingSlot> repository,
        IGenericRepository<Reservation> reservationRepo,
        IGenericRepository<ParkingSession> sessionRepo)
    {
        _repository = repository;
        _reservationRepo = reservationRepo;
        _sessionRepo = sessionRepo;
    }

    public async Task<IEnumerable<ParkingSlotResponse>> GetAllAsync(Guid? buildingId = null)
    {
        var slots = await _repository.GetAllAsync("VehicleType,Floor,ParkingSessions");
        if (buildingId.HasValue)
        {
            slots = slots.Where(s => s.Floor != null && s.Floor.BuildingId == buildingId.Value);
        }
        return slots.Select(s => MapToResponse(s));
    }

    public async Task<IEnumerable<ParkingSlotResponse>> GetByFloorIdAsync(Guid floorId)
    {
        var slots = await _repository.FindAsync(s => s.FloorId == floorId, "VehicleType,Floor,ParkingSessions");
        return slots.Select(s => MapToResponse(s));
    }

    public async Task<IEnumerable<ParkingSlotResponse>> GetAvailableByVehicleTypeAsync(Guid vehicleTypeId)
    {
        var slots = await _repository.FindAsync(s => s.VehicleTypeId == vehicleTypeId && s.Status == SlotStatus.Available, "VehicleType,Floor,ParkingSessions");
        return slots.Select(s => MapToResponse(s));
    }

    public async Task<ParkingSlotResponse?> GetByIdAsync(Guid id)
    {
        var slots = await _repository.FindAsync(s => s.Id == id, "VehicleType,Floor,ParkingSessions");
        var slot = slots.FirstOrDefault();
        return slot == null ? null : MapToResponse(slot);
    }

    public async Task<ParkingSlotResponse> CreateAsync(CreateParkingSlotRequest request)
    {
        var slot = new ParkingSlot
        {
            Id = Guid.NewGuid(),
            FloorId = request.FloorId,
            VehicleTypeId = request.VehicleTypeId,
            SlotNumber = request.SlotNumber,
            Status = SlotStatus.Available
        };

        await _repository.AddAsync(slot);
        return MapToResponse(slot);
    }

    public async Task<ParkingSlotResponse?> UpdateStatusAsync(Guid id, UpdateParkingSlotStatusRequest request)
    {
        var slots = await _repository.FindAsync(s => s.Id == id, "VehicleType,Floor,ParkingSessions");
        var slot = slots.FirstOrDefault();
        if (slot == null) return null;

        slot.Status = request.Status;
        slot.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(slot);
        return MapToResponse(slot);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var slot = await _repository.GetByIdAsync(id);
        if (slot == null) return false;

        await _repository.DeleteAsync(slot);
        return true;
    }

    public async Task<IEnumerable<ParkingSlotResponse>> GetAvailabilityByFloorAsync(Guid floorId, DateTime startTime, DateTime endTime)
    {
        // Lấy tất cả slot vật lý của tầng
        var slots = await _repository.FindAsync(s => s.FloorId == floorId, "VehicleType,Floor,ParkingSessions");
        
        // Tất cả trạng thái Reservation đang "chiếm giữ" ô đỗ
        // PaymentPending: Đang chờ thanh toán (giữ 15 phút)
        // Paid: Đã thanh toán xong, chờ Staff duyệt
        // PendingReview: Đang chờ Staff duyệt
        // Confirmed: Staff đã duyệt, chờ Driver đến
        // CheckedIn: Driver đã check-in, đang đỗ xe
        var activeStatuses = new[] 
        { 
            ReservationStatus.PaymentPending, 
            ReservationStatus.Paid,
            ReservationStatus.PendingReview,
            ReservationStatus.Confirmed, 
            ReservationStatus.CheckedIn 
        };
        
        // Tìm tất cả Reservation đang hoạt động trên tầng này
        var reservations = await _reservationRepo.FindAsync(
            r => r.ParkingSlot.FloorId == floorId && activeStatuses.Contains(r.Status));
        
        // Lọc ra những Reservation có khung giờ trùng lắp (overlap) với thời gian đặt mới
        var overlappingSlotIds = reservations
            .Where(r => r.StartTime < endTime && r.EndTime > startTime)
            .Select(r => r.ParkingSlotId)
            .Distinct()
            .ToList();

        var responses = slots.Select(s => MapToResponse(s)).ToList();
        var isImmediate = startTime <= DateTime.UtcNow.AddMinutes(30);

        foreach(var res in responses)
        {
            if (overlappingSlotIds.Contains(res.Id))
            {
                // Có Reservation trùng giờ → đánh dấu Reserved (không cho đặt)
                res.Status = SlotStatus.Reserved; 
            }
            else if (!isImmediate)
            {
                // Đặt cho tương lai VÀ không có ai đặt trùng → mở slot
                // Dù vật lý slot đang Occupied (có xe đỗ hiện tại),
                // nhưng đến ngày tương lai xe đó đã đi rồi → Available
                res.Status = SlotStatus.Available;
            }
            // Nếu isImmediate VÀ không overlap → giữ nguyên status vật lý
            // (nếu Occupied thì vẫn Occupied, Available thì vẫn Available)
        }

        return responses;
    }

    public async Task<CurrentVehicleResponse?> GetCurrentVehicleAsync(Guid slotId)
    {
        var slot = await _repository.GetByIdAsync(slotId);
        if (slot == null) return null;

        var now = DateTime.UtcNow;

        // 1. Kiểm tra xem có xe nào đang đỗ không (ParkingSession)
        // Xe đang đỗ có thể là Active hoặc Overdue
        var activeSessions = await _sessionRepo.FindAsync(s => s.ParkingSlotId == slotId && (s.Status == SessionStatus.Active || s.Status == SessionStatus.Overdue));
        var activeSession = activeSessions.FirstOrDefault();
        
        if (activeSession != null)
        {
            return new CurrentVehicleResponse
            {
                LicensePlate = string.IsNullOrWhiteSpace(activeSession.LicensePlate) ? null : activeSession.LicensePlate,
                Status = activeSession.Status == SessionStatus.Overdue ? "Overdue" : "Occupied",
                ExpectedEndTime = activeSession.ExitTime // or null
            };
        }

        // 2. Nếu không có xe đỗ, kiểm tra xem có ai đặt trước không (Reservation)
        var activeStatuses = new[] 
        { 
            ReservationStatus.PaymentPending, 
            ReservationStatus.Paid,
            ReservationStatus.PendingReview,
            ReservationStatus.Confirmed 
        };

        var reservations = await _reservationRepo.FindAsync(
            r => r.ParkingSlotId == slotId && activeStatuses.Contains(r.Status));
        
        // Lấy cái gần nhất
        var activeReservation = reservations.OrderBy(r => r.StartTime).FirstOrDefault();

        if (activeReservation != null)
        {
            return new CurrentVehicleResponse
            {
                LicensePlate = string.IsNullOrWhiteSpace(activeReservation.LicensePlate) ? null : activeReservation.LicensePlate,
                Status = "Reserved",
                ExpectedEndTime = activeReservation.EndTime
            };
        }

        // 3. Trống
        return new CurrentVehicleResponse
        {
            LicensePlate = null,
            Status = "Available",
            ExpectedEndTime = null
        };
    }

    private static ParkingSlotResponse MapToResponse(ParkingSlot s) => new()
    {
        Id = s.Id,
        FloorId = s.FloorId,
        FloorName = s.Floor?.Name ?? string.Empty,
        VehicleTypeId = s.VehicleTypeId,
        VehicleTypeName = s.VehicleType?.Name ?? string.Empty,
        SlotNumber = s.SlotNumber,
        Status = s.Status,
        Row = s.Row,
        Column = s.Column,
        DistanceToEntry = s.DistanceToEntry,
        CurrentLicensePlate = s.ParkingSessions?.FirstOrDefault(ps => ps.Status == SessionStatus.Active || ps.Status == SessionStatus.Overdue)?.LicensePlate,
        CreatedAt = s.CreatedAt
    };
}
