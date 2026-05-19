using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using ParkingSystem.Application.Interfaces;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using Tesseract;
using System.Text.RegularExpressions;

namespace ParkingSystem.Infrastructure.Services;

/// <summary>
/// Service nhận diện biển số xe hoàn chỉnh: YOLO detect + Tesseract OCR.
/// 
/// Pipeline:
/// 1. Ảnh camera (Base64) → Decode
/// 2. YOLO ONNX → Detect vùng biển số (bounding box)
/// 3. Crop vùng biển số từ ảnh gốc
/// 4. Tiền xử lý ảnh (Grayscale, Threshold, Resize) → Tăng độ chính xác OCR
/// 5. Tesseract OCR → Đọc ký tự từ ảnh crop
/// 6. Hậu xử lý text (loại bỏ ký tự lạ, format biển số VN)
/// </summary>
public class LicensePlateOcrService : ILicensePlateOcrService, IDisposable
{
    private readonly InferenceSession _session;
    private readonly TesseractEngine _ocrEngine;
    private const int ModelInputSize = 640;
    private const float ConfidenceThreshold = 0.25f;

    /// <summary>
    /// Khởi tạo service với đường dẫn model ONNX và thư mục tessdata.
    /// </summary>
    /// <param name="modelPath">Đường dẫn tới file .onnx (YOLOv8)</param>
    /// <param name="tessdataPath">Đường dẫn tới thư mục chứa eng.traineddata</param>
    public LicensePlateOcrService(string modelPath, string tessdataPath)
    {
        if (!File.Exists(modelPath))
            throw new FileNotFoundException($"Không tìm thấy model ONNX tại: {modelPath}");

        // Khởi tạo YOLO ONNX session
        var options = new SessionOptions();
        options.GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL;
        _session = new InferenceSession(modelPath, options);

        // Khởi tạo Tesseract OCR engine
        // PSM 7 = "Treat the image as a single text line" — phù hợp cho biển số 1 dòng
        // PSM 6 = "Assume a single uniform block of text" — phù hợp cho biển số 2 dòng
        _ocrEngine = new TesseractEngine(tessdataPath, "eng", EngineMode.Default);

        // Chỉ cho phép ký tự biển số xe Việt Nam (chữ cái + số + dấu chấm/gạch)
        _ocrEngine.DefaultPageSegMode = PageSegMode.SingleBlock;
        _ocrEngine.SetVariable("tessedit_char_whitelist", "0123456789ABCDEFGHKLMNPRSTUVXYZ.-");
    }

