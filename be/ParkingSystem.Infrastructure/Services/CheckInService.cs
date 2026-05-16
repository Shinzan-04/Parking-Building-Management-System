using Microsoft.EntityFrameworkCore;
using ParkingSystem.Application.DTOs.CheckIn;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

public class CheckInService : ICheckInService
{
    private readonly ApplicationDbContext _context;
    private readonly IQrCodeService _qrCodeService;

    public CheckInService(ApplicationDbContext context, IQrCodeService qrCodeService)
    {
        _context = context;
        _qrCodeService = qrCodeService;
    }

    /// <summary>
    /// NHÁNH 1: Check-in với Booking QR Code
    /// Bước 1: Quét mã QR → lấy BookingCode → tìm Reservation
    /// Bước 2: Đối chiếu biển số OCR với biển số trong Booking
    /// Bước 3: Nếu khớp → tạo Session, cập nhật trạng thái
    /// </summary>
    public async Task<object> CheckInWithBookingAsync(CheckInBookingRequest request)
    {
        // Tìm Reservation theo BookingCode
        var reservation = await _context.Reservations
            .Include(r => r.ParkingSlot)
                .ThenInclude(s => s.Floor)
            .Include(r => r.VehicleType)
            .FirstOrDefaultAsync(r => r.BookingCode == request.BookingCode
                                   && r.Status == ReservationStatus.Confirmed);

        if (reservation == null)
            throw new InvalidOperationException("Mã booking không hợp lệ hoặc chưa được xác nhận.");

        // Kiểm tra thời gian booking có hợp lệ không
        var now = DateTime.UtcNow;
        if (now < reservation.StartTime.AddMinutes(-30) || now > reservation.EndTime)
            throw new InvalidOperationException("Booking đã hết hạn hoặc chưa đến giờ check-in.");

        // Đối chiếu biển số OCR với biển số đăng ký trong Booking
        if (!string.Equals(request.LicensePlateOcr.Trim(), reservation.LicensePlate.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            // Biển số KHÔNG khớp → trả về cảnh báo, yêu cầu Staff xác nhận
            return new CheckInMismatchResponse
            {
                ReservationId = reservation.Id,
                BookingLicensePlate = reservation.LicensePlate,
                OcrLicensePlate = request.LicensePlateOcr,
                Message = "Biển số xe thực tế không khớp với biển số đăng ký. Cần nhân viên xác nhận.",
                RequiresStaffConfirmation = true
            };
        }

        // Biển số KHỚP → Tiến hành check-in
        return await ProcessBookingCheckIn(reservation, reservation.LicensePlate, request.StaffId);
    }

    /// <summary>
    /// Staff xác nhận override khi biển số lệch
    /// </summary>
    public async Task<CheckInResponse> StaffOverrideCheckInAsync(StaffOverrideRequest request)
    {
        var reservation = await _context.Reservations
            .Include(r => r.ParkingSlot)
                .ThenInclude(s => s.Floor)
            .Include(r => r.VehicleType)
            .FirstOrDefaultAsync(r => r.Id == request.ReservationId
                                   && r.Status == ReservationStatus.Confirmed);

        if (reservation == null)
            throw new InvalidOperationException("Reservation không tồn tại hoặc không hợp lệ.");

        // Staff cho phép → check-in với biển số thực tế
        return await ProcessBookingCheckIn(reservation, request.ActualLicensePlate, request.StaffId);
    }

    /// <summary>
    /// NHÁNH 2: Check-in trực tiếp (Walk-in)
    /// Bước 1: Nhận biển số từ OCR/Staff nhập tay
    /// Bước 2: Kiểm tra slot khả dụng theo loại xe
    /// Bước 3: Tạo Session + Sinh QR Code vé → In cho khách
    /// </summary>
    public async Task<CheckInResponse> CheckInWalkInAsync(CheckInWalkInRequest request)
    {
        // Kiểm tra loại xe có tồn tại không
        var vehicleType = await _context.VehicleTypes.FindAsync(request.VehicleTypeId);
        if (vehicleType == null)
            throw new InvalidOperationException("Loại phương tiện không hợp lệ.");

        // Kiểm tra xe đã đang gửi trong bãi chưa (trùng biển số + đang Active)
        var existingSession = await _context.ParkingSessions
            .AnyAsync(s => s.LicensePlate == request.LicensePlate && s.Status == SessionStatus.Active);
        if (existingSession)
            throw new InvalidOperationException($"Xe biển số {request.LicensePlate} đang có phiên gửi xe hoạt động.");

        // Tìm slot trống phù hợp với loại xe (ưu tiên tầng thấp nhất)
        var availableSlot = await _context.ParkingSlots
            .Include(s => s.Floor)
            .Where(s => s.VehicleTypeId == request.VehicleTypeId && s.Status == SlotStatus.Available)
            .OrderBy(s => s.Floor.FloorIndex)
            .ThenBy(s => s.SlotNumber)
            .FirstOrDefaultAsync();

        if (availableSlot == null)
            throw new InvalidOperationException($"Bãi xe đã hết chỗ cho loại xe {vehicleType.Name}.");

        // Sinh mã QR cho phiên gửi xe (Session Code)
        var sessionCode = _qrCodeService.GenerateUniqueCode(5);

        // Tạo Parking Session mới
        var session = new ParkingSession
        {
            Id = Guid.NewGuid(),
            DriverId = null, // Khách vãng lai không có tài khoản
            StaffId = request.StaffId,
            ParkingSlotId = availableSlot.Id,
            VehicleTypeId = request.VehicleTypeId,
            LicensePlate = request.LicensePlate,
            SessionCode = sessionCode,
            CheckInMethod = CheckInMethod.WalkIn,
            EntryTime = DateTime.UtcNow,
            Status = SessionStatus.Active
        };

        // Cập nhật trạng thái Slot → Occupied
        availableSlot.Status = SlotStatus.Occupied;
        availableSlot.UpdatedAt = DateTime.UtcNow;

        _context.ParkingSessions.Add(session);
        await _context.SaveChangesAsync();

        // Sinh ảnh QR Code Base64 (để in vé giấy)
        var qrImageBase64 = _qrCodeService.GenerateQrCodeBase64(sessionCode);

        return new CheckInResponse
        {
            SessionId = session.Id,
            SessionCode = sessionCode,
            SessionQrCodeBase64 = qrImageBase64,
            LicensePlate = request.LicensePlate,
            CheckInMethod = CheckInMethod.WalkIn,
            SlotNumber = availableSlot.SlotNumber,
            FloorName = availableSlot.Floor?.Name ?? "",
            VehicleTypeName = vehicleType.Name,
            EntryTime = session.EntryTime,
            Message = $"Check-in thành công. Vui lòng đỗ xe tại ô {availableSlot.SlotNumber}, tầng {availableSlot.Floor?.Name}."
        };
    }

    /// <summary>
    /// Xử lý check-in cho luồng Booking (dùng chung cho cả khớp biển số và staff override)
    /// </summary>
    private async Task<CheckInResponse> ProcessBookingCheckIn(Reservation reservation, string licensePlate, Guid? staffId)
    {
        var sessionCode = _qrCodeService.GenerateUniqueCode(5);

        // Tạo Parking Session liên kết với Reservation
        var session = new ParkingSession
        {
            Id = Guid.NewGuid(),
            DriverId = reservation.DriverId,
            StaffId = staffId,
            ParkingSlotId = reservation.ParkingSlotId,
            VehicleTypeId = reservation.VehicleTypeId,
            ReservationId = reservation.Id,
            LicensePlate = licensePlate,
            SessionCode = sessionCode,
            CheckInMethod = CheckInMethod.Booking,
            EntryTime = DateTime.UtcNow,
            Status = SessionStatus.Active
        };

        // Cập nhật trạng thái Reservation → CheckedIn
        reservation.Status = ReservationStatus.CheckedIn;

        // Cập nhật trạng thái Slot: Reserved → Occupied
        var slot = reservation.ParkingSlot;
        slot.Status = SlotStatus.Occupied;
        slot.UpdatedAt = DateTime.UtcNow;

        _context.ParkingSessions.Add(session);
        await _context.SaveChangesAsync();

        var qrImageBase64 = _qrCodeService.GenerateQrCodeBase64(sessionCode);

        return new CheckInResponse
        {
            SessionId = session.Id,
            SessionCode = sessionCode,
            SessionQrCodeBase64 = qrImageBase64,
            LicensePlate = licensePlate,
            CheckInMethod = CheckInMethod.Booking,
            SlotNumber = slot.SlotNumber,
            FloorName = slot.Floor?.Name ?? "",
            VehicleTypeName = reservation.VehicleType?.Name ?? "",
            EntryTime = session.EntryTime,
            Message = $"Check-in thành công (Đặt trước). Vui lòng đỗ xe tại ô {slot.SlotNumber}, tầng {slot.Floor?.Name}."
        };
    }
}
