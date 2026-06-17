using Microsoft.EntityFrameworkCore;
using ParkingSystem.Application.DTOs.CheckOut;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Application.Interfaces.Lpr;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

public class CheckOutService : ICheckOutService
{
    private readonly ApplicationDbContext _context;
    private readonly ILicensePlateRecognizer _lprService;

    public CheckOutService(ApplicationDbContext context, ILicensePlateRecognizer lprService)
    {
        _context = context;
        _lprService = lprService;
    }

    public async Task<CheckOutSearchResult> SearchByLicensePlateAsync(string licensePlate)
    {
        var cleanedInput = CleanLicensePlate(licensePlate);

        var activeSessions = await _context.ParkingSessions
            .Include(s => s.ParkingSlot)
                .ThenInclude(ps => ps.Floor)
            .Include(s => s.VehicleType)
            .Where(s => s.Status == SessionStatus.Active)
            .ToListAsync();

        var session = activeSessions
            .FirstOrDefault(s => CleanLicensePlate(s.LicensePlate) == cleanedInput);

        if (session == null)
        {
            throw new InvalidOperationException(
                $"Khong tim thay phien gui xe dang hoat dong cho bien so: {cleanedInput}.");
        }

        var exitTime = DateTime.UtcNow;
        var priceResult = await CalculateFeeAsync(session.VehicleTypeId, session.EntryTime, exitTime);

        return new CheckOutSearchResult
        {
            SessionId = session.Id,
            LicensePlate = session.LicensePlate,
            SlotNumber = session.ParkingSlot.SlotNumber,
            FloorName = session.ParkingSlot.Floor?.Name ?? string.Empty,
            EntryTime = session.EntryTime,
            EstimatedExitTime = exitTime,
            TotalHours = priceResult.TotalHours,
            VehicleTypeName = session.VehicleType.Name,
            HourlyRate = priceResult.HourlyRate,
            EstimatedFee = priceResult.TotalFee,
            PricingModel = priceResult.PricingModel,
            DayPassPrice = priceResult.DayPassPrice,
            NightPassPrice = priceResult.NightPassPrice,
            DailyMaxPrice = priceResult.DailyMaxPrice,
            FeeBreakdown = priceResult.FeeBreakdown,
            Message = BuildMessage(session, priceResult)
        };
    }

    public async Task<CheckOutConfirmResponse> ConfirmCheckOutAsync(CheckOutConfirmRequest request)
    {
        var session = await _context.ParkingSessions
            .Include(s => s.ParkingSlot)
                .ThenInclude(ps => ps.Floor)
            .Include(s => s.VehicleType)
            .FirstOrDefaultAsync(s => s.Id == request.SessionId && s.Status == SessionStatus.Active);

        if (session == null)
        {
            throw new InvalidOperationException("Khong tim thay phien gui xe hoac xe da thanh toan.");
        }

        var exitTime = DateTime.UtcNow;
        var priceResult = await CalculateFeeAsync(session.VehicleTypeId, session.EntryTime, exitTime);

        if (request.PaymentMethod == PaymentMethod.Cash && request.PaymentAmount.HasValue)
        {
            if (request.PaymentAmount.Value < priceResult.TotalFee)
            {
                throw new InvalidOperationException(
                    $"So tien khach dua ({request.PaymentAmount.Value:N0} VND) nho hon phi gui xe ({priceResult.TotalFee:N0} VND).");
            }
        }

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            PayOSOrderCode = GeneratePayOSOrderCode(),
            ParkingSessionId = session.Id,
            Amount = priceResult.TotalFee,
            Description = $"Thanh toan phi gui xe cho bien so {session.LicensePlate}",
            PaymentDate = exitTime,
            PaymentMethod = request.PaymentMethod,
            Status = PaymentStatus.Success,
            CreatedAt = exitTime
        };

        session.ExitTime = exitTime;
        session.TotalFee = priceResult.TotalFee;
        session.Status = SessionStatus.Completed;
        session.UpdatedAt = exitTime;

        var slot = session.ParkingSlot;
        slot.Status = SlotStatus.Available;
        slot.UpdatedAt = exitTime;

        _context.Payments.Add(payment);
        await _context.SaveChangesAsync();

