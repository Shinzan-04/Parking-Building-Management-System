namespace ParkingSystem.Application.Interfaces.Lpr;

public class LprResult
{
    public bool IsDetected { get; set; }
    public string LicensePlate { get; set; } = string.Empty;
    public string RawOcrText { get; set; } = string.Empty;
    public float Confidence { get; set; }
    
    /// <summary>
    /// True nếu AI có độ tự tin thấp, cần Staff tự kiểm tra lại biển số bằng mắt
    /// </summary>
    public bool NeedManualReview { get; set; }
    
    public string Message { get; set; } = string.Empty;
    public string CroppedPlateBase64 { get; set; } = string.Empty;
}

public class DetectionBox
{
    public float X1 { get; set; }
    public float Y1 { get; set; }
    public float X2 { get; set; }
    public float Y2 { get; set; }
    public float Confidence { get; set; }
}
