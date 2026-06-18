-- File Seed Dữ Liệu Cơ Bản cho ParkingSystem (PostgreSQL)
-- Hướng dẫn: Mở file này trong DBeaver / pgAdmin và chạy toàn bộ (Run Script)

-- Mật khẩu mặc định cho tất cả user là '123123' (Mã băm BCrypt tương ứng bên dưới)
-- Hash của '123123': $2a$11$U1E.kI4D/y8Wk5JjF8r6/.y0U./P2rVn/A20z42q/P/N7O0Gj.O9K

-- 1. XÓA DỮ LIỆU CŨ NẾU CẦN (Bỏ comment nếu muốn reset)
-- TRUNCATE TABLE "Vehicles" CASCADE;
-- TRUNCATE TABLE "ParkingSlots" CASCADE;
-- TRUNCATE TABLE "Floors" CASCADE;
-- TRUNCATE TABLE "Buildings" CASCADE;
-- TRUNCATE TABLE "PriceSettings" CASCADE;
-- TRUNCATE TABLE "PricingPolicies" CASCADE;
-- TRUNCATE TABLE "VehicleTypes" CASCADE;
-- TRUNCATE TABLE "Users" CASCADE;

-- 2. CHÈN NGƯỜI DÙNG (USERS)
INSERT INTO "Users" ("Id", "Username", "PasswordHash", "FullName", "Role", "Email", "PhoneNumber", "DriverCode", "CreatedAt", "IsDeleted")
VALUES 
('11111111-1111-1111-1111-111111111111', 'admin', '$2a$11$U1E.kI4D/y8Wk5JjF8r6/.y0U./P2rVn/A20z42q/P/N7O0Gj.O9K', 'Quản trị viên', 0, 'admin@parking.vn', '0901000001', 'DRV-11111', NOW(), false),
('22222222-2222-2222-2222-222222222222', 'manager', '$2a$11$U1E.kI4D/y8Wk5JjF8r6/.y0U./P2rVn/A20z42q/P/N7O0Gj.O9K', 'Quản lý bãi xe', 1, 'manager@parking.vn', '0901000002', 'DRV-22222', NOW(), false),
('33333333-3333-3333-3333-333333333333', 'staff', '$2a$11$U1E.kI4D/y8Wk5JjF8r6/.y0U./P2rVn/A20z42q/P/N7O0Gj.O9K', 'Nhân viên trực', 2, 'staff@parking.vn', '0901000003', 'DRV-33333', NOW(), false),
('44444444-4444-4444-4444-444444444444', 'driver', '$2a$11$U1E.kI4D/y8Wk5JjF8r6/.y0U./P2rVn/A20z42q/P/N7O0Gj.O9K', 'Khách hàng 1', 3, 'driver@parking.vn', '0901000004', 'DRV-44444', NOW(), false),
('55555555-5555-5555-5555-555555555555', 'driver2', '$2a$11$U1E.kI4D/y8Wk5JjF8r6/.y0U./P2rVn/A20z42q/P/N7O0Gj.O9K', 'Khách hàng 2', 3, 'driver2@parking.vn', '0901000005', 'DRV-55555', NOW(), false),
('66666666-6666-6666-6666-666666666666', 'driver3', '$2a$11$U1E.kI4D/y8Wk5JjF8r6/.y0U./P2rVn/A20z42q/P/N7O0Gj.O9K', 'Khách hàng 3', 3, 'driver3@parking.vn', '0901000006', 'DRV-66666', NOW(), false)
ON CONFLICT ("Id") DO NOTHING;

-- 3. CHÈN LOẠI XE (VEHICLE TYPES)
INSERT INTO "VehicleTypes" ("Id", "Name", "Description", "CreatedAt", "IsDeleted")
VALUES 
('6db80362-1bbb-40e4-b892-ec5879d614fa', 'Ô tô', 'Xe hơi 4-7 chỗ', NOW(), false),
('7db80362-1bbb-40e4-b892-ec5879d614fb', 'Xe máy', 'Xe gắn máy 2 bánh', NOW(), false)
ON CONFLICT ("Id") DO NOTHING;

