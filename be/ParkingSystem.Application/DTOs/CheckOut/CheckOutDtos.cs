using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.DTOs.CheckOut;

/// <summary>
/// Ket qua tim kiem xe dang gui trong bai theo bien so.
/// </summary>
public class CheckOutSearchResult
{
    public Guid SessionId { get; set; }
    public string LicensePlate { get; set; } = string.Empty;
    public string SlotNumber { get; set; } = string.Empty;
    public string FloorName { get; set; } = string.Empty;
    public DateTime EntryTime { get; set; }
    public DateTime EstimatedExitTime { get; set; }
    public double TotalHours { get; set; }
    public string VehicleTypeName { get; set; } = string.Empty;

    /// <summary>
    /// Don gia theo gio (VND), chi khi PricingModel = "Hourly".
    /// </summary>
    public decimal HourlyRate { get; set; }

    /// <summary>
    /// Phi uoc tinh = TotalHours * HourlyRate (khong lam tron), chi khi PricingModel = "Hourly".
    /// </summary>
    public decimal EstimatedFee { get; set; }

    /// <summary>
    /// Model pricing: "DayNight" = gia ngay/dem, "Hourly" = gia theo gio (cu).
    /// </summary>
    public string PricingModel { get; set; } = "Hourly";

    /// <summary>
    /// Gia gui ngay (6h-18h), chi khi PricingModel = "DayNight".
    /// </summary>
    public decimal? DayPassPrice { get; set; }

    /// <summary>
    /// Gia gui dem (18h-6h), chi khi PricingModel = "DayNight".
    /// </summary>
    public decimal? NightPassPrice { get; set; }

    /// <summary>
    /// Gia toi da 1 ngay (24h), chi khi PricingModel = "DayNight".
    /// </summary>
    public decimal? DailyMaxPrice { get; set; }

    /// <summary>
    /// Chi tiet tinh tien (ngay/dem), chi khi PricingModel = "DayNight".
    /// </summary>
    public FeeBreakdownDto? FeeBreakdown { get; set; }

    public string Message { get; set; } = string.Empty;
}

/// <summary>
/// Yeu cau xac nhan thanh toan khi xe ra bai.
/// </summary>
public class CheckOutConfirmRequest
{
    /// <summary>
    /// ID cua phiên gui xe can thanh toán.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// ID nhan vien thuc hien check-out.
    /// </summary>
    public Guid StaffId { get; set; }
    
    public Guid? BuildingId { get; set; }

    /// <summary>
    /// Phuong thuc thanh toan, mac dinh la Cash neu khong truyen.
    /// </summary>
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;

    /// <summary>
    /// So tien khach dua (dung khi thanh toan tien mat).
    /// </summary>
    public decimal? PaymentAmount { get; set; }

    /// <summary>
    /// Bien so OCR nhan dien luc checkout (luu audit trail).
    /// </summary>
    public string? ExitLicensePlateOcr { get; set; }

    /// <summary>
    /// Staff xac nhan cho phep checkout (bat buoc = true de hoan tat).
    /// </summary>
    public bool StaffConfirmed { get; set; } = true;
}

/// <summary>
/// Ket qua sau khi xac nhan thanh toan thanh cong.
/// </summary>
public class CheckOutConfirmResponse
{
    public Guid SessionId { get; set; }
    public string LicensePlate { get; set; } = string.Empty;
    public string SlotNumber { get; set; } = string.Empty;
    public string FloorName { get; set; } = string.Empty;
    public DateTime EntryTime { get; set; }
    public DateTime ExitTime { get; set; }
    public double TotalHours { get; set; }

    /// <summary>
    /// Don gia theo gio (VND), chi khi PricingModel = "Hourly".
    /// </summary>
    public decimal HourlyRate { get; set; }

    /// <summary>
    /// Tong phi = TotalHours * HourlyRate (khong lam tron), chi khi PricingModel = "Hourly".
    /// </summary>
    public decimal TotalFee { get; set; }

    /// <summary>
    /// Model pricing: "DayNight" = gia ngay/dem, "Hourly" = gia theo gio (cu).
    /// </summary>
    public string PricingModel { get; set; } = "Hourly";

    /// <summary>
    /// Gia gui ngay, chi khi PricingModel = "DayNight".
    /// </summary>
    public decimal? DayPassPrice { get; set; }

    /// <summary>
    /// Gia gui dem, chi khi PricingModel = "DayNight".
    /// </summary>
    public decimal? NightPassPrice { get; set; }

    /// <summary>
    /// Gia toi da 1 ngay, chi khi PricingModel = "DayNight".
    /// </summary>
    public decimal? DailyMaxPrice { get; set; }

    /// <summary>
    /// Chi tiet tinh tien, chi khi PricingModel = "DayNight".
    /// </summary>
    public FeeBreakdownDto? FeeBreakdown { get; set; }

