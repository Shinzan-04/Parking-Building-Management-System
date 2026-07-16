# 🅿️ Parking Building Management System (Backend)

Hệ thống quản lý tòa nhà gửi xe thông minh — hỗ trợ quản lý cơ sở hạ tầng bãi xe, xác thực đa kênh (JWT + Google + OTP Email), tích hợp AI nhận diện biển số xe (YOLOv8 + Tesseract OCR), thanh toán PayOS, và thuật toán gợi ý vị trí đỗ xe thông minh.

## 📐 Kiến Trúc Dự Án (Clean Architecture)

Dự án được xây dựng trên nền tảng **ASP.NET Core 9.0 Web API (C#)** với **PostgreSQL (Neon Serverless)** và Entity Framework Core 9.0:

```
ParkingSystem.Domain          → Entities, Enums, Interfaces cốt lõi
ParkingSystem.Application     → DTOs, Interfaces, Services (business logic)
ParkingSystem.Infrastructure  → DbContext, Repositories, External Services
ParkingSystem.API             → Controllers, Middleware, DI Configuration
```

## ⚙️ Yêu Cầu Hệ Thống
- .NET 9.0 SDK
- PostgreSQL (hoặc Neon Serverless)
- Python 3.13 (tùy chọn — để train/export model AI)

## 🔌 Tích Hợp Bên Thứ Ba

| Service | Mục đích | Config key |
|---------|----------|------------|
| **Neon PostgreSQL** | Database serverless | `ConnectionStrings:DefaultConnection` |
| **Cloudinary** | Lưu ảnh biển số check-in | `Cloudinary:*` |
| **Gmail SMTP** | Gửi OTP email (đăng ký/quên MK) | `EmailSettings:*` |
| **Google OAuth** | Đăng nhập Google | `Google:ClientId` |
| **PayOS** | Thanh toán online | `PayOS:*` |
| **ONNX Runtime** | OCR biển số xe VN | `Models/license_plate_detector.onnx` |

---

## 🔐 1. Authentication & Authorization (12 endpoints)

**Controller**: `AuthController` — `/api/auth`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| POST | `/api/auth/login` | ❌ | Đăng nhập → AccessToken + RefreshToken |
| POST | `/api/auth/register` | ❌ | Đăng ký Driver (không OTP) |
| POST | `/api/auth/google-login` | ❌ | Đăng nhập Google OAuth |
| POST | `/api/auth/refresh` | ❌ | Gia hạn AccessToken bằng RefreshToken |
| GET | `/api/auth/me` | 🔒 All | Xem profile từ JWT |
| POST | `/api/auth/change-password` | 🔒 All | Đổi mật khẩu (cần MK cũ) |
| POST | `/api/auth/create-user` | 🔒 Admin | Admin tạo tài khoản Staff/Manager |
| POST | `/api/auth/logout` | ❌ | Thu hồi RefreshToken |
| PUT | `/api/auth/profile` | 🔒 All | Cập nhật tên/SĐT/email |
| POST | `/api/auth/send-otp` | ❌ | Gửi mã OTP qua email (Register/ForgotPassword) |
| POST | `/api/auth/verify-register` | ❌ | Đăng ký với xác thực OTP email |
| POST | `/api/auth/reset-password` | ❌ | Đặt lại mật khẩu bằng OTP |

**Bảo mật:**
- 🔒 Khóa tài khoản sau 5 lần đăng nhập sai (lockout 15 phút)
- 🔑 RefreshToken (7 ngày) + AccessToken (24 giờ)
- 📧 Email OTP 6 số (hết hạn 5 phút) qua Gmail SMTP
- 🔐 BCrypt password hashing

---

## 🚗 2. Check-in — Tiếp Nhận Xe Vào Bãi (4 endpoints)

**Controller**: `CheckInController` — `/api/checkin`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| POST | `/api/checkin/booking` | 🔒 Staff+ | Check-in xe có đặt trước (reservation) |
| POST | `/api/checkin/walk-in` | 🔒 Staff+ | Check-in xe vãng lai |
| POST | `/api/checkin/staff-override` | 🔒 Staff+ | Staff ghi đè biển số thủ công |
| GET | `/api/checkin/recommend-slots/{vehicleTypeId}` | 🔒 Staff+ | Gợi ý ô đỗ phù hợp (AI Scoring) |

---

## 🏁 3. Check-out — Trả Xe Ra Bãi (3 endpoints)

**Controller**: `CheckOutController` — `/api/checkout`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| GET | `/api/checkout/search?licensePlate=` | 🔒 Staff+ | Tìm xe đang gửi theo biển số |
| POST | `/api/checkout/confirm` | 🔒 Staff+ | Xác nhận thanh toán & cho xe ra |
| POST | `/api/checkout/ocr-checkout` | 🔒 Staff+ | Check-out bằng OCR (chụp ảnh biển số) |

---

## 📋 4. Sessions — Quản Lý Phiên Gửi Xe (4 endpoints)

**Controller**: `SessionsController` — `/api/sessions`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| GET | `/api/sessions/active` | 🔒 Staff+ | Danh sách xe đang trong bãi |
| GET | `/api/sessions/search?keyword=` | 🔒 Staff+ | Tìm session theo biển số/tên |
| GET | `/api/sessions/{id}` | 🔒 Staff+ | Chi tiết 1 session |
| GET | `/api/sessions/find-by-plate?licensePlate=` | 🔒 Staff+ | Tìm session theo biển số |

---

## 📅 5. Reservations — Đặt Chỗ Trước (5 endpoints)

**Controller**: `ReservationsController` — `/api/reservations`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| POST | `/api/reservations` | 🔒 All | Tạo đặt chỗ mới |
| GET | `/api/reservations/my-reservations` | 🔒 All | Xem đặt chỗ của tôi |
| PUT | `/api/reservations/{id}/cancel` | 🔒 All | Hủy đặt chỗ |
| GET | `/api/reservations/pending` | 🔒 Staff+ | Danh sách chờ duyệt |
| PUT | `/api/reservations/{id}/review` | 🔒 Staff+ | Duyệt/từ chối (lưu lý do) |

**Validation khi tạo đặt chỗ:**
- Kiểm tra ParkingSlot tồn tại + đang Available
- Validate VehicleType phù hợp với slot
- Kiểm tra trùng biển số/slot trong cùng khoảng giờ

**Auto-cancel (Background Service):**
- Pending > 30 phút không duyệt → tự động hủy
- Confirmed > 30 phút sau StartTime chưa check-in → tự động hủy
- Gửi notification cho Driver khi bị hủy

---

## 🔔 6. Notifications — Thông Báo (4 endpoints)

**Controller**: `NotificationsController` — `/api/notifications`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| GET | `/api/notifications` | 🔒 All | Danh sách thông báo (phân trang) |
| GET | `/api/notifications/unread-count` | 🔒 All | Đếm thông báo chưa đọc |
| PUT | `/api/notifications/{id}/read` | 🔒 All | Đánh dấu đã đọc |
| PUT | `/api/notifications/read-all` | 🔒 All | Đánh dấu tất cả đã đọc |

**Khi nào notification được gửi:**
- ✅ Staff chấp nhận đặt chỗ
- ❌ Staff từ chối đặt chỗ (kèm lý do)
- ⏰ Hệ thống auto-cancel reservation hết hạn

---

## 💰 7. Thanh Toán & Giá

### Payments (`/api/payments`)
| Method | Endpoint | Mô tả |
|--------|----------|--------|
| POST | `/api/payments/payos/create` | Tạo thanh toán PayOS |
| POST | `/api/payments/payos/webhook` | Webhook nhận callback PayOS |

### PriceSettings (`/api/pricesettings`)
| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| GET | `/api/pricesettings` | 🔒 Admin/Manager | Xem tất cả giá |
| GET | `/api/pricesettings/{vehicleTypeId}` | 🔒 Admin/Manager | Giá theo loại xe |
| POST | `/api/pricesettings` | 🔒 Admin/Manager | Tạo bảng giá |
| PUT | `/api/pricesettings/{vehicleTypeId}` | 🔒 Admin/Manager | Cập nhật giá |
| DELETE | `/api/pricesettings/{vehicleTypeId}` | 🔒 Admin/Manager | Xóa bảng giá |

### PricingPolicies (`/api/pricingpolicies`)
CRUD chính sách giá theo loại xe — GET (public), POST/PUT/DELETE (Admin/Manager).

---

## 🏢 8. Quản Lý Cơ Sở Hạ Tầng

CRUD theo chuẩn RESTful. GET endpoints public, POST/PUT/DELETE yêu cầu Admin/Manager.

- **Buildings**: `/api/buildings` — Tòa nhà
- **Floors**: `/api/floors` — Tầng (lọc theo building)
- **ParkingSlots**: `/api/parkingslots` — Ô đỗ xe (lọc theo tầng, loại xe, trạng thái)
- **VehicleTypes**: `/api/vehicletypes` — Loại xe

---

## 🤖 9. OCR — Nhận Diện Biển Số Xe (2 endpoints)

**Controller**: `OcrController` — `/api/ocr`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| POST | `/api/ocr/scan-plate` | 🔒 Staff+ | Quét ảnh → trả biển số |
| POST | `/api/ocr/scan-and-checkin` | 🔒 Staff+ | Quét + tự động check-in |

**Pipeline xử lý:**
```
📷 Ảnh Base64 → YOLOv8 ONNX detect vùng biển số → Crop → Tiền xử lý (Grayscale, Contrast, Resize)
→ Tesseract OCR đọc ký tự → Hậu xử lý (sửa lỗi OCR, format biển số VN) → Trả về text
```

| Thành phần | Công nghệ | Mô tả |
|-----------|-----------|-------|
| Plate Detection | YOLOv8n ONNX (11.7 MB) | Model train riêng cho biển số VN |
| Character Recognition | Tesseract OCR 5.2 | Đọc ký tự từ ảnh crop biển số |
| Image Processing | SixLabors.ImageSharp | Tiền xử lý ảnh |
| Inference Engine | Microsoft.ML.OnnxRuntime | Chạy model AI trong C# |

---

## 👤 10. Users — Quản Lý Người Dùng (5 endpoints)

**Controller**: `UsersController` — `/api/users` (Admin only)

CRUD: GET all, GET by id, POST, PUT, DELETE.

---

## 🤖 AI Smart Slot Assignment

Thuật toán scoring 5 tiêu chí gợi ý ô đỗ xe tốt nhất:

| # | Tiêu chí | Trọng số | Ý nghĩa |
|---|----------|----------|---------|
| 1 | Trong ra ngoài | 30 điểm | Lấp đầy từ trong ra ngoài |
| 2 | Gần lối vào | 25 điểm | Tiện đi lại |
| 3 | Tầng thấp | 20 điểm | Không cần lên cao |
| 4 | Gom cụm xe | 15 điểm | Giảm phân mảnh |
| 5 | Ô đầu dãy | 10 điểm | Dễ tìm |

---

## 🗄️ Database Entities (13 bảng)

| Bảng | Mô tả |
|------|--------|
| `Users` | Tài khoản (Admin/Manager/Staff/Driver) + lockout + QR |
| `RefreshTokens` | JWT refresh tokens (7 ngày, revocable) |
| `OtpCodes` | Mã OTP email (6 số, 5 phút) |
| `Notifications` | Thông báo in-app |
| `Buildings` | Tòa nhà |
| `Floors` | Tầng trong tòa nhà |
| `ParkingSlots` | Ô đỗ xe |
| `VehicleTypes` | Loại xe (xe máy, ô tô...) |
| `PricingPolicies` | Chính sách giá theo loại xe |
| `PriceSettings` | Cài đặt giá cụ thể |
| `ParkingSessions` | Phiên gửi xe (Active/Completed) |
| `Reservations` | Đặt chỗ trước + RejectReason |
| `Payments` | Thanh toán (PayOS) |

---

## 📁 Cấu Trúc Thư Mục

```
ParkingSystem.API/
├── Controllers/                 # 15 API controllers
├── Models/                      # ONNX model files
│   └── license_plate_detector.onnx
├── tessdata/                    # Tesseract OCR trained data
│   └── eng.traineddata
├── Program.cs                   # DI configuration + Seed data
└── appsettings.json             # Connection strings, JWT, Email, PayOS

ParkingSystem.Infrastructure/Services/
├── LicensePlateOcrService.cs    # YOLO + Tesseract pipeline
├── SlotAssignmentService.cs     # AI scoring algorithm
├── CheckInService.cs            # Booking + Walk-in logic
├── CheckOutService.cs           # Search + Confirm + OCR checkout
├── ReservationService.cs        # Đặt chỗ + duyệt + notification
├── ReservationCleanupService.cs # Background auto-cancel
├── NotificationService.cs       # In-app notification
├── GmailEmailService.cs         # Gmail SMTP sender
├── OtpService.cs                # OTP generation/verification
├── CloudinaryImageService.cs    # Upload ảnh biển số
├── FallbackOcrService.cs        # Fallback khi chưa có model
└── ...
```

---

## 🚀 Hướng Dẫn Chạy Dự Án

### 1. Cấu hình `appsettings.json`
Xem file `appsettings.Example.json` để biết cấu trúc. Cần điền:
- **ConnectionStrings**: Chuỗi kết nối PostgreSQL/Neon
- **JwtSettings**: Key, Issuer, Audience
- **Google**: ClientId, ClientSecret
- **EmailSettings**: Gmail + App Password
- **Cloudinary**: CloudName, ApiKey, ApiSecret
- **PayOS**: ClientId, ApiKey, ChecksumKey

### 2. Chuẩn bị files (tùy chọn)
```
ParkingSystem.API/Models/license_plate_detector.onnx
ParkingSystem.API/tessdata/eng.traineddata
```

### 3. Chạy server
```bash
cd ParkingSystem.API
dotnet run
```

### 4. Truy cập
- Swagger UI: `http://localhost:5237/swagger`
- Test OCR Camera: mở file `cameraTest.html`

### 5. Tài khoản mẫu (auto-seed)

| Username | Password | Role |
|----------|----------|------|
| `admin` | `123123` | Admin |
| `manager` | `123123` | Manager |
| `staff` | `123123` | Staff |
| `driver` | `123123` | Driver |

---

## 📊 Tổng Kết

| Metric | Số lượng |
|--------|----------|
| **Controllers** | 15 |
| **API Endpoints** | ~62 |
| **Database Tables** | 13 |
| **Background Services** | 1 (ReservationCleanup) |
| **External Integrations** | 6 |
| **Roles** | 4 (Admin, Manager, Staff, Driver) |
