using System.Text.RegularExpressions;
using ParkingSystem.Application.Interfaces.Lpr;

namespace ParkingSystem.Infrastructure.Services.Lpr;

public class PlatePostProcessor : IPlatePostProcessor
{
    public string CleanAndFormatPlate(string rawText)
    {
        // 1. Loại bỏ các ký tự không phải chữ và số
        string cleaned = Regex.Replace(rawText, @"[^a-zA-Z0-9]", "").ToUpper();

        // 2. Sửa một số lỗi OCR phổ biến (tuỳ chọn theo format biển số VN)
        // Ví dụ: chữ O thành số 0 ở phần số, số 8 thành chữ B ở phần chữ...
        // Tạm thời chỉ return cleaned.
        return cleaned;
    }
}
