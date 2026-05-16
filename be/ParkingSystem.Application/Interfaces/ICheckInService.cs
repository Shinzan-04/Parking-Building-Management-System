using ParkingSystem.Application.DTOs.CheckIn;

namespace ParkingSystem.Application.Interfaces;

public interface ICheckInService
{
    /// <summary>
    /// NHÁNH 1: Check-in với mã QR Booking (đã đặt trước)
    /// </summary>
    Task<object> CheckInWithBookingAsync(CheckInBookingRequest request);

    /// <summary>
    /// NHÁNH 2: Check-in trực tiếp (khách vãng lai)
    /// </summary>
    Task<CheckInResponse> CheckInWalkInAsync(CheckInWalkInRequest request);

    /// <summary>
    /// Staff xác nhận override khi biển số OCR không khớp booking
    /// </summary>
    Task<CheckInResponse> StaffOverrideCheckInAsync(StaffOverrideRequest request);
}
