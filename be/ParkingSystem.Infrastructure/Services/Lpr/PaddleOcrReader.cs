using OpenCvSharp;
using ParkingSystem.Application.Interfaces.Lpr;
using Sdcb.PaddleInference;
using Sdcb.PaddleOCR;
using Sdcb.PaddleOCR.Models.LocalV3;
using Sdcb.PaddleOCR.Models.Local;

namespace ParkingSystem.Infrastructure.Services.Lpr;

public class PaddleOcrReader : IPaddleOcrReader, IDisposable
{
    private PaddleOcrAll _ocrAll;
    private readonly object _lockObj = new object();

    public PaddleOcrReader()
    {
        InitOcr();
    }

    private void InitOcr()
    {
        try
        {
            _ocrAll = new PaddleOcrAll(LocalFullModels.EnglishV3, PaddleDevice.Mkldnn())
            {
                AllowRotateDetection = true,
                Enable180Classification = true
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[OCR WARNING] Failed to initialize PaddleOCR: {ex.Message}. OCR will be disabled.");
            _ocrAll = null;
        }
    }

    public async Task<(string RawText, float Confidence)> ReadTextAsync(byte[] preprocessedImageBytes)
    {
        return await Task.Run(() =>
        {
            using Mat ocrInput = Cv2.ImDecode(preprocessedImageBytes, ImreadModes.Color);
            if (ocrInput.Empty() || ocrInput.Rows < 10 || ocrInput.Cols < 10)
            {
                return (string.Empty, 0f);
            }

            if (_ocrAll == null)
            {
                Console.WriteLine("[OCR WARNING] OCR model is not loaded. Returning empty text.");
                return (string.Empty, 0f);
            }

            PaddleOcrResult ocrResult;
            try
            {
                lock (_lockObj)
                {
                    ocrResult = _ocrAll.Run(ocrInput);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OCR ERROR] {ex.Message} -> Re-initializing model...");
                lock (_lockObj)
                {
                    try { _ocrAll?.Dispose(); } catch {}
                    InitOcr();
                }
                return (string.Empty, 0f);
            }

            if (ocrResult.Regions.Length > 0)
            {
                var lines = ocrResult.Regions
                    .OrderBy(r => r.Rect.Center.Y)
                    .Select(r => r.Text)
                    .ToList();

                string rawText = string.Join("", lines);
                float ocrConfidence = ocrResult.Regions.Average(r => float.IsNaN(r.Score) || float.IsInfinity(r.Score) ? 0f : r.Score);
                if (float.IsNaN(ocrConfidence) || float.IsInfinity(ocrConfidence)) ocrConfidence = 0f;

                return (rawText, ocrConfidence);
            }

            return (string.Empty, 0f);
        });
    }

    public void Dispose()
    {
        _ocrAll?.Dispose();
    }
}
