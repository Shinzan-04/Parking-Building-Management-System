using ParkingSystem.Application.Interfaces.Lpr;

namespace ParkingSystem.Infrastructure.Services.Lpr;

public class LicensePlateRecognizer : ILicensePlateRecognizer
{
    private readonly IYoloDetector _yoloDetector;
    private readonly IOpenCvPreprocessor _openCvPreprocessor;
    private readonly IPaddleOcrReader _ocrReader;
    private readonly IPlatePostProcessor _postProcessor;
    private readonly IPlateCacheService _cacheService;
    private readonly IMultiFrameVotingService _votingService;

    // Ngưỡng tự tin OCR để quyết định có cần con người review hay không
    private const float MinOcrConfidence = 0.85f;

    public LicensePlateRecognizer(
        IYoloDetector yoloDetector,
        IOpenCvPreprocessor openCvPreprocessor,
        IPaddleOcrReader ocrReader,
        IPlatePostProcessor postProcessor,
        IPlateCacheService cacheService,
        IMultiFrameVotingService votingService)
    {
        _yoloDetector = yoloDetector;
        _openCvPreprocessor = openCvPreprocessor;
        _ocrReader = ocrReader;
        _postProcessor = postProcessor;
        _cacheService = cacheService;
        _votingService = votingService;
    }

    public async Task<LprResult> RecognizeFrameAsync(string base64Image, string? trackId = null)
    {
        // ==========================================
        // BƯỚC 1: CACHING & TRACKING
        // Mục đích: Nếu camera đang quay một xe (cùng trackId), 
        // không cần chạy OCR lại nếu đã có kết quả chuẩn trước đó, giúp giảm tải CPU/GPU.
        // ==========================================
        if (!string.IsNullOrEmpty(trackId))
        {
            var cached = _cacheService.GetCachedPlate(trackId);
            if (cached != null) return cached;
        }

        // ==========================================
        // BƯỚC 2: NHẬN DIỆN VÙNG BIỂN SỐ (YOLO)
        // Dùng YOLO để tìm bounding box chứa biển số trong toàn bộ khung hình camera.
        // Trả về toạ độ hình chữ nhật (box).
        // ==========================================
        var box = await _yoloDetector.DetectBestPlateAsync(base64Image);
        if (box == null)
        {
            return new LprResult { IsDetected = false, Message = "Không phát hiện biển số." };
        }

        // ==========================================
        // BƯỚC 3: TIỀN XỬ LÝ ẢNH (OPENCV)
        // Cắt đúng vùng biển số ra (Crop), cân bằng sáng, tăng độ tương phản,
        // binarize (chuyển trắng đen) để chữ nổi bật lên, giúp OCR đọc dễ hơn.
        // ==========================================
        var (preprocessedImage, croppedBase64) = await _openCvPreprocessor.CropAndPreprocessAsync(base64Image, box);

        // ==========================================
        // BƯỚC 4: ĐỌC KÝ TỰ (PADDLE OCR)
        // Trích xuất text từ vùng ảnh đã được OpenCV xử lý.
        // ==========================================
        var (rawText, confidence) = await _ocrReader.ReadTextAsync(preprocessedImage);

        if (string.IsNullOrWhiteSpace(rawText))
        {
            return new LprResult
            {
                IsDetected = true,
                Confidence = confidence,
                CroppedPlateBase64 = croppedBase64,
                Message = $"Phát hiện biển (YOLO: {box.Confidence:P0}) nhưng không đọc được chữ."
            };
        }

        // ==========================================
        // BƯỚC 5: HẬU XỬ LÝ KẾT QUẢ (POST PROCESSING)
        // Chuẩn hoá biển số: loại bỏ các ký tự đặc biệt, sửa các lỗi OCR phổ biến 
        // (ví dụ: chữ 'O' nhầm thành số '0', 'Z' nhầm thành '2' tuỳ theo vị trí format biển VN).
        // ==========================================
        string cleanedPlate = _postProcessor.CleanAndFormatPlate(rawText);

        var result = new LprResult
        {
            IsDetected = true,
            LicensePlate = cleanedPlate,
            RawOcrText = rawText,
            Confidence = confidence,
            NeedManualReview = confidence < MinOcrConfidence,
            CroppedPlateBase64 = croppedBase64,
            Message = $"OCR: {confidence:P0} - {cleanedPlate}"
        };

        // ==========================================
        // BƯỚC 6: LƯU CACHE (NẾU ĐỦ TỰ TIN)
        // Nếu độ tự tin >= ngưỡng cho phép, lưu lại để các frame tiếp theo có cùng trackId
        // chỉ cần lấy từ cache ra xài, không cần chạy qua AI (tiết kiệm 99% thời gian xử lý frame).
        // ==========================================
        if (!string.IsNullOrEmpty(trackId) && !result.NeedManualReview)
        {
            _cacheService.SetCachedPlate(trackId, result, TimeSpan.FromSeconds(5));
        }

        return result;
    }

    /// <summary>
    /// ==========================================
    /// BƯỚC BỔ SUNG: MULTI-FRAME VOTING
    /// Mục đích: Để tăng tối đa độ chính xác, thay vì chụp 1 ảnh, camera gửi 1 chùm ảnh (3-5 frames).
    /// Hàm này chạy OCR cho toàn bộ ảnh, sau đó dùng thuật toán biểu quyết (Voting) 
    /// để chốt lại kết quả xuất hiện nhiều nhất.
    /// ==========================================
    /// </summary>
    public async Task<LprResult> RecognizeBatchAsync(List<string> base64Images)
    {
        if (base64Images == null || !base64Images.Any())
            return new LprResult { IsDetected = false, Message = "Không có ảnh đầu vào." };

        string batchTrackId = Guid.NewGuid().ToString();

        // Chạy tuần tự hoặc song song tùy resource, ở đây chạy song song để nhanh
        var tasks = base64Images.Select(img => RecognizeFrameAsync(img));
        var results = await Task.WhenAll(tasks);

        var validResults = results.Where(r => r.IsDetected && !string.IsNullOrWhiteSpace(r.LicensePlate)).ToList();

        if (!validResults.Any())
            return new LprResult { IsDetected = false, Message = "Toàn bộ frame đều không đọc được." };

        // Nạp vào Voting Service
        foreach (var r in validResults)
        {
            _votingService.AddFrameResult(batchTrackId, r.LicensePlate); // Dùng cleaned plate để vote
        }

        // Thực hiện Voting: Lấy biển số xuất hiện nhiều nhất
        string votedPlate = _votingService.GetVotedPlate(batchTrackId);
        _votingService.ClearTrack(batchTrackId);

        // Đánh giá Confidence dựa trên trung bình
        float avgConfidence = validResults.Average(r => r.Confidence);

        return new LprResult
        {
            IsDetected = true,
            LicensePlate = votedPlate,
            RawOcrText = votedPlate,
            Confidence = avgConfidence,
            NeedManualReview = avgConfidence < MinOcrConfidence,
            Message = $"Multi-Frame Voted (từ {validResults.Count} frames): {votedPlate}"
        };
    }
}
