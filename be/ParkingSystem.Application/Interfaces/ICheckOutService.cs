using ParkingSystem.Application.DTOs.CheckOut;

namespace ParkingSystem.Application.Interfaces;

/// <summary>
/// Service xu ly luong xe ra bai (check-out) va thanh toan.
/// </summary>
public interface ICheckOutService
{
    /// <summary>
    /// Tim kiem phien gui xe dang hoat dong theo QR Code va doi chieu bien so.
    /// Su dung exact match 100% tren bien so da chuan hoa.
    /// </summary>
    Task<CheckOutSearchResult> SearchByQrCodeAndPlateAsync(string qrCode, string licensePlate, Guid? staffId = null, Guid? requestBuildingId = null);

    /// <summary>
    /// Xac nhan thanh toan va giai phong o do khi xe ra bai.
    /// Tao Payment (Status = Success), cap nhat Session, giai phong Slot.
    /// </summary>
    Task<CheckOutConfirmResponse> ConfirmCheckOutAsync(CheckOutConfirmRequest request);

    /// <summary>
    /// Xu ly luong Check-out bang OCR: nhan dien bien so tu anh Base64,
    /// tim phien gui xe, so sanh bien so vao/ra, tinh phi uoc tinh.
    /// </summary>
    Task<OcrCheckOutResult> ProcessOcrCheckOutAsync(OcrCheckOutRequest request);

    /// <summary>
    /// Tinh phi gui xe theo Session ID.
    /// Su dung de tao payment PayOS — tra ve thong tin phien + phi.
    /// </summary>
    Task<CheckOutSearchResult> CalculateFeeBySessionIdAsync(Guid sessionId);
}