        decimal? changeAmount = null;
        if (request.PaymentMethod == PaymentMethod.Cash && request.PaymentAmount.HasValue)
        {
            changeAmount = request.PaymentAmount.Value - priceResult.TotalFee;
        }

        return new CheckOutConfirmResponse
        {
            SessionId = session.Id,
            LicensePlate = session.LicensePlate,
            SlotNumber = slot.SlotNumber,
            FloorName = slot.Floor?.Name ?? string.Empty,
            EntryTime = session.EntryTime,
            ExitTime = exitTime,
            TotalHours = priceResult.TotalHours,
            HourlyRate = priceResult.HourlyRate,
            TotalFee = priceResult.TotalFee,
            PricingModel = priceResult.PricingModel,
            DayPassPrice = priceResult.DayPassPrice,
            NightPassPrice = priceResult.NightPassPrice,
            DailyMaxPrice = priceResult.DailyMaxPrice,
            FeeBreakdown = priceResult.FeeBreakdown,
            PaymentAmount = request.PaymentAmount,
            ChangeAmount = changeAmount,
            PaymentMethod = request.PaymentMethod,
            PaymentId = payment.Id,
            Message = BuildMessage(session, priceResult, isConfirm: true)
        };
    }

    public async Task<OcrCheckOutResult> ProcessOcrCheckOutAsync(OcrCheckOutRequest request)
    {
        var ocrResult = await _lprService.RecognizeFrameAsync(request.ImageBase64);

        if (!ocrResult.IsDetected || string.IsNullOrWhiteSpace(ocrResult.LicensePlate))
        {
            throw new InvalidOperationException("Khong the nhan dien duoc bien so xe. Vui long chup anh ro hon va thu lai.");
        }

        var exitPlate = ocrResult.LicensePlate.Trim();
        var normalizedExitPlate = CleanLicensePlate(exitPlate);

        var activeSessions = await _context.ParkingSessions
            .Include(s => s.ParkingSlot)
                .ThenInclude(ps => ps.Floor)
            .Include(s => s.VehicleType)
            .Where(s => s.Status == SessionStatus.Active)
            .ToListAsync();

        var session = activeSessions
            .FirstOrDefault(s => CleanLicensePlate(s.LicensePlate) == normalizedExitPlate);

        if (session == null)
        {
            throw new InvalidOperationException(
                $"Khong tim thay phien gui xe dang hoat dong cho bien so: {exitPlate}.");
        }

        var normalizedEntryPlate = CleanLicensePlate(session.LicensePlate);
        var isMatch = normalizedEntryPlate == normalizedExitPlate;

        var exitTime = DateTime.UtcNow;
        var priceResult = await CalculateFeeAsync(session.VehicleTypeId, session.EntryTime, exitTime);

        var matchStatus = isMatch ? "KHỚP" : "KHÔNG KHỚP";
        var warningMsg = isMatch
            ? ""
            : $" Canh bao: Bien so luc ra ({exitPlate}) khong khop voi bien so luc vao ({session.LicensePlate}).";

        return new OcrCheckOutResult
        {
            SessionId = session.Id,
            EntryLicensePlate = session.LicensePlate,
            ExitLicensePlate = exitPlate,
            IsMatch = isMatch,
            MatchStatus = matchStatus,
            SlotNumber = session.ParkingSlot.SlotNumber,
            FloorName = session.ParkingSlot.Floor?.Name ?? string.Empty,
            EntryTime = session.EntryTime,
            EstimatedExitTime = exitTime,
            TotalHours = priceResult.TotalHours,
            VehicleTypeName = session.VehicleType.Name,
            HourlyRate = priceResult.HourlyRate,
            EstimatedFee = priceResult.TotalFee,
            PricingModel = priceResult.PricingModel,
            DayPassPrice = priceResult.DayPassPrice,
            NightPassPrice = priceResult.NightPassPrice,
            DailyMaxPrice = priceResult.DailyMaxPrice,
            FeeBreakdown = priceResult.FeeBreakdown,
            OcrConfidence = ocrResult.Confidence,
            Message = $"Trang thai bien so: {matchStatus}. Tim thay xe bien so {session.LicensePlate} " +
                      $"dang do tai o {session.ParkingSlot.SlotNumber}, tang {session.ParkingSlot.Floor?.Name ?? ""}. " +
                      BuildFeeMessage(priceResult) + warningMsg
        };
    }

    private async Task<PriceCalculationResult> CalculateFeeAsync(Guid vehicleTypeId, DateTime entryTime, DateTime exitTime)
    {
        var priceSetting = await _context.PriceSettings
            .FirstOrDefaultAsync(p => p.VehicleTypeId == vehicleTypeId);

        var pricingPolicy = await _context.PricingPolicies
            .FirstOrDefaultAsync(p => p.VehicleTypeId == vehicleTypeId);

        if (priceSetting != null)
        {
            return CalculateDayNightFee(priceSetting, entryTime, exitTime);
        }

        if (pricingPolicy != null)
        {
            // Bỏ qua phần giây lẻ (Floor) để tránh lỗi làm tròn sai (VD: 120 phút 5 giây bị tính thành 3 tiếng)
            var totalMinutes = Math.Floor((exitTime - entryTime).TotalMinutes);
            var totalHours = totalMinutes / 60.0;
            decimal totalFee = 0;
            
            if (pricingPolicy.DailyMaxRate > 0)
            {
                int full24hDays = (int)Math.Floor(totalHours / 24);
                decimal base24hFee = full24hDays * pricingPolicy.DailyMaxRate;
                
                var remainingMinutes = totalMinutes - (full24hDays * 24 * 60);
                decimal remainderFee = 0;
                
                if (remainingMinutes > 0)
                {
                    if (pricingPolicy.BlockMinutes > 0 && remainingMinutes <= pricingPolicy.BlockMinutes)
                    {
                        remainderFee = pricingPolicy.BlockPrice;
                    }
                    else
                    {
                        var extraMinutes = remainingMinutes;
                        if (pricingPolicy.BlockMinutes > 0)
                        {
                            remainderFee = pricingPolicy.BlockPrice;
                            extraMinutes -= pricingPolicy.BlockMinutes;
                        }
                        
                        var extraHours = Math.Ceiling(extraMinutes / 60.0);
                        remainderFee += (decimal)extraHours * pricingPolicy.HourlyRate;
                    }
                    
                    if (remainderFee > pricingPolicy.DailyMaxRate)
                        remainderFee = pricingPolicy.DailyMaxRate;
                }
                
                totalFee = base24hFee + remainderFee;
            }
            else
            {
                if (totalMinutes > 0)
                {
                    if (pricingPolicy.BlockMinutes > 0 && totalMinutes <= pricingPolicy.BlockMinutes)
                    {
                        totalFee = pricingPolicy.BlockPrice;
                    }
                    else
                    {
                        var extraMinutes = totalMinutes;
                        if (pricingPolicy.BlockMinutes > 0)
                        {
                            totalFee = pricingPolicy.BlockPrice;
                            extraMinutes -= pricingPolicy.BlockMinutes;
                        }
                        
                        var extraHours = Math.Ceiling(extraMinutes / 60.0);
                        totalFee += (decimal)extraHours * pricingPolicy.HourlyRate;
                    }
                }
            }

            return new PriceCalculationResult
            {
                TotalHours = totalHours,
                TotalFee = totalFee,
                PricingModel = "Hourly",
                HourlyRate = pricingPolicy.HourlyRate,
                DayPassPrice = null,
                NightPassPrice = null,
                DailyMaxPrice = pricingPolicy.DailyMaxRate,
                FeeBreakdown = null
            };
        }

        throw new InvalidOperationException("Khong tim thay bang gia cho loai xe nay.");
    }

    private PriceCalculationResult CalculateDayNightFee(PriceSetting setting, DateTime entryTime, DateTime exitTime)
    {
        var dayStart = setting.DayStartHour;
        var nightStart = setting.NightStartHour;

        int dayPassCount = 0;
        int nightPassCount = 0;
        decimal totalFee = 0;
        decimal base24hFee = 0;

        DateTime calculationStart = entryTime;
        int full24hDays = 0;

        // FIX: Tính trần (cap) theo từng block 24h
        if (setting.DailyMaxPrice > 0)
        {
            full24hDays = (int)Math.Floor((exitTime - entryTime).TotalHours / 24);
            base24hFee = full24hDays * setting.DailyMaxPrice;
            calculationStart = entryTime.AddDays(full24hDays);
        }

        DateTime currentTime = calculationStart;
        while (currentTime < exitTime)
        {
            DateTime blockEnd;
            bool isDay;

            // Kiểm tra xem currentTime đang nằm trong block Ngày hay block Đêm
            if (currentTime.TimeOfDay.TotalHours >= dayStart && currentTime.TimeOfDay.TotalHours < nightStart)
            {
                isDay = true;
                // Nếu đang ban ngày, block này sẽ kết thúc khi bắt đầu giờ ban đêm hôm nay
                blockEnd = currentTime.Date.AddHours(nightStart);
            }
            else
            {
                isDay = false;
                if (currentTime.TimeOfDay.TotalHours < dayStart)
                {
                    // Từ nửa đêm đến sáng (VD 0h-6h), block đêm kết thúc vào sáng hôm nay
                    blockEnd = currentTime.Date.AddHours(dayStart);
                }
                else
                {
                    // Từ tối đến khuya (VD 18h-24h), block đêm vắt qua sáng ngày hôm sau
                    blockEnd = currentTime.Date.AddDays(1).AddHours(dayStart);
                }
            }

            if (isDay) dayPassCount++;
            else nightPassCount++;

            currentTime = blockEnd;
        }

        var dayPassTotal = dayPassCount * setting.DayPassPrice;
        var nightPassTotal = nightPassCount * setting.NightPassPrice;
        var remainderFee = dayPassTotal + nightPassTotal;

        // Cắt trần (cap) số tiền dư còn lại
        if (setting.DailyMaxPrice > 0 && remainderFee > setting.DailyMaxPrice)
        {
            remainderFee = setting.DailyMaxPrice;
        }

        totalFee = base24hFee + remainderFee;
        var totalHours = (exitTime - entryTime).TotalHours;

        return new PriceCalculationResult
        {
            TotalHours = totalHours,
            TotalFee = totalFee,
            PricingModel = "DayNight",
            HourlyRate = 0,
            DayPassPrice = setting.DayPassPrice,
            NightPassPrice = setting.NightPassPrice,
            DailyMaxPrice = setting.DailyMaxPrice,
            FeeBreakdown = new FeeBreakdownDto
            {
                DayPassCount = dayPassCount,
                NightPassCount = nightPassCount,
                DayPassTotal = dayPassTotal,
                NightPassTotal = nightPassTotal,
                TotalFee = totalFee
            }
        };
    }

    private static string BuildMessage(ParkingSession session, PriceCalculationResult result, bool isConfirm = false)
    {
        var feeMsg = BuildFeeMessage(result);
        if (isConfirm)
            return $"Thanh toan thanh cong! Xe bien so {session.LicensePlate} da ra bai. {feeMsg} Cam on quy khach!";
        return $"Tim thay xe bien so {session.LicensePlate} dang do tai o {session.ParkingSlot.SlotNumber}, " +
               $"tang {session.ParkingSlot.Floor?.Name ?? ""}. {feeMsg}";
    }

    private static string BuildFeeMessage(PriceCalculationResult result)
    {
        if (result.PricingModel == "DayNight" && result.FeeBreakdown != null)
        {
            return $"Gui ngay x{result.FeeBreakdown.DayPassCount} = {result.FeeBreakdown.DayPassTotal:N0} VND, " +
                   $"gui dem x{result.FeeBreakdown.NightPassCount} = {result.FeeBreakdown.NightPassTotal:N0} VND. " +
                   $"Tong phi: {result.TotalFee:N0} VND.";
        }
        return $"Thoi gian gui: {result.TotalHours:F2} gio. Phi uoc tinh: {result.TotalFee:N0} VND.";
    }

    private static string CleanLicensePlate(string licensePlate)
    {
        if (string.IsNullOrWhiteSpace(licensePlate)) return string.Empty;
        return licensePlate.Trim().ToUpperInvariant().Replace(".", "").Replace("-", "").Replace(" ", "");
    }

    private static long GeneratePayOSOrderCode()
    {
        return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    private class PriceCalculationResult
    {
        public double TotalHours { get; set; }
        public decimal TotalFee { get; set; }
        public string PricingModel { get; set; } = "Hourly";
        public decimal HourlyRate { get; set; }
        public decimal? DayPassPrice { get; set; }
        public decimal? NightPassPrice { get; set; }
        public decimal? DailyMaxPrice { get; set; }
        public FeeBreakdownDto? FeeBreakdown { get; set; }
    }
}
