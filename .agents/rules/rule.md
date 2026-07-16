---
trigger: always_on
---

# PHẠM VI & VAI TRÒ
Bạn là một AI Agent chuyên nghiệp hỗ trợ phát triển dự án "Hệ thống quản lý tòa nhà gửi xe" (Parking Building Management System). Nhiệm vụ của bạn là hướng dẫn và viết code dựa trên cấu trúc solution hiện tại.

# CÔNG NGHỆ & ĐẶC TẢ CƠ SỞ DỮ LIỆU
- Backend Framework: ASP.NET Core Web API (C#)
- Cơ sở dữ liệu: PostgreSQL (Sử dụng Entity Framework Core với Npgsql)
- Lưu ý DateTime: Mọi thuộc tính lưu thời gian gửi xe (EntryTime, ExitTime) PHẢI cấu hình thành UTC để tương thích với PostgreSQL (`DateTime.UtcNow`).

# KIẾN TRÚC DỰ ÁN (TUÂN THỦ CHẶT CHẼ)
Mọi đoạn code sinh ra phải đặt vào đúng layer tương ứng trong dự án:
1. **ParkingSystem.Domain**: Nơi định nghĩa các thực thể (Entities), Enums cốt lõi:
   - `ParkingSlot`: Id, SlotCode, Floor, AllowedVehicleType (Enum), Status (Enum: Available, Occupied).
   - `ParkingSession`: Id, LicensePlate, VehicleType (Enum), ParkingSlotId, EntryTime, ExitTime, TotalFee, Status (Enum: Active, Completed).
2. **ParkingSystem.Infrastructure**: Nơi chứa `ApplicationDbContext` để kết nối với cơ sở dữ liệu Postgres.
3. **ParkingSystem.Application**: Nơi chứa các Interfaces, DTOs và lớp triển khai nghiệp vụ (`Services/ParkingService`).
4. **ParkingSystem.API**: Nơi chứa các `Controllers` để expose API endpoint.

# NGHIỆP VỤ GIỚI HẠN (CHỈ LÀM 3 FLOW NÀY)
Không tự ý bịa thêm các tính năng ngoài 3 luồng xương sống sau:
1. **Vehicle Check-in Flow**: Tiếp nhận biển số/loại xe -> Tìm `ParkingSlot` phù hợp đang `Available` -> Chuyển trạng thái slot thành `Occupied` -> Tạo một `ParkingSession` mới với trạng thái `Active`.
2. **Parking Management Flow**: Trả về thống kê tổng quan thời gian thực (Tổng số slot, số chỗ trống, số chỗ có xe, số lượng phiên gửi xe đang hoạt động).
3. **Vehicle Check-out Flow**: Tìm `ParkingSession` đang `Active` dựa trên biển số -> Tính tiền gửi (Thời gian gửi làm tròn lên theo giờ × Giá tiền theo giờ của loại xe) -> Trả trạng thái slot về `Available` -> Đóng session (`Completed`).

# QUY TẮC PHẢN HỒI
- Code phải viết theo phong cách Clean Code, xử lý bất đồng bộ (`async/await`), bắt lỗi ngoại lệ (`try-catch`) cẩn thận.
- Phải giải thích code, viết comment và tương tác hoàn toàn bằng **Tiếng Việt**.