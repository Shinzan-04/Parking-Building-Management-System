# Parking Building Management System (Backend)

Hệ thống quản lý tòa nhà gửi xe, hỗ trợ quản lý cơ sở hạ tầng bãi xe, đăng ký/đăng nhập người dùng, tạo QR code vé xe và tích hợp luồng check-in sử dụng AI (YOLOv8 ONNX) để nhận diện biển số xe.

## Kiến Trúc Dự Án (Clean Architecture)

Dự án được xây dựng trên nền tảng **ASP.NET Core Web API (C#)** với **PostgreSQL** và Entity Framework Core 9.0, tuân thủ chặt chẽ Clean Architecture:

- **ParkingSystem.Domain**: Định nghĩa các Core Entities (`User`, `ParkingSlot`, `ParkingSession`, `Reservation`...) và Enums.
- **ParkingSystem.Application**: Các Interfaces, DTOs, và Use Case logic (Services).
- **ParkingSystem.Infrastructure**: Kết nối Database (`ApplicationDbContext`), triển khai các Repository và External Services (OCR, Token).
- **ParkingSystem.API**: Các Controllers exposes API endpoints, cấu hình Middleware và Dependency Injection.

## Yêu Cầu Hệ Thống
- .NET 9.0 SDK
- PostgreSQL
- Python 3.13 (để tải và export model AI nếu cần)

## Các Tính Năng Cốt Lõi (Đã Triển Khai)
- **CRUD Cơ sở hạ tầng**: Quản lý Building, Floor, ParkingSlot, VehicleType, PricingPolicy.
- **Xác thực (Auth)**: Đăng ký/Đăng nhập, tạo QR Code định danh, Google OAuth.
- **Vehicle Check-in Flow**: Hỗ trợ 2 luồng:
  - *Booking*: Đối chiếu QR Code với OCR biển số.
  - *Walk-in*: Scan OCR, tự động gán chỗ trống, xuất QR vé.
- **AI OCR Integration**: Tích hợp model YOLOv8 ONNX (`license_plate_detector.onnx`) xử lý nhận diện vùng biển số trực tiếp trong C# (Sử dụng `Microsoft.ML.OnnxRuntime`).

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
| POST | `/api/checkin/booking` | Staff/Manager/Admin | Check-in cho xe đã đặt chỗ trước |
| POST | `/api/checkin/walk-in` | Staff/Manager/Admin | Check-in cho khách vãng lai (tự tìm slot & in QR) |
| POST | `/api/checkin/staff-override`| Staff/Manager/Admin | Staff xác nhận đổi biển số (nếu OCR lệch) |

### 4. OCR & AI Camera (`/api/ocr`)
| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| POST | `/api/ocr/scan-plate` | Staff/Manager/Admin | Scan biển số từ ảnh Base64 (YOLOv8 ONNX) |
| POST | `/api/ocr/scan-and-checkin` | Staff/Manager/Admin | Scan biển số + gợi ý check-in Walk-in liền mạch |

### 5. Infrastructure Management (Buildings, Floors, Slots...)
Các endpoints CRUD cơ bản tuân theo chuẩn RESTful. *Yêu cầu quyền Admin/Manager*.
- **Buildings**: `/api/buildings` (GET, POST, PUT, DELETE)
- **Floors**: `/api/floors` (GET, POST, PUT, DELETE)
- **Vehicle Types**: `/api/vehicletypes` (GET, POST, PUT, DELETE)
- **Pricing Policies**: `/api/pricingpolicies` (GET, POST, PUT, DELETE)
- **Parking Slots**: `/api/parkingslots` (GET, POST, PUT, DELETE)

---

## Hướng Dẫn Chạy Dự Án
1. Đảm bảo đã có file `appsettings.Development.json` cấu hình chuỗi kết nối Database và JWT.
2. Đảm bảo file model `Models/license_plate_detector.onnx` tồn tại trong thư mục `ParkingSystem.API/Models`.
3. Mở terminal tại thư mục `ParkingSystem.API`:
   ```bash
   dotnet run
   ```
4. Truy cập `http://localhost:5237/swagger` để xem tài liệu và test API.
