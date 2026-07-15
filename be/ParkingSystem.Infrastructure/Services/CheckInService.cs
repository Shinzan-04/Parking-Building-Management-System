using Microsoft.EntityFrameworkCore;
using ParkingSystem.Application.DTOs.CheckIn;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

public class CheckInService : ICheckInService
{
    private readonly ApplicationDbContext _context;
    private readonly IQrCodeService _qrCodeService;
    private readonly ISlotAssignmentService _slotAssignmentService;
    private readonly IImageUploadService _imageUploadService;
    private readonly ITokenService _tokenService;
    private readonly IRealtimeService _realtimeService;

    public CheckInService(
        ApplicationDbContext context,
        IQrCodeService qrCodeService,
        ISlotAssignmentService slotAssignmentService,
        IImageUploadService imageUploadService,
        ITokenService tokenService,
        IRealtimeService realtimeService)
    {
        _context = context;
        _qrCodeService = qrCodeService;
        _slotAssignmentService = slotAssignmentService;
        _imageUploadService = imageUploadService;
        _tokenService = tokenService;
        _realtimeService = realtimeService;
    }

    /// <summary>
    /// NHÁNH 1: Check-in với Booking QR Code
    /// Bước 1: Quét mã QR → lấy BookingCode → tìm Reservation
    /// Bước 2: Đối chiếu biển số OCR với biển số trong Booking
    /// Bước 3: Nếu khớp → tạo Session, cập nhật trạng thái
    /// </summary>
    public async Task<object> CheckInWithBookingAsync(CheckInBookingRequest request)
    {
        // Tìm Reservation theo BookingCode
        var reservation = await _context.Reservations
            .Include(r => r.ParkingSlot)
                .ThenInclude(s => s.Floor)
                    .ThenInclude(f => f.Building)
            .Include(r => r.VehicleType)
            .FirstOrDefaultAsync(r => r.BookingCode == request.BookingCode
                                   && r.Status == ReservationStatus.Confirmed);

        if (reservation == null)
            throw new InvalidOperationException("Invalid booking code or not confirmed.");

        // Kiểm tra thời gian booking có hợp lệ không
        var now = DateTime.UtcNow;
        if (now > reservation.EndTime)
            throw new InvalidOperationException("Booking has expired.");

        // Đối chiếu biển số OCR với biển số đăng ký trong Booking
        if (!string.Equals(request.LicensePlateOcr.Trim(), reservation.LicensePlate.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            // Biển số KHÔNG khớp → trả về cảnh báo, yêu cầu Staff xác nhận
            return new CheckInMismatchResponse
            {
                ReservationId = reservation.Id,
                BookingLicensePlate = reservation.LicensePlate,
                OcrLicensePlate = request.LicensePlateOcr,
                Message = "Biển số xe thực tế không khớp với biển số đăng ký. Cần nhân viên xác nhận.",
                RequiresStaffConfirmation = true
            };
        }

        // Biển số KHỚP → Tiến hành check-in
        return await ProcessBookingCheckIn(reservation, reservation.LicensePlate, request.StaffId, request.EntryImageBase64);
    }

    /// <summary>
    /// NHÁNH 1B: Check-in bằng QR Driver cố định
    /// Bước 1: Parse JWT từ QR → lấy DriverId
    /// Bước 2: Tìm Reservation Confirmed của Driver đó
    /// Bước 3: Đối chiếu biển số OCR → nếu khớp → check-in
    /// </summary>
    public async Task<object> CheckInWithDriverQrAsync(CheckInDriverQrRequest request)
    {
        // 1. Parse JWT từ QR Driver
        var parsed = _tokenService.ParseDriverQrToken(request.DriverQrToken);
        if (parsed == null)
            throw new InvalidOperationException("Invalid or tampered QR code.");

        var (driverId, driverCode) = parsed.Value;

        // 2. Tìm tất cả Reservation Confirmed của Driver này
        var now = DateTime.UtcNow;
        var confirmedReservations = await _context.Reservations
            .Include(r => r.ParkingSlot)
                .ThenInclude(s => s.Floor)
                    .ThenInclude(f => f.Building)
            .Include(r => r.VehicleType)
            .Where(r => r.DriverId == driverId
                     && r.Status == ReservationStatus.Confirmed
                     && now <= r.EndTime)
            .OrderBy(r => r.StartTime)
            .ToListAsync();

        if (!confirmedReservations.Any())
            throw new InvalidOperationException($"No pending reservations found for driver {driverCode}.");

        // 3. Tìm reservation khớp với biển số OCR
        var ocrPlate = request.LicensePlateOcr.Trim();
        var matchedReservation = confirmedReservations
            .FirstOrDefault(r => string.Equals(r.LicensePlate.Trim(), ocrPlate, StringComparison.OrdinalIgnoreCase));

        if (matchedReservation != null)
        {
            // Biển số KHỚP → check-in tự động
            return await ProcessBookingCheckIn(matchedReservation, matchedReservation.LicensePlate, request.StaffId, request.EntryImageBase64);
        }

        // 4. Biển số KHÔNG KHỚP → kiểm tra xem có reservation nào gần giờ nhất không
        var closestReservation = confirmedReservations.First();

        return new CheckInMismatchResponse
        {
            ReservationId = closestReservation.Id,
            BookingLicensePlate = closestReservation.LicensePlate,
            OcrLicensePlate = ocrPlate,
            Message = $"Biển số OCR ({ocrPlate}) không khớp với booking ({closestReservation.LicensePlate}). " +
                      $"Tài xế: {driverCode}. Cần nhân viên xác nhận.",
            RequiresStaffConfirmation = true
        };
    }

    /// <summary>
    /// Staff xác nhận override khi biển số lệch
    /// </summary>
    public async Task<CheckInResponse> StaffOverrideCheckInAsync(StaffOverrideRequest request)
    {
        var reservation = await _context.Reservations
            .Include(r => r.ParkingSlot)
                .ThenInclude(s => s.Floor)
                    .ThenInclude(f => f.Building)
            .Include(r => r.VehicleType)
            .FirstOrDefaultAsync(r => r.Id == request.ReservationId
                                   && r.Status == ReservationStatus.Confirmed);

        if (reservation == null)
            throw new InvalidOperationException("Reservation does not exist or is invalid.");

        // Staff cho phép → check-in với biển số thực tế và lưu lại ảnh
        return await ProcessBookingCheckIn(reservation, request.ActualLicensePlate, request.StaffId, request.EntryImageBase64);
    }

    /// <summary>
    /// NHÁNH 2: Check-in trực tiếp (Walk-in)
    /// - Nếu request.SlotId != null → Staff chọn thủ công
    /// - Nếu request.SlotId == null → AI tự động chọn slot tốt nhất
    /// - Nếu request.BuildingId != null → AI chỉ tìm trong tòa nhà đó
    /// </summary>
    public async Task<CheckInResponse> CheckInWalkInAsync(CheckInWalkInRequest request)
    {
        // 1. SMART CHECK-IN: Kiểm tra xem biển số này có Booking hợp lệ đang chờ không?
        var now = DateTime.UtcNow;
        var searchPlate = request.LicensePlate.Trim().ToLower();
        var validStatuses = new[] { ReservationStatus.Confirmed, ReservationStatus.Paid };
        var validReservation = await _context.Reservations
            .Include(r => r.ParkingSlot)
                .ThenInclude(s => s.Floor)
                    .ThenInclude(f => f.Building)
            .Include(r => r.VehicleType)
            .FirstOrDefaultAsync(r => r.LicensePlate.ToLower() == searchPlate
                                   && validStatuses.Contains(r.Status)
                                   && now >= r.StartTime.AddMinutes(-30)
                                   && now <= r.EndTime);

        if (validReservation != null)
        {
            // Tự động chuyển hướng sang luồng Check-in bằng Booking!
            return await ProcessBookingCheckIn(validReservation, request.LicensePlate, request.StaffId, request.EntryImageBase64);
        }

        // 2. KHÁCH VÃNG LAI: Nếu không có Booking thì chạy logic Walk-in bình thường
        // Kiểm tra loại xe có tồn tại không
        var vehicleType = await _context.VehicleTypes.FindAsync(request.VehicleTypeId);
        if (vehicleType == null)
            throw new InvalidOperationException("Invalid vehicle type.");

        // Kiểm tra xe đã đang gửi trong bãi chưa (trùng biển số + đang Active)
        var existingSession = await _context.ParkingSessions
            .AnyAsync(s => s.LicensePlate == request.LicensePlate && s.Status == SessionStatus.Active);
        if (existingSession)
            throw new InvalidOperationException($"Vehicle with license plate {request.LicensePlate} already has an active session.");

        // TỰ ĐỘNG LẤY TỪ STAFF NẾU CÓ
        Guid? effectiveBuildingId = request.BuildingId;
        if (!effectiveBuildingId.HasValue && request.StaffId.HasValue)
        {
            var staff = await _context.Users.FindAsync(request.StaffId.Value);
            if (staff != null && staff.AssignedBuildingId.HasValue)
            {
                effectiveBuildingId = staff.AssignedBuildingId;
            }
        }

        // Validate BuildingId nếu có
        if (effectiveBuildingId.HasValue)
        {
            var buildingExists = await _context.Buildings.AnyAsync(b => b.Id == effectiveBuildingId.Value && !b.IsDeleted);
            if (!buildingExists)
                throw new InvalidOperationException("Building does not exist.");
        }

        ParkingSlot? assignedSlot;
        bool isAIAssigned;
        double? slotScore = null;
        string? slotReason = null;

        if (request.SlotId.HasValue)
        {
            // ===== STAFF CHỌN THỦ CÔNG =====
            assignedSlot = await _context.ParkingSlots
                .Include(s => s.Floor)
                    .ThenInclude(f => f.Building)
                .FirstOrDefaultAsync(s => s.Id == request.SlotId.Value
                                       && s.VehicleTypeId == request.VehicleTypeId
                                       && s.Status == SlotStatus.Available);

            if (assignedSlot == null)
                throw new InvalidOperationException("Parking slot is unavailable or unsuitable for this vehicle type.");

            // Validate: Slot phải thuộc tòa nhà đã chọn (nếu có)
            if (request.BuildingId.HasValue && assignedSlot.Floor.BuildingId != request.BuildingId.Value)
                throw new InvalidOperationException("Parking slot does not belong to the selected building.");

            isAIAssigned = false;
        }
        else
        {
            // ===== AI TỰ ĐỘNG GÁN SLOT =====
            // Truyền BuildingId để giới hạn phạm vi tìm kiếm
            var bestSlot = await _slotAssignmentService.GetBestSlotAsync(request.VehicleTypeId, effectiveBuildingId);

            if (bestSlot == null)
            {
                var scope = effectiveBuildingId.HasValue ? " trong tòa nhà này" : "";
                throw new InvalidOperationException($"No available slots for vehicle type {vehicleType.Name}{scope}.");
            }

            assignedSlot = await _context.ParkingSlots
                .Include(s => s.Floor)
                    .ThenInclude(f => f.Building)
                .FirstOrDefaultAsync(s => s.Id == bestSlot.SlotId);

            if (assignedSlot == null)
                throw new InvalidOperationException("System error: Suggested slot not found.");

            isAIAssigned = true;
            slotScore = bestSlot.Score;
            slotReason = bestSlot.Reason;
        }

        // Lưu ảnh biển số (nếu có) → trả về URL
        string? entryImageUrl = await SaveEntryImageAsync(request.EntryImageBase64, request.LicensePlate);

        // Sinh mã QR cho phiên gửi xe (Session Code)
        var sessionCode = _qrCodeService.GenerateUniqueCode(5);

        // Lấy PricingPolicy (Ưu tiên Active, nếu không có thì lấy cái mới nhất)
        var activePolicy = await _context.PricingPolicies
            .Where(p => p.VehicleTypeId == request.VehicleTypeId)
            .OrderByDescending(p => p.IsActive)
            .ThenByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync();
        
        // Tạo Parking Session mới
        var session = new ParkingSession
        {
            Id = Guid.NewGuid(),
            DriverId = null, // Khách vãng lai không có tài khoản
            StaffId = request.StaffId,
            ParkingSlotId = assignedSlot.Id,
            VehicleTypeId = request.VehicleTypeId,
            LicensePlate = request.LicensePlate,
            SessionCode = sessionCode,
            CheckInMethod = CheckInMethod.WalkIn,
            EntryTime = DateTime.UtcNow,
            EntryImageUrl = entryImageUrl,
            Status = SessionStatus.Active,
            PricingPolicyId = activePolicy?.Id
        };

        // Cập nhật trạng thái Slot → Occupied
        assignedSlot.Status = SlotStatus.Occupied;
        assignedSlot.UpdatedAt = DateTime.UtcNow;

        _context.ParkingSessions.Add(session);
        await _context.SaveChangesAsync();
        await _realtimeService.SendDashboardUpdateAsync();
        await _realtimeService.SendSlotStatusUpdateAsync(assignedSlot.Id, assignedSlot.Status.ToString());
        if (session.DriverId.HasValue)
        {
            await _realtimeService.SendNotificationAsync(session.DriverId.Value, "SESSION_STARTED");
        }

        // Sinh ảnh QR Code Base64 (để in vé giấy)
        var qrImageBase64 = _qrCodeService.GenerateQrCodeBase64(sessionCode);

        var buildingName = assignedSlot.Floor?.Building?.Name ?? "";
        var floorName = assignedSlot.Floor?.Name ?? "";

        return new CheckInResponse
        {
            SessionId = session.Id,
            SessionCode = sessionCode,
            SessionQrCodeBase64 = qrImageBase64,
            LicensePlate = request.LicensePlate,
            CheckInMethod = CheckInMethod.WalkIn,
            SlotNumber = assignedSlot.SlotNumber,
            FloorName = floorName,
            BuildingName = buildingName,
            VehicleTypeName = vehicleType.Name,
            IsAIAssigned = isAIAssigned,
            SlotScore = slotScore,
            SlotReason = slotReason,
            EntryImageUrl = entryImageUrl,
            EntryTime = session.EntryTime,
            Message = isAIAssigned
                ? $"Check-in thành công (AI gợi ý). Vui lòng đỗ xe tại ô {assignedSlot.SlotNumber}, tầng {floorName}, tòa {buildingName}."
                : $"Check-in thành công (Staff chọn). Vui lòng đỗ xe tại ô {assignedSlot.SlotNumber}, tầng {floorName}, tòa {buildingName}."
        };
    }

    /// <summary>
    /// Xử lý check-in cho luồng Booking (dùng chung cho cả khớp biển số và staff override)
    /// </summary>
    private async Task<CheckInResponse> ProcessBookingCheckIn(Reservation reservation, string licensePlate, Guid? staffId, string? entryImageBase64)
    {
        var sessionCode = _qrCodeService.GenerateUniqueCode(5);

        // Lưu ảnh biển số
        string? entryImageUrl = await SaveEntryImageAsync(entryImageBase64, licensePlate);

        // Xử lý khách đến sớm: Dịch chuyển StartTime và EndTime
        var now = DateTime.UtcNow;
        if (now < reservation.StartTime)
        {
            var slotStatus = reservation.ParkingSlot.Status;
            if (slotStatus == SlotStatus.Occupied || slotStatus == SlotStatus.TemporaryHeld || slotStatus == SlotStatus.Maintenance)
            {
                throw new InvalidOperationException($"You arrived early, but slot {reservation.ParkingSlot.SlotNumber} is currently occupied or under maintenance. Please contact staff to change slot.");
            }

            var earlyAmount = reservation.StartTime - now;
            reservation.StartTime = now;
            reservation.EndTime = reservation.EndTime.Subtract(earlyAmount);
        }

        // 4. Lấy PricingPolicy (Ưu tiên Active, nếu không có thì lấy cái mới nhất)
        var policy = await _context.PricingPolicies
            .Where(p => p.VehicleTypeId == reservation.VehicleTypeId)
            .OrderByDescending(p => p.IsActive)
            .ThenByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync();

        // Tạo Parking Session liên kết với Reservation
        var session = new ParkingSession
        {
            Id = Guid.NewGuid(),
            DriverId = reservation.DriverId,
            StaffId = staffId,
            ParkingSlotId = reservation.ParkingSlotId,
            VehicleTypeId = reservation.VehicleTypeId,
            ReservationId = reservation.Id,
            LicensePlate = licensePlate,
            SessionCode = sessionCode,
            CheckInMethod = CheckInMethod.Booking,
            EntryTime = now,
            EntryImageUrl = entryImageUrl,
            Status = SessionStatus.Active,
            PricingPolicyId = reservation.PricingPolicyId ?? policy?.Id
        };

        // Cập nhật trạng thái Reservation → CheckedIn
        reservation.Status = ReservationStatus.CheckedIn;
        reservation.UpdatedAt = now;

        // Cập nhật trạng thái Slot: Reserved → Occupied
        var slot = reservation.ParkingSlot;
        slot.Status = SlotStatus.Occupied;
        slot.UpdatedAt = DateTime.UtcNow;

        _context.ParkingSessions.Add(session);

        _context.ReservationLogs.Add(new ReservationLog
        {
            Id = Guid.NewGuid(),
            ReservationId = reservation.Id,
            Action = "CheckIn",
            StatusSnapshot = reservation.Status,
            Note = "Tài xế đã vào bãi thành công",
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        await _realtimeService.SendDashboardUpdateAsync();
        await _realtimeService.SendSlotStatusUpdateAsync(slot.Id, slot.Status.ToString());
        if (session.DriverId.HasValue)
        {
            await _realtimeService.SendNotificationAsync(session.DriverId.Value, "SESSION_STARTED");
        }

        var qrImageBase64 = _qrCodeService.GenerateQrCodeBase64(sessionCode);

        var buildingName = slot.Floor?.Building?.Name ?? "";
        var floorName = slot.Floor?.Name ?? "";

        return new CheckInResponse
        {
            SessionId = session.Id,
            SessionCode = sessionCode,
            SessionQrCodeBase64 = qrImageBase64,
            LicensePlate = licensePlate,
            CheckInMethod = CheckInMethod.Booking,
            BookingCode = reservation.BookingCode,
            SlotNumber = slot.SlotNumber,
            FloorName = floorName,
            BuildingName = buildingName,
            VehicleTypeName = reservation.VehicleType?.Name ?? "",
            EntryImageUrl = entryImageUrl,
            EntryTime = session.EntryTime,
            Message = $"Check-in thành công (Đặt trước). Vui lòng đỗ xe tại ô {slot.SlotNumber}, tầng {floorName}, tòa {buildingName}."
        };
    }

    /// <summary>
    /// ★ API CHÍNH THỨC THEO RULE 1 (Vehicle Check-in Flow) ★
    /// Luồng xử lý:
    ///   1. Nhận biển số từ Camera OCR + Loại xe
    ///   2. [THỪA THEO RULE] Tìm Reservation đang Confirmed/Paid (Nằm ngoài phạm vi dự án)
    ///   3. [THỪA THEO RULE] Check-in theo luồng Booking
    ///   4. TÌM PARKING SLOT PHÙ HỢP ĐANG AVAILABLE -> CHUYỂN OCCUPIED -> TẠO SESSION ACTIVE (Walk-in)
    /// </summary>
    public async Task<CheckInResponse> SmartCheckInAsync(SmartCheckInRequest request)
    {
        var now = DateTime.UtcNow;
        var searchPlate = request.LicensePlate.Trim();

        // ── BƯỚC 1: Kiểm tra xe đã đang gửi trong bãi chưa ──
        var existingSession = await _context.ParkingSessions
            .AnyAsync(s => s.LicensePlate == searchPlate && s.Status == SessionStatus.Active);
        if (existingSession)
            throw new InvalidOperationException($"Vehicle with license plate {searchPlate} already has an active session.");

        // ── BƯỚC 2: Tìm Booking hợp lệ [THỪA THEO RULE - TÍNH NĂNG BOOKING KHÔNG NẰM TRONG 3 FLOW CƠ BẢN] ──
        var validStatuses = new[] { ReservationStatus.Confirmed, ReservationStatus.Paid };
        var validReservation = await _context.Reservations
            .Include(r => r.ParkingSlot)
                .ThenInclude(s => s.Floor)
                    .ThenInclude(f => f.Building)
            .Include(r => r.VehicleType)
            .FirstOrDefaultAsync(r => r.LicensePlate.ToLower() == searchPlate.ToLower()
                                   && validStatuses.Contains(r.Status)
                                   && now <= r.EndTime);

        if (validReservation != null)
        {
            // ★ CÓ BOOKING → Check-in theo Booking [THỪA THEO RULE] ★
            return await ProcessBookingCheckIn(
                validReservation,
                searchPlate,
                request.StaffId,
                request.EntryImageBase64
            );
        }

        // ── BƯỚC 3: KHÔNG CÓ BOOKING → Walk-in ──
        var vehicleType = await _context.VehicleTypes.FindAsync(request.VehicleTypeId);
        if (vehicleType == null)
            throw new InvalidOperationException("Invalid vehicle type.");

        // Tự động lấy BuildingId từ Staff để giới hạn phạm vi tìm slot
        Guid? effectiveBuildingId = null;
        if (request.StaffId.HasValue)
        {
            var staff = await _context.Users.FindAsync(request.StaffId.Value);
            if (staff != null && staff.AssignedBuildingId.HasValue)
                effectiveBuildingId = staff.AssignedBuildingId;
        }

        ParkingSlot? assignedSlot = null;
        double? slotScore = null;
        string? slotReason = null;

        if (request.SlotId.HasValue)
        {
            // ===== STAFF CHỌN THỦ CÔNG =====
            assignedSlot = await _context.ParkingSlots
                .Include(s => s.Floor)
                    .ThenInclude(f => f.Building)
                .FirstOrDefaultAsync(s => s.Id == request.SlotId.Value
                                       && s.VehicleTypeId == request.VehicleTypeId
                                       && s.Status == SlotStatus.Available);

            if (assignedSlot == null)
                throw new InvalidOperationException("Parking slot is unavailable or unsuitable for this vehicle type.");

            // Validate: Slot phải thuộc tòa nhà đã chọn (nếu có)
            if (effectiveBuildingId.HasValue && assignedSlot.Floor.BuildingId != effectiveBuildingId.Value)
                throw new InvalidOperationException("Parking slot does not belong to the managed building.");
        }
        else
        {
            // ===== AI TỰ ĐỘNG GÁN SLOT =====
            var bestSlot = await _slotAssignmentService.GetBestSlotAsync(request.VehicleTypeId, effectiveBuildingId);
            if (bestSlot == null)
            {
                var scope = effectiveBuildingId.HasValue ? " trong tòa nhà này" : "";
                throw new InvalidOperationException($"No available slots for vehicle type {vehicleType.Name}{scope}.");
            }

            assignedSlot = await _context.ParkingSlots
                .Include(s => s.Floor)
                    .ThenInclude(f => f.Building)
                .FirstOrDefaultAsync(s => s.Id == bestSlot.SlotId);

            if (assignedSlot == null)
                throw new InvalidOperationException("System error: Suggested slot not found.");

            slotScore = bestSlot.Score;
            slotReason = bestSlot.Reason;
        }

        // Lưu ảnh biển số
        string? entryImageUrl = await SaveEntryImageAsync(request.EntryImageBase64, searchPlate);

        // Sinh mã QR cho phiên gửi xe
        var sessionCode = _qrCodeService.GenerateUniqueCode(5);

        // ── AUTO-LINK DRIVER (Nếu khách có đăng ký xe trong hệ thống) ──
        // Tìm xe đã đăng ký có cùng biển số (so sánh tương đối bằng cách loại bỏ dấu chấm, gạch nối)
        string cleanSearchPlate = searchPlate.Replace("-", "").Replace(".", "").Replace(" ", "").ToLower();
        var registeredVehicle = await _context.Vehicles
            .FirstOrDefaultAsync(v => v.PlateNumber.Replace("-", "").Replace(".", "").Replace(" ", "").ToLower() == cleanSearchPlate 
                                   && v.VehicleTypeId == request.VehicleTypeId);
        
        Guid? matchedDriverId = registeredVehicle?.DriverId;

        // Tạo Parking Session mới (khách vãng lai hoặc khách có tài khoản nhưng check-in bằng camera)
        var session = new ParkingSession
        {
            Id = Guid.NewGuid(),
            DriverId = matchedDriverId,
            StaffId = request.StaffId,
            ParkingSlotId = assignedSlot.Id,
            VehicleTypeId = request.VehicleTypeId,
            LicensePlate = searchPlate,
            SessionCode = sessionCode,
            CheckInMethod = CheckInMethod.WalkIn,
            EntryTime = DateTime.UtcNow,
            EntryImageUrl = entryImageUrl,
            Status = SessionStatus.Active
        };

        // Cập nhật trạng thái Slot → Occupied
        assignedSlot.Status = SlotStatus.Occupied;
        assignedSlot.UpdatedAt = DateTime.UtcNow;

        _context.ParkingSessions.Add(session);
        await _context.SaveChangesAsync();
        await _realtimeService.SendDashboardUpdateAsync();
        await _realtimeService.SendSlotStatusUpdateAsync(assignedSlot.Id, assignedSlot.Status.ToString());
        if (session.DriverId.HasValue)
        {
            await _realtimeService.SendNotificationAsync(session.DriverId.Value, "SESSION_STARTED");
        }

        var qrImageBase64 = _qrCodeService.GenerateQrCodeBase64(sessionCode);
        var buildingName = assignedSlot.Floor?.Building?.Name ?? "";
        var floorName = assignedSlot.Floor?.Name ?? "";

        return new CheckInResponse
        {
            SessionId = session.Id,
            SessionCode = sessionCode,
            SessionQrCodeBase64 = qrImageBase64,
            LicensePlate = searchPlate,
            CheckInMethod = CheckInMethod.WalkIn,
            BookingCode = null, // Khách vãng lai — không có booking
            SlotNumber = assignedSlot.SlotNumber,
            FloorName = floorName,
            BuildingName = buildingName,
            VehicleTypeName = vehicleType.Name,
            IsAIAssigned = !request.SlotId.HasValue,
            SlotScore = slotScore,
            SlotReason = slotReason,
            EntryImageUrl = entryImageUrl,
            EntryTime = session.EntryTime,
            Message = $"Check-in thành công (Khách vãng lai — AI gợi ý). Vui lòng đỗ xe tại ô {assignedSlot.SlotNumber}, tầng {floorName}, tòa {buildingName}."
        };
    }

    /// <summary>
    /// Upload ảnh biển số lên Cloudinary (thay vì lưu file local).
    /// Tên file: {biểnsố}_{timestamp}
    /// Trả về URL HTTPS công khai từ Cloudinary CDN.
    /// </summary>
    private async Task<string?> SaveEntryImageAsync(string? base64Image, string licensePlate)
    {
        if (string.IsNullOrWhiteSpace(base64Image))
            return null;

        // Tạo tên file: biển số (loại bỏ ký tự đặc biệt) + timestamp
        var safePlate = licensePlate.Replace("-", "").Replace(".", "").Replace(" ", "");
        var fileName = $"{safePlate}_{DateTime.UtcNow:yyyyMMdd_HHmmss}";

        // Upload lên Cloudinary → trả về URL HTTPS
        return await _imageUploadService.UploadBase64ImageAsync(base64Image, fileName);
    }
}

