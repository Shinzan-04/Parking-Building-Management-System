using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.DTOs.Reservation;

// ===== TẠO RESERVATION (HỖ TRỢ 2 CHẾ ĐỘ) =====
public class CreateReservationRequest
{
    /// <summary>
    /// Chế độ đặt chỗ: Manual (tự chọn) hoặc AIRecommended (AI chọn)
    /// </summary>
    public BookingMethod BookingMethod { get; set; } = BookingMethod.Manual;

    /// <summary>
    /// ID xe của Driver (từ bảng Vehicles). Hệ thống tự tra PlateNumber + VehicleTypeId
    /// </summary>
    public Guid VehicleId { get; set; }

    /// <summary>
    /// [Manual] Bắt buộc — ID ô đỗ xe mà Driver tự chọn
    /// [AI] Không bắt buộc — nếu có, dùng slot AI đã gợi ý; nếu không, hệ thống tự chọn
    /// </summary>
    public Guid? ParkingSlotId { get; set; }

    /// <summary>
    /// [AI] Tòa nhà mong muốn (để AI lọc slot trong phạm vi tòa nhà)
    /// </summary>
    public Guid? BuildingId { get; set; }

    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }

    /// <summary>
    /// Phương thức thanh toán: Wallet (0) hoặc PayOS (4). Mặc định Wallet.
    /// </summary>
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Wallet;
}

// ===== RESPONSE =====
public class ReservationResponse
{
    public Guid Id { get; set; }
    public Guid DriverId { get; set; }
    public Guid ParkingSlotId { get; set; }
    public string SlotNumber { get; set; } = string.Empty;
    public string FloorName { get; set; } = string.Empty;
    public string BuildingName { get; set; } = string.Empty;
    public string BookingCode { get; set; } = string.Empty;
    public string QrCodeBase64 { get; set; } = string.Empty;
    public string LicensePlate { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public ReservationStatus Status { get; set; }
    public BookingMethod BookingMethod { get; set; }
    public double? AIScore { get; set; }
    public string? AIReason { get; set; }
    public string? RejectReason { get; set; }
    public DateTime CreatedAt { get; set; }

    // ===== THÔNG TIN THANH TOÁN PAYOS =====
    /// <summary>Link QR PayOS để thanh toán tiền đặt chỗ. Null nếu miễn phí.</summary>
    public string? PayOSCheckoutUrl { get; set; }
    /// <summary>Phí đặt chỗ cần thanh toán (VND)</summary>
    public decimal? BookingFee { get; set; }
    /// <summary>Mã đơn hàng PayOS để tra cứu trạng thái</summary>
    public long? PayOSOrderCode { get; set; }
}

// ===== STAFF DUYỆT =====
public class ReviewReservationRequest
{
    public bool IsAccepted { get; set; }
    public string? Reason { get; set; }
}