-- 4. CHÈN BẢNG GIÁ & CÀI ĐẶT GIÁ (PRICING)
INSERT INTO "PricingPolicies" ("Id", "VehicleTypeId", "BlockPrice", "BlockMinutes", "HourlyRate", "DailyMaxRate", "CreatedAt", "IsDeleted")
VALUES 
(gen_random_uuid(), '6db80362-1bbb-40e4-b892-ec5879d614fa', 20000, 60, 20000, 150000, NOW(), false),
(gen_random_uuid(), '7db80362-1bbb-40e4-b892-ec5879d614fb', 5000, 60, 5000, 30000, NOW(), false);

INSERT INTO "PriceSettings" ("Id", "VehicleTypeId", "DayPassPrice", "NightPassPrice", "DailyMaxPrice", "DayStartHour", "NightStartHour", "CreatedAt", "IsDeleted")
VALUES 
(gen_random_uuid(), '6db80362-1bbb-40e4-b892-ec5879d614fa', 100000, 50000, 150000, 6, 18, NOW(), false),
(gen_random_uuid(), '7db80362-1bbb-40e4-b892-ec5879d614fb', 20000, 10000, 30000, 6, 18, NOW(), false);

-- 5. CHÈN HẠ TẦNG (BUILDING -> FLOOR -> PARKING SLOTS)
INSERT INTO "Buildings" ("Id", "Name", "Address", "TotalCapacity", "CreatedAt", "IsDeleted")
VALUES 
('99999999-9999-9999-9999-999999999999', 'Tòa nhà A', '123 Đường A', 100, NOW(), false)
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "Floors" ("Id", "BuildingId", "Name", "FloorIndex", "CreatedAt", "IsDeleted")
VALUES 
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999999', 'Tầng 1', 1, NOW(), false)
ON CONFLICT ("Id") DO NOTHING;

-- 5 SLOT Ô TÔ
INSERT INTO "ParkingSlots" ("Id", "FloorId", "SlotNumber", "VehicleTypeId", "Status", "CreatedAt", "IsDeleted")
VALUES 
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A1-01', '6db80362-1bbb-40e4-b892-ec5879d614fa', 0, NOW(), false),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A1-02', '6db80362-1bbb-40e4-b892-ec5879d614fa', 0, NOW(), false),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A1-03', '6db80362-1bbb-40e4-b892-ec5879d614fa', 0, NOW(), false),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A1-04', '6db80362-1bbb-40e4-b892-ec5879d614fa', 0, NOW(), false),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A1-05', '6db80362-1bbb-40e4-b892-ec5879d614fa', 0, NOW(), false);

-- 5 SLOT XE MÁY
INSERT INTO "ParkingSlots" ("Id", "FloorId", "SlotNumber", "VehicleTypeId", "Status", "CreatedAt", "IsDeleted")
VALUES 
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A1-M1', '7db80362-1bbb-40e4-b892-ec5879d614fb', 0, NOW(), false),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A1-M2', '7db80362-1bbb-40e4-b892-ec5879d614fb', 0, NOW(), false),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A1-M3', '7db80362-1bbb-40e4-b892-ec5879d614fb', 0, NOW(), false),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A1-M4', '7db80362-1bbb-40e4-b892-ec5879d614fb', 0, NOW(), false),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A1-M5', '7db80362-1bbb-40e4-b892-ec5879d614fb', 0, NOW(), false);

-- 6. CHÈN PHƯƠNG TIỆN CHO DRIVER (VEHICLES)
INSERT INTO "Vehicles" ("Id", "DriverId", "PlateNumber", "VehicleTypeId", "IsPrimary", "CreatedAt", "IsDeleted")
VALUES 
('017cc0e6-a83d-4c81-8d2b-5fcf2be2cd00', '44444444-4444-4444-4444-444444444444', '98K102897', '6db80362-1bbb-40e4-b892-ec5879d614fa', true, NOW(), false),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', '51H12345', '6db80362-1bbb-40e4-b892-ec5879d614fa', true, NOW(), false),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', '59P199999', '7db80362-1bbb-40e4-b892-ec5879d614fb', true, NOW(), false)
ON CONFLICT ("Id") DO NOTHING;
