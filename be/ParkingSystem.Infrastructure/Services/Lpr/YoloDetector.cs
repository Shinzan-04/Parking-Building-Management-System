using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using ParkingSystem.Application.Interfaces.Lpr;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace ParkingSystem.Infrastructure.Services.Lpr;

public class YoloDetector : IYoloDetector, IDisposable
{
    private readonly InferenceSession _session;
    private const int ModelInputSize = 640;

    public YoloDetector(string modelPath)
    {
        if (!File.Exists(modelPath))
            throw new FileNotFoundException($"Không tìm thấy model ONNX tại: {modelPath}");

        var options = new SessionOptions();
        options.GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL;
        _session = new InferenceSession(modelPath, options);
    }

    public async Task<DetectionBox?> DetectBestPlateAsync(string base64Image)
    {
        var imageBytes = Convert.FromBase64String(base64Image);
        using var image = Image.Load<Rgb24>(imageBytes);

        int originalWidth = image.Width;
        int originalHeight = image.Height;

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

        return await Task.Run(() =>
        {
            using var results = _session.Run(inputs);
            var output = results.First().AsTensor<float>();

            var detections = ParseYoloOutput(output, originalWidth, originalHeight);

            if (detections.Count == 0) return null;

            return detections.OrderByDescending(d => d.Confidence).First();
        });
    }

    private List<DetectionBox> ParseYoloOutput(Tensor<float> output, int originalWidth, int originalHeight)
    {
        var detections = new List<DetectionBox>();
        var dimensions = output.Dimensions;

        int numAttributes = dimensions[1];
        int numDetections = dimensions[2];
        int numClasses = numAttributes - 4;

        float scaleX = (float)originalWidth / ModelInputSize;
        float scaleY = (float)originalHeight / ModelInputSize;

        for (int i = 0; i < numDetections; i++)
        {
            float maxScore = 0;
            for (int c = 0; c < numClasses; c++)
            {
                float score = output[0, 4 + c, i];
                if (score > maxScore)
                {
                    maxScore = score;
                }
            }

            if (maxScore > 0.25f)
            {
                float cx = output[0, 0, i];
                float cy = output[0, 1, i];
                float w = output[0, 2, i];
                float h = output[0, 3, i];

                float x1 = (cx - w / 2) * scaleX;
                float y1 = (cy - h / 2) * scaleY;
                float x2 = (cx + w / 2) * scaleX;
                float y2 = (cy + h / 2) * scaleY;

                detections.Add(new DetectionBox
                {
                    X1 = x1,
                    Y1 = y1,
                    X2 = x2,
                    Y2 = y2,
                    Confidence = maxScore
                });
            }
        }

        return Nms(detections, 0.45f);
    }

    private List<DetectionBox> Nms(List<DetectionBox> detections, float iouThreshold)
    {
        var result = new List<DetectionBox>();
        detections = detections.OrderByDescending(d => d.Confidence).ToList();

        while (detections.Count > 0)
        {
            var best = detections[0];
            result.Add(best);
            detections.RemoveAt(0);

            for (int i = detections.Count - 1; i >= 0; i--)
            {
                var d = detections[i];
                float iou = ComputeIou(best, d);
                if (iou > iouThreshold)
                {
                    detections.RemoveAt(i);
                }
            }
        }

        return result;
    }

    private float ComputeIou(DetectionBox box1, DetectionBox box2)
    {
        float x1 = Math.Max(box1.X1, box2.X1);
        float y1 = Math.Max(box1.Y1, box2.Y1);
        float x2 = Math.Min(box1.X2, box2.X2);
        float y2 = Math.Min(box1.Y2, box2.Y2);

        float intersectionArea = Math.Max(0, x2 - x1) * Math.Max(0, y2 - y1);
        float box1Area = (box1.X2 - box1.X1) * (box1.Y2 - box1.Y1);
        float box2Area = (box2.X2 - box2.X1) * (box2.Y2 - box2.Y1);
        float unionArea = box1Area + box2Area - intersectionArea;

        return unionArea == 0 ? 0 : intersectionArea / unionArea;
    }

    public void Dispose()
    {
        _session?.Dispose();
    }
}
