using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.Infrastructure.Services;

/// <summary>
/// Service upload ảnh lên Cloudinary.
/// 
/// Cloudinary là dịch vụ lưu trữ ảnh trên cloud:
/// - Ảnh được lưu trên CDN (Content Delivery Network) → truy cập nhanh từ mọi nơi
/// - Tự động tối ưu định dạng (f_auto) và chất lượng (q_auto)
/// - Không lo mất ảnh khi deploy lại server
/// 
/// Dùng cho: Lưu ảnh biển số khi check-in (bằng chứng tranh chấp)
/// </summary>
public class CloudinaryImageService : IImageUploadService
{
    private readonly Cloudinary _cloudinary;
    private readonly ILogger<CloudinaryImageService> _logger;

    public CloudinaryImageService(IConfiguration configuration, ILogger<CloudinaryImageService> logger)
    {
        _logger = logger;

        // Đọc credentials từ appsettings.json
        var cloudName = configuration["Cloudinary:CloudName"];
        var apiKey = configuration["Cloudinary:ApiKey"];
        var apiSecret = configuration["Cloudinary:ApiSecret"];

        // Khởi tạo Cloudinary client
        var account = new Account(cloudName, apiKey, apiSecret);
        _cloudinary = new Cloudinary(account);

        // Dùng HTTPS cho URL ảnh
        _cloudinary.Api.Secure = true;
    }

    /// <summary>
    /// Upload ảnh Base64 lên Cloudinary.
    /// 
    /// Luồng: Base64 string → decode thành byte[] → MemoryStream → upload lên Cloudinary
    /// Trả về: URL công khai dạng https://res.cloudinary.com/dignpno2i/image/upload/...
    /// </summary>
    public async Task<string?> UploadBase64ImageAsync(string base64Image, string fileName, string folder = "entry-images")
    {
        if (string.IsNullOrWhiteSpace(base64Image))
            return null;

        try
        {
            // Decode Base64 → byte[] → MemoryStream
            var imageBytes = Convert.FromBase64String(base64Image);
            using var stream = new MemoryStream(imageBytes);

            // Cấu hình tham số upload
            var uploadParams = new ImageUploadParams
            {
                File = new FileDescription(fileName, stream),
                PublicId = $"{folder}/{fileName}",       // Đường dẫn trên Cloudinary
                Overwrite = true,                        // Ghi đè nếu trùng tên
                // f_auto: Tự động chọn định dạng tối ưu (WebP cho Chrome, AVIF cho Firefox...)
                // q_auto: Tự động chọn chất lượng phù hợp (giảm dung lượng mà không mất chất lượng)
                Transformation = new Transformation().Quality("auto").FetchFormat("auto")
            };

            // Gọi API Cloudinary upload
            var uploadResult = await _cloudinary.UploadAsync(uploadParams);

            // Kiểm tra kết quả
            if (uploadResult.StatusCode == System.Net.HttpStatusCode.OK)
            {
                _logger.LogInformation(
                    "☁️ Upload Cloudinary thành công: {Url} | Size: {Size} bytes | Format: {Format}",
                    uploadResult.SecureUrl, uploadResult.Bytes, uploadResult.Format);

                // Trả về URL HTTPS công khai
                return uploadResult.SecureUrl.ToString();
            }
            else
            {
                _logger.LogError("❌ Upload Cloudinary thất bại: {Error}", uploadResult.Error?.Message);
                return null;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Upload Cloudinary exception: {Message}", ex.Message);
            return null;
        }
    }
}
