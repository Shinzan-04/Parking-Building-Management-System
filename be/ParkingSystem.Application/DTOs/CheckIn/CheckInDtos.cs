using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.DTOs.CheckIn;

/// <summary>
/// NHÁNH 1: Check-in bằng mã QR Booking (đã đặt trước)
/// </summary>
public class CheckInBookingRequest
{
    public string BookingCode { get; set; } = string.Empty;
    public string LicensePlateOcr { get; set; } = string.Empty;
    public Guid? StaffId { get; set; }
}

/// <summary>
/// NHÁNH 2: Check-in trực tiếp (khách vãng lai)
/// </summary>
public class CheckInWalkInRequest
{
    public string LicensePlate { get; set; } = string.Empty;
    public Guid VehicleTypeId { get; set; }
    public Guid? StaffId { get; set; }
}

/// <summary>
/// Response chung cho cả 2 nhánh check-in
/// </summary>
public class CheckInResponse
{
    public Guid SessionId { get; set; }
    public string SessionCode { get; set; } = string.Empty;
    public string SessionQrCodeBase64 { get; set; } = string.Empty;
    public string LicensePlate { get; set; } = string.Empty;
    public CheckInMethod CheckInMethod { get; set; }
    
    public string SlotNumber { get; set; } = string.Empty;
    public string FloorName { get; set; } = string.Empty;
    public string VehicleTypeName { get; set; } = string.Empty;
    
    public DateTime EntryTime { get; set; }
    public string Message { get; set; } = string.Empty;
}

/// <summary>
/// Response khi biển số OCR không khớp với booking (cần Staff xác nhận)
/// </summary>
public class CheckInMismatchResponse
{
    public Guid ReservationId { get; set; }
    public string BookingLicensePlate { get; set; } = string.Empty;
    public string OcrLicensePlate { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool RequiresStaffConfirmation { get; set; } = true;
}

/// <summary>
/// Staff xác nhận cho phép đổi xe (khi biển số lệch)
/// </summary>
public class StaffOverrideRequest
{
    public Guid ReservationId { get; set; }
    public string ActualLicensePlate { get; set; } = string.Empty;
    public Guid StaffId { get; set; }
}