    public decimal? PaymentAmount { get; set; }
    public decimal? ChangeAmount { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public Guid PaymentId { get; set; }
    public string Message { get; set; } = string.Empty;
}

/// <summary>
/// Yeu cau scan bien so xe luc ra bai (OCR).
/// </summary>
public class OcrCheckOutRequest
{
    /// <summary>
    /// Anh chup bien so xe tu camera, dinh dang Base64.
    /// </summary>
    public string ImageBase64 { get; set; } = string.Empty;
    public Guid StaffId { get; set; }
    public Guid? BuildingId { get; set; }
}

/// <summary>
/// Ket qua sau khi scan OCR bien so xe luc ra bai.
/// Tra ve ca bien so luc vao (DB) va bien so luc ra (OCR),
/// trang thai khop/khong khop, thong tin phien gui va phi uoc tinh.
/// </summary>
public class OcrCheckOutResult
{
    public Guid SessionId { get; set; }
    public string EntryLicensePlate { get; set; } = string.Empty;
    public string ExitLicensePlate { get; set; } = string.Empty;
    public bool IsMatch { get; set; }
    public string MatchStatus { get; set; } = string.Empty;
    public string SlotNumber { get; set; } = string.Empty;
    public string FloorName { get; set; } = string.Empty;
    public DateTime EntryTime { get; set; }
    public DateTime EstimatedExitTime { get; set; }
    public double TotalHours { get; set; }
    public string VehicleTypeName { get; set; } = string.Empty;

    /// <summary>
    /// Don gia theo gio (VND), chi khi PricingModel = "Hourly".
    /// </summary>
    public decimal HourlyRate { get; set; }

    /// <summary>
    /// Phi uoc tinh = TotalHours * HourlyRate (khong lam tron), chi khi PricingModel = "Hourly".
    /// </summary>
    public decimal EstimatedFee { get; set; }

    /// <summary>
    /// Model pricing: "DayNight" = gia ngay/dem, "Hourly" = gia theo gio (cu).
    /// </summary>
    public string PricingModel { get; set; } = "Hourly";

    /// <summary>
    /// Gia gui ngay, chi khi PricingModel = "DayNight".
    /// </summary>
    public decimal? DayPassPrice { get; set; }

    /// <summary>
    /// Gia gui dem, chi khi PricingModel = "DayNight".
    /// </summary>
    public decimal? NightPassPrice { get; set; }

    /// <summary>
    /// Gia toi da 1 ngay, chi khi PricingModel = "DayNight".
    /// </summary>
    public decimal? DailyMaxPrice { get; set; }

    /// <summary>
    /// Chi tiet tinh tien, chi khi PricingModel = "DayNight".
    /// </summary>
    public FeeBreakdownDto? FeeBreakdown { get; set; }

    public float OcrConfidence { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class FeeBreakdownDto
{
    /// <summary>
    /// So lan gui ngay (6h-18h).
    /// </summary>
    public int DayPassCount { get; set; }

    /// <summary>
    /// So lan gui dem (18h-6h).
    /// </summary>
    public int NightPassCount { get; set; }

    /// <summary>
    /// Tong tien ngay.
    /// </summary>
    public decimal DayPassTotal { get; set; }

    /// <summary>
    /// Tong tien dem.
    /// </summary>
    public decimal NightPassTotal { get; set; }

    /// <summary>
    /// Tong phi = DayPassTotal + NightPassTotal.
    /// </summary>
    public decimal TotalFee { get; set; }
}

/// <summary>
/// Yeu cau tao thanh toan PayOS khi xe ra.
/// </summary>
public class CreateCheckoutPaymentRequest
{
    /// <summary>
    /// Session ID cua phien gui xe.
    /// </summary>
    public Guid SessionId { get; set; }
}

/// <summary>
/// Ket qua tao thanh toan PayOS khi xe ra.
/// </summary>
public class CreateCheckoutPaymentResponse
{
    public Guid SessionId { get; set; }
    public string LicensePlate { get; set; } = string.Empty;
    public string SlotNumber { get; set; } = string.Empty;
    public string FloorName { get; set; } = string.Empty;
    public DateTime EntryTime { get; set; }
    public DateTime ExitTime { get; set; }
    public double TotalHours { get; set; }
    public string VehicleTypeName { get; set; } = string.Empty;
    public string PricingModel { get; set; } = "Hourly";
    public decimal TotalFee { get; set; }
    public decimal HourlyRate { get; set; }
    public decimal? DayPassPrice { get; set; }
    public decimal? NightPassPrice { get; set; }
    public decimal? DailyMaxPrice { get; set; }
    public FeeBreakdownDto? FeeBreakdown { get; set; }
    public long PayOSOrderCode { get; set; }
    public string CheckoutUrl { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
