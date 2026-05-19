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
    private readonly ISlotAssignmentService _slotAssignmentService;

    public CheckInService(ApplicationDbContext context, IQrCodeService qrCodeService, ISlotAssignmentService slotAssignmentService)
    {
        _context = context;
        _qrCodeService = qrCodeService;
        _slotAssignmentService = slotAssignmentService;
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
    /// - Nếu request.SlotId != null → Staff chọn thủ công
    /// - Nếu request.SlotId == null → AI tự động chọn slot tốt nhất
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

        ParkingSlot? assignedSlot;
        bool isAIAssigned;
        double? slotScore = null;
        string? slotReason = null;

        if (request.SlotId.HasValue)
        {
            // ===== STAFF CHỌN THỦ CÔNG =====
            assignedSlot = await _context.ParkingSlots
                .Include(s => s.Floor)
                .FirstOrDefaultAsync(s => s.Id == request.SlotId.Value
                                       && s.VehicleTypeId == request.VehicleTypeId
                                       && s.Status == SlotStatus.Available);

            if (assignedSlot == null)
                throw new InvalidOperationException("Ô đỗ xe không khả dụng hoặc không phù hợp với loại xe.");

            isAIAssigned = false;
        }
        else
        {
            // ===== AI TỰ ĐỘNG GÁN SLOT =====
            var bestSlot = await _slotAssignmentService.GetBestSlotAsync(request.VehicleTypeId);

            if (bestSlot == null)
                throw new InvalidOperationException($"Bãi xe đã hết chỗ cho loại xe {vehicleType.Name}.");

            assignedSlot = await _context.ParkingSlots
                .Include(s => s.Floor)
                .FirstOrDefaultAsync(s => s.Id == bestSlot.SlotId);

            if (assignedSlot == null)
                throw new InvalidOperationException("Lỗi hệ thống: Không tìm thấy slot được gợi ý.");

            isAIAssigned = true;
            slotScore = bestSlot.Score;
            slotReason = bestSlot.Reason;
        }

        // Sinh mã QR cho phiên gửi xe (Session Code)
        var sessionCode = _qrCodeService.GenerateUniqueCode(5);

        // Tạo Parking Session mới
        var session = new ParkingSession
        {
            Id = Guid.NewGuid(),
            DriverId = null, // Khách vãng lai không có tài khoản
            StaffId = request.StaffId,
            ParkingSlotId = assignedSlot.Id,
            VehicleTypeId = request.VehicleTypeId,
            LicensePlate = request.LicensePlate,
            SessionCode = sessionCode,
            CheckInMethod = CheckInMethod.WalkIn,
            EntryTime = DateTime.UtcNow,
            Status = SessionStatus.Active
        };

        // Cập nhật trạng thái Slot → Occupied
        assignedSlot.Status = SlotStatus.Occupied;
        assignedSlot.UpdatedAt = DateTime.UtcNow;

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
            SlotNumber = assignedSlot.SlotNumber,
            FloorName = assignedSlot.Floor?.Name ?? "",
            VehicleTypeName = vehicleType.Name,
            IsAIAssigned = isAIAssigned,
            SlotScore = slotScore,
            SlotReason = slotReason,
            EntryTime = session.EntryTime,
            Message = isAIAssigned
                ? $"Check-in thành công (AI gợi ý). Vui lòng đỗ xe tại ô {assignedSlot.SlotNumber}, tầng {assignedSlot.Floor?.Name}."
                : $"Check-in thành công (Staff chọn). Vui lòng đỗ xe tại ô {assignedSlot.SlotNumber}, tầng {assignedSlot.Floor?.Name}."
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
