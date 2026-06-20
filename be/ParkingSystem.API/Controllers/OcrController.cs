using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.Interfaces.Lpr;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OcrController : ControllerBase
{
    private readonly ILicensePlateRecognizer _lprService;

    public OcrController(ILicensePlateRecognizer lprService)
    {
        _lprService = lprService;
    }

    /// <summary>
    /// Scan biển số xe từ ảnh camera (Base64)
    /// </summary>
    [HttpPost("scan-plate")]
    [Authorize(Roles = "Staff,Manager,Admin")]
    public async Task<IActionResult> ScanPlate([FromBody] ScanPlateRequest request)
    {
        if (string.IsNullOrEmpty(request.ImageBase64))
            return BadRequest(new { message = "Ảnh không được để trống." });

        var result = await _lprService.RecognizeFrameAsync(request.ImageBase64);
        return Ok(result);
    }

    /// <summary>
    /// [DEPRECATED] — Không còn sử dụng trong flow mới.
    /// Flow mới: Camera scan biển số (scan-plate) → điền vào input → Staff bấm CHECK-IN
    /// → gọi POST /api/CheckIn/smart (SmartCheckIn) thay vì gọi API này.
    /// 
    /// API CŨ: Scan biển số + Tự động check-in Walk-in luôn (flow liền mạch)
    /// </summary>
    [HttpPost("scan-and-checkin")]
    [Authorize(Roles = "Staff,Manager,Admin")]
    public async Task<IActionResult> ScanAndCheckIn([FromBody] ScanAndCheckInRequest request)
    {
        if (string.IsNullOrEmpty(request.ImageBase64))
            return BadRequest(new { message = "Ảnh không được để trống." });

        // Bước 1: Scan biển số
        var ocrResult = await _lprService.RecognizeFrameAsync(request.ImageBase64);

        if (!ocrResult.IsDetected)
            return BadRequest(new { message = "Không phát hiện được biển số xe.", ocrResult });

        // Trả về kết quả scan (Staff xác nhận biển số rồi mới check-in)
        return Ok(new
        {
            ocrResult.LicensePlate,
            ocrResult.Confidence,
            ocrResult.NeedManualReview,
            ocrResult.CroppedPlateBase64,
            ocrResult.Message,
            vehicleTypeId = request.VehicleTypeId,
            hint = "Xác nhận biển số rồi gọi POST /api/checkin/walk-in để check-in."
        });
    }
}

public class ScanPlateRequest
{
    public string ImageBase64 { get; set; } = string.Empty;
}

public class ScanAndCheckInRequest
{
    public string ImageBase64 { get; set; } = string.Empty;
    public Guid VehicleTypeId { get; set; }
}
