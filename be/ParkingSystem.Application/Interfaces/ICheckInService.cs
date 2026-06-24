using ParkingSystem.Application.DTOs.CheckIn;

namespace ParkingSystem.Application.Interfaces;

public interface ICheckInService
{
    /// <summary>
    /// [DEPRECATED] — Flow mới dùng SmartCheckInAsync thay thế.
    /// API CŨ: Check-in với mã QR Booking (đã đặt trước)
    /// </summary>
    Task<object> CheckInWithBookingAsync(CheckInBookingRequest request);

    /// <summary>
    /// [DEPRECATED] — Flow mới dùng SmartCheckInAsync thay thế.
    /// API CŨ: Check-in với QR Driver cố định (quét QR app → JWT → DriverId → Reservation)
    /// </summary>
    Task<object> CheckInWithDriverQrAsync(CheckInDriverQrRequest request);

    /// <summary>
    /// [DEPRECATED] — Logic đã được gộp vào SmartCheckInAsync.
    /// API CŨ: Check-in trực tiếp (khách vãng lai)
    /// </summary>
    Task<CheckInResponse> CheckInWalkInAsync(CheckInWalkInRequest request);

    /// <summary>
    /// [DEPRECATED] — Gần như không còn kịch bản sử dụng. Giữ lại phòng mở rộng.
    /// API CŨ: Staff xác nhận override khi biển số OCR không khớp booking
    /// </summary>
    Task<CheckInResponse> StaffOverrideCheckInAsync(StaffOverrideRequest request);

    /// <summary>
    /// SMART CHECK-IN: API duy nhất cho cổng vào
    /// Quét biển số → Tự động tìm Booking → Nếu có thì check-in Booking, không thì Walk-in
    /// </summary>
    Task<CheckInResponse> SmartCheckInAsync(SmartCheckInRequest request);
}
