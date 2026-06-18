using OpenCvSharp;
using ParkingSystem.Application.Interfaces.Lpr;
using Sdcb.PaddleInference;
using Sdcb.PaddleOCR;
using Sdcb.PaddleOCR.Models.LocalV3;
using Sdcb.PaddleOCR.Models.Local;

namespace ParkingSystem.Infrastructure.Services.Lpr;

public class PaddleOcrReader : IPaddleOcrReader
{
    public async Task<(string RawText, float Confidence)> ReadTextAsync(byte[] preprocessedImageBytes)
    {
        return await Task.Run(() =>
        {
            using Mat ocrInput = Cv2.ImDecode(preprocessedImageBytes, ImreadModes.Color);

            using PaddleOcrAll all = new PaddleOcrAll(LocalFullModels.EnglishV3, PaddleDevice.Mkldnn());
            all.AllowRotateDetection = true;
            all.Enable180Classification = true;

            PaddleOcrResult ocrResult = all.Run(ocrInput);

            if (ocrResult.Regions.Length > 0)
            {
                var lines = ocrResult.Regions
                    .OrderBy(r => r.Rect.Center.Y)
                    .Select(r => r.Text)
                    .ToList();

                string rawText = string.Join("", lines);
                float ocrConfidence = ocrResult.Regions.Average(r => r.Score);

                return (rawText, ocrConfidence);
            }

            return (string.Empty, 0f);
        });
    }
}