    public async Task<LicensePlateResult> DetectPlateAsync(string imageBase64)
    {
        return await Task.Run(() =>
        {
            try
            {
                // ===== BƯỚC 1: Decode ảnh từ Base64 =====
                var imageBytes = Convert.FromBase64String(imageBase64);
                using var image = Image.Load<Rgb24>(imageBytes);

                var originalWidth = image.Width;
                var originalHeight = image.Height;

                // ===== BƯỚC 2: YOLO detect vùng biển số =====
                using var resized = image.Clone(ctx => ctx.Resize(ModelInputSize, ModelInputSize));

                var tensor = new DenseTensor<float>(new[] { 1, 3, ModelInputSize, ModelInputSize });
                for (int y = 0; y < ModelInputSize; y++)
                {
                    for (int x = 0; x < ModelInputSize; x++)
                    {
                        var pixel = resized[x, y];
                        tensor[0, 0, y, x] = pixel.R / 255f;
                        tensor[0, 1, y, x] = pixel.G / 255f;
                        tensor[0, 2, y, x] = pixel.B / 255f;
                    }
                }

                var inputName = _session.InputNames[0];
                var inputs = new List<NamedOnnxValue>
                {
                    NamedOnnxValue.CreateFromTensor(inputName, tensor)
                };

                using var results = _session.Run(inputs);
                var output = results.First().AsTensor<float>();

                var detections = ParseYoloOutput(output, originalWidth, originalHeight);

                if (detections.Count == 0)
                {
                    return new LicensePlateResult
                    {
                        IsDetected = false,
                        Message = "Không phát hiện được biển số xe trong ảnh."
                    };
                }

                // Lấy detection có confidence cao nhất
                var best = detections.OrderByDescending(d => d.Confidence).First();

                // ===== BƯỚC 3: Crop vùng biển số =====
                var cropX = Math.Max(0, (int)best.X1);
                var cropY = Math.Max(0, (int)best.Y1);
                var cropW = Math.Min(originalWidth - cropX, (int)(best.X2 - best.X1));
                var cropH = Math.Min(originalHeight - cropY, (int)(best.Y2 - best.Y1));

                if (cropW <= 0 || cropH <= 0)
                {
                    return new LicensePlateResult
                    {
                        IsDetected = true,
                        Confidence = best.Confidence,
                        Message = "Phát hiện biển số nhưng vùng crop không hợp lệ."
                    };
                }

                // Crop ảnh biển số
                using var cropped = image.Clone(ctx =>
                    ctx.Crop(new Rectangle(cropX, cropY, cropW, cropH)));

                // Lưu ảnh crop dạng Base64 để trả về cho client
                string croppedBase64;
                using (var ms = new MemoryStream())
                {
                    cropped.SaveAsPng(ms);
                    croppedBase64 = Convert.ToBase64String(ms.ToArray());
                }

                // ===== BƯỚC 4: Tiền xử lý ảnh cho OCR =====
                // Chuyển sang grayscale + tăng contrast + resize lớn hơn để OCR đọc tốt
                using var preprocessed = cropped.Clone(ctx =>
                {
                    ctx.Grayscale();
                    ctx.Contrast(1.5f);
                    // Resize lên ít nhất 300px chiều rộng để Tesseract đọc tốt hơn
                    if (cropped.Width < 300)
                    {
                        var scale = 300.0 / cropped.Width;
                        ctx.Resize((int)(cropped.Width * scale), (int)(cropped.Height * scale));
                    }
                });

                // ===== BƯỚC 5: Tesseract OCR — đọc ký tự =====
                byte[] preprocessedBytes;
                using (var ms = new MemoryStream())
                {
                    preprocessed.SaveAsPng(ms);
                    preprocessedBytes = ms.ToArray();
                }

                string rawText = "";
                float ocrConfidence = 0;

                using (var pix = Pix.LoadFromMemory(preprocessedBytes))
                using (var page = _ocrEngine.Process(pix))
                {
                    rawText = page.GetText().Trim();
                    ocrConfidence = page.GetMeanConfidence();
                }

                // ===== BƯỚC 6: Hậu xử lý — Format biển số xe Việt Nam =====
                var licensePlate = PostProcessPlateText(rawText);

                return new LicensePlateResult
                {
                    IsDetected = true,
                    Confidence = best.Confidence,
                    CroppedPlateBase64 = croppedBase64,
                    LicensePlate = licensePlate,
                    Message = string.IsNullOrEmpty(licensePlate)
                        ? $"Phát hiện biển số (YOLO: {best.Confidence:P0}) nhưng không đọc được ký tự. Raw OCR: \"{rawText}\""
                        : $"Nhận diện thành công: {licensePlate} (YOLO: {best.Confidence:P0}, OCR: {ocrConfidence:P0})"
                };
            }
            catch (Exception ex)
            {
                return new LicensePlateResult
                {
                    IsDetected = false,
                    Message = $"Lỗi xử lý ảnh: {ex.Message}"
                };
            }
        });
    }

