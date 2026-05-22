using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using ParkingSystem.Application.Interfaces;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using Sdcb.PaddleInference;
using Sdcb.PaddleOCR;
using Sdcb.PaddleOCR.Models.LocalV3;
using Sdcb.PaddleOCR.Models.Local;
using OpenCvSharp;
using System.Text.RegularExpressions;

namespace ParkingSystem.Infrastructure.Services;

/// <summary>
/// Service nhận diện biển số xe hoàn chỉnh: YOLO detect + PaddleOCR.
/// 
/// Pipeline:
/// 1. Ảnh camera (Base64) → Decode
/// 2. YOLO ONNX → Detect vùng biển số (bounding box)
/// 3. Crop vùng biển số từ ảnh gốc
/// 4. Tiền xử lý ảnh (Resize x4, Grayscale, Threshold)
/// 5. PaddleOCR → Đọc ký tự từng dòng từ ảnh crop
/// 6. Hậu xử lý text (sửa lỗi OCR, gom dòng)
/// </summary>
public class LicensePlateOcrService : ILicensePlateOcrService, IDisposable
{
    private readonly InferenceSession _session;
    private const int ModelInputSize = 640;
    private const float ConfidenceThreshold = 0.25f;

    /// <summary>
    /// Khởi tạo service với đường dẫn model ONNX.
    /// </summary>
    /// <param name="modelPath">Đường dẫn tới file .onnx (YOLOv8)</param>
    public LicensePlateOcrService(string modelPath, string tessdataPath = "")
    {
        if (!File.Exists(modelPath))
            throw new FileNotFoundException($"Không tìm thấy model ONNX tại: {modelPath}");

        // Khởi tạo YOLO ONNX session (Singleton an toàn với đa luồng)
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

                // ===== BƯỚC 4 + 5: OpenCV tiền xử lý ANPR chuyên sâu + PaddleOCR =====
                // Kỹ thuật chuẩn công nghiệp nhận diện biển số xe (ANPR):
                // CLAHE → Bilateral Filter → Otsu Threshold → Morphology → PaddleOCR
                
                // 4a. Chuyển ảnh crop sang byte[] để đưa vào OpenCV
                byte[] croppedBytes;
                using (var ms = new MemoryStream())
                {
                    cropped.SaveAsPng(ms);
                    croppedBytes = ms.ToArray();
                }

                string rawText = "";
                float ocrConfidence = 0;

                using (Mat colorMat = Cv2.ImDecode(croppedBytes, ImreadModes.Color))
                {
                    // 4b. Resize lên chuẩn chiều cao 100px (giữ tỉ lệ)
                    // Ảnh quá nhỏ → PaddleOCR không nhận diện nổi
                    int targetHeight = 100;
                    double scale = (double)targetHeight / colorMat.Height;
                    using Mat ocrResized = new Mat();
                    Cv2.Resize(colorMat, ocrResized, new OpenCvSharp.Size(0, 0), scale, scale, InterpolationFlags.Cubic);

                    // 4c. Chuyển sang Grayscale
                    using Mat gray = new Mat();
                    Cv2.CvtColor(ocrResized, gray, ColorConversionCodes.BGR2GRAY);

                    // 4d. CLAHE — Contrast Limited Adaptive Histogram Equalization
                    // Đây là bước THEN CHỐT: cân bằng sáng tối CỤC BỘ trên toàn ảnh
                    // Giúp biển số chụp dưới ánh sáng chói/ngược sáng/ban đêm đều rõ nét như nhau
                    using var clahe = Cv2.CreateCLAHE(clipLimit: 3.0, tileGridSize: new OpenCvSharp.Size(8, 8));
                    using Mat enhanced = new Mat();
                    clahe.Apply(gray, enhanced);

                    // 4e. Bilateral Filter — Làm mịn ảnh nhưng GIỮU NGUYÊN cạnh chữ
                    // Khác Gaussian Blur (làm mờ tất), bilateral chỉ mờ vùng phẳng, giữ viền sắc nét
                    using Mat filtered = new Mat();
                    Cv2.BilateralFilter(enhanced, filtered, 9, 75, 75);

                    // 4f. Otsu Threshold — Tự động tìm ngưỡng tối ưu cho từng ảnh
                    // Không dùng ngưỡng cố định (0.5) vì mỗi ảnh sáng/tối khác nhau
                    // Otsu phân tích histogram và chọn ngưỡng chia 2 đỉnh rõ nhất
                    using Mat binary = new Mat();
                    Cv2.Threshold(filtered, binary, 0, 255, ThresholdTypes.Binary | ThresholdTypes.Otsu);

                    // 4g. Morphological Close — Lấp khe hở nhỏ bên trong nét chữ
                    // Ký tự "8", "0", "B" thường bị đứt nét do threshold → close sẽ nối lại
                    using Mat kernel = Cv2.GetStructuringElement(MorphShapes.Rect, new OpenCvSharp.Size(2, 2));
                    using Mat morphed = new Mat();
                    Cv2.MorphologyEx(binary, morphed, MorphTypes.Close, kernel);

                    // 4h. Padding viền trắng 15px xung quanh
                    using Mat padded = new Mat();
                    Cv2.CopyMakeBorder(morphed, padded, 15, 15, 15, 15, 
                        BorderTypes.Constant, new Scalar(255, 255, 255));

                    // 4i. Chuyển ngược về 3 kênh màu (BGR) vì PaddleOCR yêu cầu input 3 channels
                    using Mat ocrInput = new Mat();
                    Cv2.CvtColor(padded, ocrInput, ColorConversionCodes.GRAY2BGR);

                    // ===== BƯỚC 5: PaddleOCR đọc ký tự =====
                    using (PaddleOcrAll all = new PaddleOcrAll(LocalFullModels.EnglishV3, PaddleDevice.Mkldnn()))
                    {
                        all.AllowRotateDetection = true;
                        all.Enable180Classification = true; // Xử lý biển số bị lật ngược

                        PaddleOcrResult ocrResult = all.Run(ocrInput);

                        if (ocrResult.Regions.Length > 0)
                        {
                            var lines = ocrResult.Regions
                                .OrderBy(r => r.Rect.Center.Y)
                                .Select(r => r.Text)
                                .ToList();

                            rawText = string.Join("\n", lines);
                            ocrConfidence = ocrResult.Regions.Average(r => r.Score);
                        }
                    }
                }

                // ===== BƯỚC 6: Hậu xử lý — Format biển số xe Việt Nam =====
                var licensePlate = PostProcessPlateText(rawText);

                return new LicensePlateResult
                {
                    IsDetected = true,
                    Confidence = best.Confidence,
                    CroppedPlateBase64 = croppedBase64,
                    LicensePlate = licensePlate,
                    RawOcrText = rawText,
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
    /// 
    /// Các dạng biển số VN:
    ///   75A-145.19  → [2 số][1 chữ][5 số]
    ///   29-AB 226.58 → [2 số][2 chữ][5 số]
    ///   12-B1 168.88 → [2 số][1 chữ][1 số][5 số]
    /// 
    /// Quy tắc vị trí:
    ///   Vị trí 0-1: Luôn là SỐ (mã tỉnh 11-99)
    ///   Vị trí 2  : Luôn là CHỮ CÁI (A-Z)
    ///   Vị trí 3  : Có thể CHỮ hoặc SỐ → KHÔNG SỬA
    ///   Vị trí 4+ : Luôn là SỐ
    /// </summary>
    private string PostProcessPlateText(string rawText)
    {
        if (string.IsNullOrWhiteSpace(rawText))
            return string.Empty;

        // Bước 1: Chuẩn hóa chữ in hoa, loại bỏ ký tự đặc biệt
        var upper = rawText.ToUpper().Trim();
        var cleaned = Regex.Replace(upper, @"[^A-Z0-9]", "");

        if (cleaned.Length < 5) return string.Empty;

        char[] arr = cleaned.ToCharArray();

        for (int i = 0; i < arr.Length; i++)
        {
            if (i < 2)
            {
                // === VỊ TRÍ 0-1: Mã tỉnh — BẮT BUỘC là SỐ ===
                if (!char.IsDigit(arr[i]))
                {
                    arr[i] = LetterToDigit(arr[i]);
                }
            }
            else if (i == 2)
            {
                // === VỊ TRÍ 2: Seri — BẮT BUỘC là CHỮ ===
                if (char.IsDigit(arr[i]))
                {
                    arr[i] = DigitToLetter(arr[i]);
                }
            }
            else if (i == 3)
            {
                // === VỊ TRÍ 3: Có thể CHỮ hoặc SỐ → GIỮ NGUYÊN ===
                // Không sửa gì cả vì không biết chắc loại xe nào
            }
            else
            {
                // === VỊ TRÍ 4+: Số đăng ký — BẮT BUỘC là SỐ ===
                if (!char.IsDigit(arr[i]))
                {
                    arr[i] = LetterToDigit(arr[i]);
                }
            }
        }

        return new string(arr);
    }

    /// <summary>
    /// Chuyển chữ cái bị nhầm thành số tương ứng (dùng cho vị trí bắt buộc là SỐ)
    /// </summary>
    private static char LetterToDigit(char c) => c switch
    {
        'O' or 'Q' or 'D' => '0',
        'I' or 'L' or 'T' => '1',
        'Z' => '2',
        'A' => '4',
        'S' => '5',
        'G' => '6',
        'B' => '8',
        _ => c
    };

    /// <summary>
    /// Chuyển số bị nhầm thành chữ cái tương ứng (dùng cho vị trí bắt buộc là CHỮ)
    /// </summary>
    private static char DigitToLetter(char c) => c switch
    {
        '0' => 'D',
        '1' => 'T',
        '2' => 'Z',
        '5' => 'S',
        '6' => 'G',
        '8' => 'B',
        _ => c
    };

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
