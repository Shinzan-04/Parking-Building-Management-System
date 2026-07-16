namespace ParkingSystem.Application.Interfaces;

/// <summary>
/// Service upload ảnh lên cloud (Cloudinary).
/// Dùng để lưu ảnh biển số khi check-in làm bằng chứng tranh chấp.
/// </summary>
public interface IImageUploadService
{
    /// <summary>
    /// Upload ảnh từ Base64 string lên Cloudinary.
    /// Trả về URL công khai của ảnh đã upload.
    /// </summary>
    /// <param name="base64Image">Ảnh dạng Base64 (không có prefix data:image/...)</param>
    /// <param name="fileName">Tên file (dùng làm public_id trên Cloudinary)</param>
    /// <param name="folder">Thư mục trên Cloudinary (mặc định: "entry-images")</param>
    /// <returns>URL công khai của ảnh, null nếu lỗi</returns>
    Task<string?> UploadBase64ImageAsync(string base64Image, string fileName, string folder = "entry-images");
}
