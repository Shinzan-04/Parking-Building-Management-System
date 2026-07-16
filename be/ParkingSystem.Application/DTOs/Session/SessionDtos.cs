using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.DTOs.Session;

/// <summary>
/// DTO hiển thị thông tin phiên gửi xe (dùng cho danh sách + chi tiết)
/// </summary>
public class SessionDto
{
    public Guid Id { get; set; }
    public string SessionCode { get; set; } = string.Empty;
    public string LicensePlate { get; set; } = string.Empty;
    public CheckInMethod CheckInMethod { get; set; }
    public SessionStatus Status { get; set; }
    public IssueType IssueType { get; set; }
    
    // Thông tin vị trí
    public string SlotNumber { get; set; } = string.Empty;
    public string FloorName { get; set; } = string.Empty;
    public string BuildingName { get; set; } = string.Empty;
    public string VehicleTypeName { get; set; } = string.Empty;
    
    // Thông tin người
    public string? DriverName { get; set; }
    public string? StaffName { get; set; }
    
    // Thông tin thời gian & phí
    public DateTime EntryTime { get; set; }
    public DateTime? ExitTime { get; set; }
    public decimal EstimatedFee { get; set; }
    public decimal PenaltyFee { get; set; }
    public decimal TotalFee { get; set; }
    public decimal PrePaidAmount { get; set; }
    public DateTime? GracePeriodEndTime { get; set; }
    
    /// <summary>
    /// Thời gian gửi xe tính đến hiện tại (dạng text: "2 giờ 15 phút")
    /// </summary>
    public string Duration { get; set; } = string.Empty;
    
    /// <summary>
    /// Đường dẫn ảnh biển số lúc check-in
    /// </summary>
    public string? EntryImageUrl { get; set; }
}

/// <summary>
/// Bộ lọc tìm kiếm session
/// </summary>
public class SessionFilterRequest
{
    /// <summary>
    /// Tìm theo biển số (hỗ trợ tìm gần đúng)
    /// </summary>
    public string? LicensePlate { get; set; }
    
    /// <summary>
    /// Lọc theo trạng thái (Active, Completed, Overdue)
    /// </summary>
    public SessionStatus? Status { get; set; }
    
    /// <summary>
    /// Lọc theo tòa nhà
    /// </summary>
    public Guid? BuildingId { get; set; }
    
    /// <summary>
    /// Nội bộ: Lọc theo tòa nhà được phân công của Staff
    /// </summary>
    public Guid? StaffId { get; set; }

    /// <summary>
    /// Lọc theo tầng
    /// </summary>
    public Guid? FloorId { get; set; }
    
    /// <summary>
    /// Lọc từ ngày
    /// </summary>
    public DateTime? FromDate { get; set; }
    
    /// <summary>
    /// Lọc đến ngày
    /// </summary>
    public DateTime? ToDate { get; set; }
    
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

/// <summary>
/// Response phân trang danh sách session
/// </summary>
public class SessionListResponse
{
    public List<SessionDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    
    /// <summary>
    /// Thống kê nhanh
    /// </summary>
    public SessionSummary Summary { get; set; } = new();
}

/// <summary>
/// Thống kê tổng quan các session đang hoạt động
/// </summary>
public class SessionSummary
{
    public int TotalActive { get; set; }
    public int TotalOverdue { get; set; }
    public int TotalCompletedToday { get; set; }
    public decimal TotalRevenueToday { get; set; }
}

/// <summary>
/// Dữ liệu yêu cầu cấp lại vé (Ngoại lệ mất vé)
/// </summary>
public class ReissueTicketRequest
{
    public decimal PenaltyFee { get; set; }
    public string Reason { get; set; } = string.Empty;
}
