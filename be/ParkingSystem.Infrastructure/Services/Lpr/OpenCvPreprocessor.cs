using OpenCvSharp;
using ParkingSystem.Application.Interfaces.Lpr;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using Size = OpenCvSharp.Size;

namespace ParkingSystem.Infrastructure.Services.Lpr;

public class OpenCvPreprocessor : IOpenCvPreprocessor
{
    public async Task<(byte[] preprocessedImage, string croppedBase64)> CropAndPreprocessAsync(string base64Image, DetectionBox box)
    {
        return await Task.Run(() =>
        {
            // 1. Decode & Crop using ImageSharp
            var imageBytes = Convert.FromBase64String(base64Image);
            using var image = Image.Load<Rgb24>(imageBytes);

            var cropX = Math.Max(0, (int)box.X1);
            var cropY = Math.Max(0, (int)box.Y1);
            var cropW = Math.Min(image.Width - cropX, (int)(box.X2 - box.X1));
            var cropH = Math.Min(image.Height - cropY, (int)(box.Y2 - box.Y1));

            if (cropW <= 0 || cropH <= 0)
                throw new InvalidOperationException("Vùng crop không hợp lệ");

            using var cropped = image.Clone(ctx => ctx.Crop(new Rectangle(cropX, cropY, cropW, cropH)));

            string croppedBase64;
            byte[] croppedBytes;
            using (var ms = new MemoryStream())
            {
                cropped.SaveAsPng(ms);
                croppedBytes = ms.ToArray();
                croppedBase64 = Convert.ToBase64String(croppedBytes);
            }

            // 2. OpenCV processing
            using Mat colorMat = Cv2.ImDecode(croppedBytes, ImreadModes.Color);
            
            int targetHeight = 100;
            double scale = (double)targetHeight / colorMat.Height;
            using Mat ocrResized = new Mat();
            Cv2.Resize(colorMat, ocrResized, new Size(0, 0), scale, scale, InterpolationFlags.Cubic);

            using Mat gray = new Mat();
            Cv2.CvtColor(ocrResized, gray, ColorConversionCodes.BGR2GRAY);

            using var clahe = Cv2.CreateCLAHE(clipLimit: 3.0, tileGridSize: new Size(8, 8));
            using Mat enhanced = new Mat();
            clahe.Apply(gray, enhanced);

            using Mat filtered = new Mat();
            Cv2.BilateralFilter(enhanced, filtered, 9, 75, 75);

            using Mat binary = new Mat();
            Cv2.Threshold(filtered, binary, 0, 255, ThresholdTypes.Binary | ThresholdTypes.Otsu);

            using Mat kernel = Cv2.GetStructuringElement(MorphShapes.Rect, new Size(2, 2));
            using Mat morphed = new Mat();
            Cv2.MorphologyEx(binary, morphed, MorphTypes.Close, kernel);

            using Mat padded = new Mat();
            Cv2.CopyMakeBorder(morphed, padded, 15, 15, 15, 15, BorderTypes.Constant, new Scalar(255, 255, 255));

            using Mat ocrInput = new Mat();
            Cv2.CvtColor(padded, ocrInput, ColorConversionCodes.GRAY2BGR);

            return (ocrInput.ToBytes(".png"), croppedBase64);
        });
    }
}
