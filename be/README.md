# Parking Building Management System (Backend)

Hệ thống quản lý tòa nhà gửi xe thông minh, hỗ trợ quản lý cơ sở hạ tầng bãi xe, đăng ký/đăng nhập người dùng, tạo QR code vé xe, tích hợp AI nhận diện biển số xe (YOLOv8 + Tesseract OCR) và thuật toán gợi ý vị trí đỗ xe thông minh.

## Kiến Trúc Dự Án (Clean Architecture)

Dự án được xây dựng trên nền tảng **ASP.NET Core Web API (C#)** với **PostgreSQL** và Entity Framework Core 9.0, tuân thủ chặt chẽ Clean Architecture:

- **ParkingSystem.Domain**: Định nghĩa các Core Entities (`User`, `ParkingSlot`, `ParkingSession`, `Reservation`...) và Enums.
- **ParkingSystem.Application**: Các Interfaces, DTOs, và Use Case logic (Services).
- **ParkingSystem.Infrastructure**: Kết nối Database (`ApplicationDbContext`), triển khai các Repository và External Services (OCR, Token, AI).
- **ParkingSystem.API**: Các Controllers exposes API endpoints, cấu hình Middleware và Dependency Injection.

## Yêu Cầu Hệ Thống
- .NET 9.0 SDK
- PostgreSQL
- Python 3.13 (để tải và export model AI nếu cần)

## Các Tính Năng Cốt Lõi

### ✅ CRUD Cơ sở hạ tầng
Quản lý Building, Floor, ParkingSlot, VehicleType, PricingPolicy.

### ✅ Xác thực (Auth)
Đăng ký/Đăng nhập, tạo QR Code định danh (5 ký tự), Google OAuth, JWT Bearer Token.

### ✅ Vehicle Check-in Flow (2 nhánh)
- **Booking (Đặt trước)**: Quét QR Booking → Đối chiếu OCR biển số → Check-in.
- **Walk-in (Khách vãng lai)**: Scan OCR biển số → AI tự động gán slot hoặc Staff chọn tay → Sinh QR vé giấy.
- **Staff Override**: Staff xác nhận thủ công khi biển số xe thực tế lệch với biển số đăng ký.

### ✅ AI License Plate Recognition (OCR hoàn chỉnh)
Pipeline xử lý ảnh biển số xe từ camera thành text:

```
📷 Ảnh Base64 → YOLOv8 ONNX detect vùng biển số → Crop → Tiền xử lý (Grayscale, Contrast, Resize)
→ Tesseract OCR đọc ký tự → Hậu xử lý (sửa lỗi OCR, format biển số VN) → Trả về text
```

**Công nghệ sử dụng:**
| Thành phần | Công nghệ | Mô tả |
|-----------|-----------|-------|
| Plate Detection | YOLOv8n ONNX (11.7 MB) | Model train riêng cho biển số xe Việt Nam |
| Character Recognition | Tesseract OCR 5.2 | Đọc ký tự từ ảnh crop biển số |
| Image Processing | SixLabors.ImageSharp | Tiền xử lý ảnh (grayscale, contrast, resize) |
| Inference Engine | Microsoft.ML.OnnxRuntime | Chạy model AI trực tiếp trong C# |

**Hậu xử lý biển số VN:**
- Whitelist ký tự: `0-9 A B C D E F G H K L M N P R S T U V X Y Z . -`
- Sửa lỗi OCR phổ biến: O→0, I→1, S→5, Z→2
- Kiểm tra độ dài tối thiểu biển số hợp lệ

### ✅ AI Smart Slot Assignment (Gợi ý vị trí đỗ xe)
Thuật toán scoring dựa trên 5 tiêu chí để gợi ý ô đỗ xe tốt nhất:

| # | Tiêu chí | Trọng số | Ý nghĩa |
|---|----------|----------|---------|
| 1 | Trong ra ngoài | 30 điểm | Row thấp = trong cùng → lấp đầy từ trong ra |
| 2 | Gần lối vào | 25 điểm | DistanceToEntry thấp → tiện đi lại |
| 3 | Tầng thấp | 20 điểm | FloorIndex thấp → không cần lên cao |
| 4 | Gom cụm xe | 15 điểm | Có xe cùng loại cạnh bên → giảm phân mảnh |
| 5 | Ô đầu dãy | 10 điểm | Column thấp → dễ tìm |

---

## Danh Sách API Endpoints

### 1. Authentication (`/api/auth`)
| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| POST | `/api/auth/register` | Public | Đăng ký tài khoản (tự động tạo mã QR 5 ký tự) |
| POST | `/api/auth/login` | Public | Đăng nhập bằng Email/Password, trả về JWT Token |
| POST | `/api/auth/google-login` | Public | Đăng nhập bằng Google OAuth |

### 2. User Management (`/api/users`)
| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| GET | `/api/users/profile` | Authenticated | Xem profile người dùng hiện tại |
| PUT | `/api/users/profile` | Authenticated | Cập nhật profile cá nhân |
| POST | `/api/users` | Admin | Tạo mới user (CMS) |
| PUT | `/api/users/{id}` | Admin | Cập nhật user (CMS) |
| DELETE | `/api/users/{id}` | Admin | Xóa user (CMS) |

### 3. Check-in Flow (`/api/checkin`)
| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| POST | `/api/checkin/booking` | Staff/Manager/Admin | Check-in xe đã đặt trước (QR Booking + OCR đối chiếu) |
| POST | `/api/checkin/walk-in` | Staff/Manager/Admin | Check-in khách vãng lai (AI tự gán slot hoặc Staff chọn) |
| POST | `/api/checkin/staff-override` | Staff/Manager/Admin | Staff xác nhận đổi xe khi biển số lệch |
| GET | `/api/checkin/recommend-slots/{vehicleTypeId}` | Staff/Manager/Admin | Lấy danh sách gợi ý slot (AI Scoring) |

### 4. OCR & AI Camera (`/api/ocr`)
| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| POST | `/api/ocr/scan-plate` | Staff/Manager/Admin | Scan biển số: YOLO detect + Tesseract OCR → trả text |
| POST | `/api/ocr/scan-and-checkin` | Staff/Manager/Admin | Scan biển số + gợi ý check-in Walk-in liền mạch |

### 5. Infrastructure Management (Buildings, Floors, Slots...)
Các endpoints CRUD cơ bản tuân theo chuẩn RESTful. *Yêu cầu quyền Admin/Manager*.
- **Buildings**: `/api/buildings` (GET, POST, PUT, DELETE)
- **Floors**: `/api/floors` (GET, POST, PUT, DELETE)
- **Vehicle Types**: `/api/vehicletypes` (GET, POST, PUT, DELETE)
- **Pricing Policies**: `/api/pricingpolicies` (GET, POST, PUT, DELETE)
- **Parking Slots**: `/api/parkingslots` (GET, POST, PUT, DELETE)

---

## Cấu Trúc Thư Mục Quan Trọng
```
ParkingSystem.API/
├── Controllers/           # API endpoints
├── Models/                # ONNX model files
│   └── license_plate_detector.onnx
├── tessdata/              # Tesseract OCR trained data
│   └── eng.traineddata
├── Program.cs             # DI configuration
└── appsettings.json       # Connection strings, JWT config

ParkingSystem.Infrastructure/Services/
├── LicensePlateOcrService.cs   # YOLO + Tesseract pipeline
├── SlotAssignmentService.cs    # AI scoring algorithm
├── CheckInService.cs           # Booking + Walk-in logic
├── FallbackOcrService.cs       # Fallback khi chưa có model
└── ...
```

## Hướng Dẫn Chạy Dự Án
1. Cấu hình `appsettings.json`: chuỗi kết nối Database, JWT, Google OAuth.
2. Đảm bảo tồn tại file:
   - `ParkingSystem.API/Models/license_plate_detector.onnx`
   - `ParkingSystem.API/tessdata/eng.traineddata`
3. Mở terminal tại thư mục `ParkingSystem.API`:
   ```bash
   dotnet run
   ```
4. Truy cập Swagger UI: `http://localhost:5237/swagger`
5. Test OCR Camera: mở file `cameraTest.html` trên trình duyệt.
