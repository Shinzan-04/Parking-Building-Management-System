using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.DTOs.CheckIn;

/// <summary>
/// [DEPRECATED] — Không còn sử dụng. Flow mới dùng SmartCheckInRequest thay thế.
/// API CŨ: Check-in bằng mã QR Booking (đã đặt trước)
/// </summary>
public class CheckInBookingRequest
{
    public string BookingCode { get; set; } = string.Empty;
    public string LicensePlateOcr { get; set; } = string.Empty;
    public Guid? StaffId { get; set; }
    
    /// <summary>
    /// Ảnh biển số chụp từ camera (Base64) — lưu làm bằng chứng
    /// </summary>
    public string? EntryImageBase64 { get; set; }
}

/// <summary>
/// [DEPRECATED] — Không còn sử dụng. Flow mới dùng SmartCheckInRequest thay thế.
/// API CŨ: Check-in bằng QR Driver cố định (quét QR trên app → JWT → DriverId)
/// Hệ thống tự tra Reservation Confirmed khớp với biển số OCR
/// </summary>
public class CheckInDriverQrRequest
{
    /// <summary>
    /// Chuỗi JWT từ QR Driver (payload chứa sub=DriverId, driverCode, type=driver)
    /// </summary>
    public string DriverQrToken { get; set; } = string.Empty;

    /// <summary>
    /// Biển số xe đọc từ Camera OCR
    /// </summary>
    public string LicensePlateOcr { get; set; } = string.Empty;

    public Guid? StaffId { get; set; }

    /// <summary>
    /// Ảnh biển số chụp từ camera (Base64) — lưu làm bằng chứng
    /// </summary>
    public string? EntryImageBase64 { get; set; }
}

/// <summary>
/// [DEPRECATED] — Đã được gộp vào SmartCheckInRequest.
/// SmartCheckIn tự động rẽ nhánh Walk-in nếu không tìm thấy Booking.
/// API CŨ: Check-in trực tiếp (khách vãng lai)
/// </summary>
public class CheckInWalkInRequest
{
    public string LicensePlate { get; set; } = string.Empty;
    public Guid VehicleTypeId { get; set; }
    public Guid? StaffId { get; set; }
    
    /// <summary>
    /// Tùy chọn: Staff tự chọn slot. Nếu null → AI tự động gán slot tốt nhất.
    /// </summary>
    public Guid? SlotId { get; set; }
    
    /// <summary>
    /// Tùy chọn: Chỉ định tòa nhà khi AI gán slot (giới hạn phạm vi tìm kiếm)
    /// </summary>
    public Guid? BuildingId { get; set; }
    
    /// <summary>
    /// Ảnh biển số chụp từ camera (Base64) — lưu làm bằng chứng
    /// </summary>
    public string? EntryImageBase64 { get; set; }
}

/// <summary>
/// SMART CHECK-IN: API duy nhất cho cổng vào
/// Camera quét biển số → Backend tự phân loại Booking hay Walk-in
/// </summary>
public class SmartCheckInRequest
{
    /// <summary>Biển số xe đọc từ Camera OCR</summary>
    public string LicensePlate { get; set; } = string.Empty;
    
    /// <summary>Loại phương tiện (cần thiết cho Walk-in để AI gán slot)</summary>
    public Guid VehicleTypeId { get; set; }
    
    /// <summary>StaffId — tự lấy từ JWT nếu không truyền</summary>
    public Guid? StaffId { get; set; }
    
    /// <summary>Tuỳ chọn: Staff tự chọn slot thủ công. Nếu null, AI sẽ tự động gán slot tốt nhất.</summary>
    public Guid? SlotId { get; set; }
    
    /// <summary>Ảnh biển số (Base64) — lưu làm bằng chứng</summary>
    public string? EntryImageBase64 { get; set; }
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
    public string BuildingName { get; set; } = string.Empty;
    public string VehicleTypeName { get; set; } = string.Empty;
    
    /// <summary>
    /// Mã booking nếu xe có đặt trước (null nếu walk-in)
    /// </summary>
    public string? BookingCode { get; set; }
    
    /// <summary>
    /// true nếu slot được AI tự động gán, false nếu Staff chọn tay
    /// </summary>
    public bool IsAIAssigned { get; set; }
    
    /// <summary>
    /// Điểm đánh giá vị trí (chỉ có khi AI gán)
    /// </summary>
    public double? SlotScore { get; set; }
    
    /// <summary>
    /// Lý do gợi ý vị trí này
    /// </summary>
    public string? SlotReason { get; set; }
    
    /// <summary>
    /// Đường dẫn ảnh biển số lúc check-in
    /// </summary>
    public string? EntryImageUrl { get; set; }
    
    public DateTime EntryTime { get; set; }
    public string Message { get; set; } = string.Empty;
}

/// <summary>
/// [DEPRECATED] — Không còn kịch bản sử dụng vì flow mới không còn đối chiếu QR vs OCR.
/// API CŨ: Response khi biển số OCR không khớp với booking (cần Staff xác nhận)
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
/// [DEPRECATED] — Gần như không còn kịch bản sử dụng.
/// Giữ lại phòng trường hợp mở rộng sau.
/// API CŨ: Staff xác nhận cho phép đổi xe (khi biển số lệch)
/// </summary>
public class StaffOverrideRequest
{
    public Guid ReservationId { get; set; }
    public string ActualLicensePlate { get; set; } = string.Empty;
    public Guid StaffId { get; set; }
    
    /// <summary>
    /// Ảnh biển số chụp từ camera (Base64) — lưu làm bằng chứng
    /// </summary>
    public string? EntryImageBase64 { get; set; }
}
