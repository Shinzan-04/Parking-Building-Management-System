using Microsoft.EntityFrameworkCore;
using ParkingSystem.Application.DTOs.Reservation;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

public class ReservationService : IReservationService
{
    private readonly ApplicationDbContext _context;
    private readonly IQrCodeService _qrCodeService;

    public ReservationService(ApplicationDbContext context, IQrCodeService qrCodeService)
    {
        _context = context;
        _qrCodeService = qrCodeService;
    }

    public async Task<ReservationResponse> CreateReservationAsync(Guid driverId, CreateReservationRequest request)
    {
        // 1. Validate time
        if (request.StartTime <= DateTime.UtcNow)
            throw new InvalidOperationException("Thời gian bắt đầu phải lớn hơn thời điểm hiện tại.");

        if (request.EndTime <= request.StartTime)
            throw new InvalidOperationException("Thời gian kết thúc phải lớn hơn thời gian bắt đầu.");

        // 2. Kiểm tra xe đã có booking nào trùng giờ chưa
        var hasExistingBookingForPlate = await _context.Reservations
            .AnyAsync(r => r.LicensePlate == request.LicensePlate 
                        && r.Status != ReservationStatus.Cancelled 
                        && r.Status != ReservationStatus.Completed
                        && r.Status != ReservationStatus.Rejected
                        && r.StartTime < request.EndTime 
                        && r.EndTime > request.StartTime);
        if (hasExistingBookingForPlate)
            throw new InvalidOperationException($"Biển số {request.LicensePlate} đã có lịch đặt chỗ trong khoảng thời gian này.");

        // 3. Kiểm tra vị trí đỗ xe có trống trong khoảng thời gian này không (tránh 2 người book cùng lúc)
        var hasOverlappingReservation = await _context.Reservations
            .AnyAsync(r => r.ParkingSlotId == request.ParkingSlotId
                        && r.Status != ReservationStatus.Cancelled
                        && r.Status != ReservationStatus.Completed
                        && r.Status != ReservationStatus.Rejected
                        && r.StartTime < request.EndTime 
                        && r.EndTime > request.StartTime);

        if (hasOverlappingReservation)
            throw new InvalidOperationException("Vị trí này đã được đặt trong khoảng thời gian bạn chọn. Vui lòng chọn vị trí khác hoặc thời gian khác.");

        // 4. Tạo mã Booking Code (Sinh ra mã QR vé đặt trước)
        var bookingCode = _qrCodeService.GenerateUniqueCode(6);

        var reservation = new Domain.Entities.Reservation
        {
            Id = Guid.NewGuid(),
            DriverId = driverId,
            ParkingSlotId = request.ParkingSlotId,
            VehicleTypeId = request.VehicleTypeId,
            LicensePlate = request.LicensePlate,
            BookingCode = bookingCode,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            Status = ReservationStatus.Pending // Thay đổi từ Confirmed sang Pending để Staff duyệt
        };

        _context.Reservations.Add(reservation);
        await _context.SaveChangesAsync();

        var slot = await _context.ParkingSlots.FindAsync(request.ParkingSlotId);

        return new ReservationResponse
        {
            Id = reservation.Id,
            DriverId = reservation.DriverId,
            ParkingSlotId = reservation.ParkingSlotId,
            SlotNumber = slot?.SlotNumber ?? "",
            BookingCode = bookingCode,
            QrCodeBase64 = _qrCodeService.GenerateQrCodeBase64(bookingCode),
            LicensePlate = reservation.LicensePlate,
            StartTime = reservation.StartTime,
            EndTime = reservation.EndTime,
            Status = reservation.Status,
            CreatedAt = reservation.CreatedAt
        };
    }

    public async Task<IEnumerable<ReservationResponse>> GetMyReservationsAsync(Guid driverId)
    {
        var reservations = await _context.Reservations
            .Include(r => r.ParkingSlot)
            .Where(r => r.DriverId == driverId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return reservations.Select(r => new ReservationResponse
        {
            Id = r.Id,
            DriverId = r.DriverId,
            ParkingSlotId = r.ParkingSlotId,
            SlotNumber = r.ParkingSlot?.SlotNumber ?? "",
            BookingCode = r.BookingCode,
            QrCodeBase64 = _qrCodeService.GenerateQrCodeBase64(r.BookingCode),
            LicensePlate = r.LicensePlate,
            StartTime = r.StartTime,
            EndTime = r.EndTime,
            Status = r.Status,
            CreatedAt = r.CreatedAt
        });
    }

    public async Task<bool> CancelReservationAsync(Guid reservationId, Guid driverId)
    {
        var reservation = await _context.Reservations.FirstOrDefaultAsync(r => r.Id == reservationId && r.DriverId == driverId);
        if (reservation == null)
            throw new InvalidOperationException("Không tìm thấy thông tin đặt chỗ.");

        if (reservation.Status != ReservationStatus.Pending && reservation.Status != ReservationStatus.Confirmed)
            throw new InvalidOperationException("Chỉ có thể hủy khi trạng thái là Pending hoặc Confirmed.");

        reservation.Status = ReservationStatus.Cancelled;
        reservation.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    // --- For Staff ---
    
    public async Task<IEnumerable<ReservationResponse>> GetPendingReservationsAsync()
    {
        var reservations = await _context.Reservations
            .Include(r => r.ParkingSlot)
            .Where(r => r.Status == ReservationStatus.Pending)
            .OrderBy(r => r.StartTime) // Ưu tiên những booking có thời gian đỗ sớm nhất
            .ToListAsync();

        return reservations.Select(r => new ReservationResponse
        {
            Id = r.Id,
            DriverId = r.DriverId,
            ParkingSlotId = r.ParkingSlotId,
            SlotNumber = r.ParkingSlot?.SlotNumber ?? "",
            BookingCode = r.BookingCode,
            QrCodeBase64 = _qrCodeService.GenerateQrCodeBase64(r.BookingCode),
            LicensePlate = r.LicensePlate,
            StartTime = r.StartTime,
            EndTime = r.EndTime,
            Status = r.Status,
            CreatedAt = r.CreatedAt
        });
    }

    public async Task<bool> ReviewReservationAsync(Guid reservationId, Guid staffId, ReviewReservationRequest request)
    {
        var reservation = await _context.Reservations.FirstOrDefaultAsync(r => r.Id == reservationId);
        if (reservation == null)
            throw new InvalidOperationException("Không tìm thấy thông tin đặt chỗ.");

        if (reservation.Status != ReservationStatus.Pending)
            throw new InvalidOperationException("Chỉ có thể duyệt các yêu cầu đang ở trạng thái Pending.");

        reservation.Status = request.IsAccepted ? ReservationStatus.Confirmed : ReservationStatus.Rejected;
        reservation.UpdatedAt = DateTime.UtcNow;

        // Lưu lý do từ chối (có thể mở rộng entity Reservation thêm field RejectReason sau nếu cần, hiện tại lưu lại bằng log/notification)
        // Trong hệ thống hoàn chỉnh, ở đây sẽ trigger một NotificationService để gửi thông báo/email cho Driver.

        await _context.SaveChangesAsync();
        return true;
    }
}
