using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.CheckOut;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

/// <summary>
/// Controller xu ly luong xe ra bai (check-out) va thanh toan.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Staff,Manager,Admin")]
public class CheckOutController : ControllerBase
{
    private readonly ICheckOutService _checkOutService;

    public CheckOutController(ICheckOutService checkOutService)
    {
        _checkOutService = checkOutService;
    }

    /// <summary>
    /// Tim kiem xe dang gui trong bai theo bien so da chuan hoa.
    /// Chuan hoa: viet hoa, xoa dau cham, gach ngang, khoang trang.
    /// </summary>
    /// <param name="licensePlate">Bien so xe can tim (khong can chuan hoa truoc)</param>
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string licensePlate)
    {
        if (string.IsNullOrWhiteSpace(licensePlate))
        {
            return BadRequest(new { message = "Bien so xe khong duoc de trong." });
        }

        try
        {
            var result = await _checkOutService.SearchByLicensePlateAsync(licensePlate);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new
            {
                message = ex.Message,
                normalizedLicensePlate = NormalizeLicensePlate(licensePlate)
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Loi he thong: {ex.Message}" });
        }
    }

    /// <summary>
    /// Xac nhan thanh toan va cho xe ra bai.
    /// Tao ban ghi Payment, cap nhat ParkingSession, giai phong ParkingSlot.
    /// </summary>
    [HttpPost("confirm")]
    public async Task<IActionResult> Confirm([FromBody] CheckOutConfirmRequest request)
    {
        if (request.SessionId == Guid.Empty)
        {
            return BadRequest(new { message = "SessionId khong hop le." });
        }

        if (request.StaffId == Guid.Empty)
        {
            return BadRequest(new { message = "StaffId khong hop le." });
        }

        try
        {
            var result = await _checkOutService.ConfirmCheckOutAsync(request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Loi he thong: {ex.Message}" });
        }
    }

    /// <summary>
    /// Xu ly check-out bang OCR: Staff chup anh bien so xe luc ra,
    /// he thong tu dong nhan dien bien so, tim phien gui, so sanh va tinh phi.
    /// Tra ve ca bien so vao/ra, trang thai khop/khong khop.
    /// Staff xem ket qua roi goi POST /confirm de xac nhan checkout.
    /// </summary>
    /// <param name="request">Anh Base64 chua bien so xe can nhan dien</param>
    [HttpPost("ocr-checkout")]
    public async Task<IActionResult> OcrCheckOut([FromBody] OcrCheckOutRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ImageBase64))
        {
            return BadRequest(new { message = "Anh khong duoc de trong." });
        }

        try
        {
            var result = await _checkOutService.ProcessOcrCheckOutAsync(request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Loi he thong: {ex.Message}" });
        }
    }

    /// <summary>
    /// Chuan hoa bien so xe: viet hoa, xoa dau cham, gach ngang, khoang trang.
    /// </summary>
    private static string NormalizeLicensePlate(string licensePlate)
    {
        if (string.IsNullOrWhiteSpace(licensePlate))
        {
            return string.Empty;
        }

        return licensePlate
            .Trim()
            .ToUpperInvariant()
            .Replace(".", "")
            .Replace("-", "")
            .Replace(" ", "");
    }
}
