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
        // 1. Kiểm tra cache nếu có trackId
        if (!string.IsNullOrEmpty(trackId))
        {
            var cached = _cacheService.GetCachedPlate(trackId);
            if (cached != null) return cached;
        }

        // 2. YOLO Detect
        var box = await _yoloDetector.DetectBestPlateAsync(base64Image);
        if (box == null)
        {
            return new LprResult { IsDetected = false, Message = "Không phát hiện biển số." };
        }

        // 3. OpenCV Tiền xử lý
        var (preprocessedImage, croppedBase64) = await _openCvPreprocessor.CropAndPreprocessAsync(base64Image, box);

        // 4. PaddleOCR
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

        // 5. Post Processing
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

        // 6. Lưu vào cache nếu đủ tự tin
        if (!string.IsNullOrEmpty(trackId) && !result.NeedManualReview)
        {
            _cacheService.SetCachedPlate(trackId, result, TimeSpan.FromSeconds(5));
        }

        return result;
    }

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

        // Thực hiện Voting
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
