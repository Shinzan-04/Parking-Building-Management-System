using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using ParkingSystem.Application.Interfaces;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace ParkingSystem.Infrastructure.Services;

/// <summary>
/// Service nhận diện biển số xe sử dụng YOLOv8n ONNX + OCR đơn giản.
/// Luồng: Ảnh camera → YOLO detect vùng biển số → Crop → Trả về ảnh vùng biển số + tọa độ.
/// 
/// Trong thực tế production, phần đọc ký tự (OCR) sẽ được thực hiện bằng Tesseract hoặc PaddleOCR.
/// Hiện tại service này tập trung vào phát hiện vùng biển số bằng YOLO.
/// </summary>
public class LicensePlateOcrService : ILicensePlateOcrService, IDisposable
{
    private readonly InferenceSession _session;
    private const int ModelInputSize = 640;

    // COCO class index 2 = "car", tuy nhiên model detect plate riêng sẽ dùng class 0 = "license_plate"
    // Tùy model bạn dùng mà thay đổi giá trị này
    private const float ConfidenceThreshold = 0.25f;

    public LicensePlateOcrService(string modelPath)
    {
        if (!File.Exists(modelPath))
            throw new FileNotFoundException($"Không tìm thấy model ONNX tại: {modelPath}");

        var options = new SessionOptions();
        options.GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL;
        _session = new InferenceSession(modelPath, options);
    }

    public async Task<LicensePlateResult> DetectPlateAsync(string imageBase64)
    {
        return await Task.Run(() =>
        {
            try
            {
                // Bước 1: Decode ảnh từ Base64
                var imageBytes = Convert.FromBase64String(imageBase64);
                using var image = Image.Load<Rgb24>(imageBytes);

                var originalWidth = image.Width;
                var originalHeight = image.Height;

                // Bước 2: Resize ảnh về kích thước model yêu cầu (640x640)
                using var resized = image.Clone(ctx => ctx.Resize(ModelInputSize, ModelInputSize));

                // Bước 3: Chuyển ảnh thành tensor [1, 3, 640, 640] (NCHW format)
                var tensor = new DenseTensor<float>(new[] { 1, 3, ModelInputSize, ModelInputSize });
                for (int y = 0; y < ModelInputSize; y++)
                {
                    for (int x = 0; x < ModelInputSize; x++)
                    {
                        var pixel = resized[x, y];
                        tensor[0, 0, y, x] = pixel.R / 255f; // R channel
                        tensor[0, 1, y, x] = pixel.G / 255f; // G channel
                        tensor[0, 2, y, x] = pixel.B / 255f; // B channel
                    }
                }

                // Bước 4: Chạy inference YOLO
                var inputName = _session.InputNames[0];
                var inputs = new List<NamedOnnxValue>
                {
                    NamedOnnxValue.CreateFromTensor(inputName, tensor)
                };

                using var results = _session.Run(inputs);
                var output = results.First().AsTensor<float>();

                // Bước 5: Parse kết quả YOLO (format: [1, 84, 8400] cho YOLOv8)
                // 84 = 4 (bbox) + 80 (classes COCO) hoặc 4 + 1 (nếu model custom 1 class)
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

                // Bước 6: Crop vùng biển số từ ảnh gốc
                var cropX = Math.Max(0, (int)best.X1);
                var cropY = Math.Max(0, (int)best.Y1);
                var cropW = Math.Min(originalWidth - cropX, (int)(best.X2 - best.X1));
                var cropH = Math.Min(originalHeight - cropY, (int)(best.Y2 - best.Y1));

                string? croppedBase64 = null;
                if (cropW > 0 && cropH > 0)
                {
                    using var cropped = image.Clone(ctx =>
                        ctx.Crop(new Rectangle(cropX, cropY, cropW, cropH)));

                    using var ms = new MemoryStream();
                    cropped.SaveAsPng(ms);
                    croppedBase64 = Convert.ToBase64String(ms.ToArray());
                }

                return new LicensePlateResult
                {
                    IsDetected = true,
                    Confidence = best.Confidence,
                    CroppedPlateBase64 = croppedBase64,
                    LicensePlate = $"DETECTED_AT_{cropX},{cropY},{cropW},{cropH}",
                    Message = $"Phát hiện biển số xe (confidence: {best.Confidence:P1}). Vùng biển số đã được crop."
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
    /// Parse output tensor của YOLOv8
    /// YOLOv8 output format: [1, (4+num_classes), num_detections]
    /// Với COCO: [1, 84, 8400] — 84 = 4 bbox + 80 classes
    /// Với custom 1 class: [1, 5, 8400] — 5 = 4 bbox + 1 class
    /// </summary>
    private List<Detection> ParseYoloOutput(Tensor<float> output, int originalWidth, int originalHeight)
    {
        var detections = new List<Detection>();
        var dimensions = output.Dimensions;

        // dimensions[0] = batch, dimensions[1] = attributes, dimensions[2] = num_detections
        int numAttributes = dimensions[1]; // 84 cho COCO, 5 cho custom 1-class
        int numDetections = dimensions[2]; // 8400
        int numClasses = numAttributes - 4;

        float scaleX = (float)originalWidth / ModelInputSize;
        float scaleY = (float)originalHeight / ModelInputSize;

        for (int i = 0; i < numDetections; i++)
        {
            // Tìm class có score cao nhất
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

            // YOLOv8 bbox format: center_x, center_y, width, height
            float cx = output[0, 0, i];
            float cy = output[0, 1, i];
            float w = output[0, 2, i];
            float h = output[0, 3, i];

            // Chuyển về tọa độ góc trên-trái (x1,y1) và góc dưới-phải (x2,y2)
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

        // Non-Maximum Suppression (NMS) — loại bỏ các box trùng lặp
        return ApplyNms(detections, 0.45f);
    }

    /// <summary>
    /// Non-Maximum Suppression: giữ lại detection tốt nhất, loại bỏ các box chồng chéo
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
