using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.Infrastructure.Services;

public class CloudinaryImageService : IImageUploadService
{
    private readonly Cloudinary? _cloudinary;
    private readonly ILogger<CloudinaryImageService> _logger;
    private readonly bool _isConfigured;

    public CloudinaryImageService(IConfiguration configuration, ILogger<CloudinaryImageService> logger)
    {
        _logger = logger;

        var cloudName = configuration["Cloudinary:CloudName"];
        var apiKey = configuration["Cloudinary:ApiKey"];
        var apiSecret = configuration["Cloudinary:ApiSecret"];

        if (string.IsNullOrWhiteSpace(cloudName) ||
            string.IsNullOrWhiteSpace(apiKey) ||
            string.IsNullOrWhiteSpace(apiSecret))
        {
            _logger.LogWarning(
                "⚠️ Cloudinary config missing or incomplete — Image upload DISABLED. " +
                "CloudName='{CloudName}', ApiKey='{ApiKey}', ApiSecret='{ApiSecret}'",
                cloudName ?? "(null)",
                string.IsNullOrWhiteSpace(apiKey) ? "(null)" : "***",
                string.IsNullOrWhiteSpace(apiSecret) ? "(null)" : "***");
            _isConfigured = false;
            return;
        }

        var account = new Account(cloudName, apiKey, apiSecret);
        _cloudinary = new Cloudinary(account);
        _cloudinary.Api.Secure = true;
        _isConfigured = true;
        _logger.LogInformation("☁️ Cloudinary configured: {CloudName}", cloudName);
    }

    /// <summary>
    /// Upload ảnh Base64 lên Cloudinary.
    /// Luồng: Base64 string → decode thành byte[] → MemoryStream → upload lên Cloudinary
    /// Trả về: URL công khai dạng https://res.cloudinary.com/dignpno2i/image/upload/...
    /// </summary>
    public async Task<string?> UploadBase64ImageAsync(string base64Image, string fileName, string folder = "entry-images")
    {
        if (string.IsNullOrWhiteSpace(base64Image))
            return null;

        if (!_isConfigured || _cloudinary == null)
        {
            _logger.LogWarning("⚠️ Cloudinary not configured — skipping upload for: {FileName}", fileName);
            return null;
        }

        try
        {
            // Loại bỏ phần prefix "data:image/png;base64," hoặc tương tự nếu FE gửi kèm
            if (base64Image.Contains(","))
            {
                base64Image = base64Image.Substring(base64Image.IndexOf(",") + 1);
            }

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