    /// <summary>
    /// Hậu xử lý text OCR — Chuẩn hóa biển số xe Việt Nam.
    /// Biển số VN có dạng: "51F-123.45", "30A-12345", "29B1-234.56"
    /// Loại bỏ ký tự lạ, khoảng trắng thừa, sửa lỗi OCR phổ biến.
    /// </summary>
    private string PostProcessPlateText(string rawText)
    {
        if (string.IsNullOrWhiteSpace(rawText))
            return string.Empty;

        // Loại bỏ ký tự không hợp lệ (chỉ giữ chữ, số, dấu chấm, gạch ngang)
        var cleaned = Regex.Replace(rawText, @"[^A-Z0-9.\-]", "", RegexOptions.IgnoreCase);
        cleaned = cleaned.ToUpper().Trim();

        // Sửa lỗi OCR phổ biến trên biển số
        cleaned = cleaned
            .Replace('O', '0')  // O thường bị nhầm với 0
            .Replace('I', '1')  // I thường bị nhầm với 1
            .Replace('Q', '0')  // Q bị nhầm với 0
            .Replace('S', '5')  // S bị nhầm với 5
            .Replace('Z', '2')  // Z bị nhầm với 2
            .Replace('B', '8'); // B bị nhầm với 8 (cân nhắc context)

        // Kiểm tra: Biển số VN tối thiểu 7 ký tự (vd: 51F1234)
        if (cleaned.Length < 5)
            return string.Empty;

        return cleaned;
    }

    /// <summary>
    /// Parse output tensor của YOLOv8
    /// YOLOv8 output format: [1, (4+num_classes), num_detections]
    /// Với custom 1 class (license_plate): [1, 5, 8400]
    /// </summary>
    private List<Detection> ParseYoloOutput(Tensor<float> output, int originalWidth, int originalHeight)
    {
        var detections = new List<Detection>();
        var dimensions = output.Dimensions;

        int numAttributes = dimensions[1];
        int numDetections = dimensions[2];
        int numClasses = numAttributes - 4;

        float scaleX = (float)originalWidth / ModelInputSize;
        float scaleY = (float)originalHeight / ModelInputSize;

        for (int i = 0; i < numDetections; i++)
        {
            float maxScore = 0;
            int maxClassId = 0;
            for (int c = 0; c < numClasses; c++)
            {
                float score = output[0, 4 + c, i];
                if (score > maxScore)
                {
                    maxScore = score;
                    maxClassId = c;
                }
            }

            if (maxScore < ConfidenceThreshold)
                continue;

            float cx = output[0, 0, i];
            float cy = output[0, 1, i];
            float w = output[0, 2, i];
            float h = output[0, 3, i];

            float x1 = (cx - w / 2) * scaleX;
            float y1 = (cy - h / 2) * scaleY;
            float x2 = (cx + w / 2) * scaleX;
            float y2 = (cy + h / 2) * scaleY;

            detections.Add(new Detection
            {
                ClassId = maxClassId,
                Confidence = maxScore,
                X1 = x1, Y1 = y1,
                X2 = x2, Y2 = y2
            });
        }

        return ApplyNms(detections, 0.45f);
    }

    /// <summary>
    /// Non-Maximum Suppression: giữ lại detection tốt nhất, loại bỏ box chồng chéo
    /// </summary>
    private List<Detection> ApplyNms(List<Detection> detections, float iouThreshold)
    {
        var sorted = detections.OrderByDescending(d => d.Confidence).ToList();
        var result = new List<Detection>();

        while (sorted.Count > 0)
        {
            var best = sorted[0];
            result.Add(best);
            sorted.RemoveAt(0);
            sorted.RemoveAll(d => CalculateIoU(best, d) > iouThreshold);
        }

        return result;
    }

    /// <summary>
    /// Tính Intersection over Union giữa 2 bounding box
    /// </summary>
    private float CalculateIoU(Detection a, Detection b)
    {
        float x1 = Math.Max(a.X1, b.X1);
        float y1 = Math.Max(a.Y1, b.Y1);
        float x2 = Math.Min(a.X2, b.X2);
        float y2 = Math.Min(a.Y2, b.Y2);

        float intersection = Math.Max(0, x2 - x1) * Math.Max(0, y2 - y1);
        float areaA = (a.X2 - a.X1) * (a.Y2 - a.Y1);
        float areaB = (b.X2 - b.X1) * (b.Y2 - b.Y1);

        return intersection / (areaA + areaB - intersection + 1e-6f);
    }

    public void Dispose()
    {
        _session?.Dispose();
        _ocrEngine?.Dispose();
    }

    private class Detection
    {
        public int ClassId { get; set; }
        public float Confidence { get; set; }
        public float X1 { get; set; }
        public float Y1 { get; set; }
        public float X2 { get; set; }
        public float Y2 { get; set; }
    }
}
