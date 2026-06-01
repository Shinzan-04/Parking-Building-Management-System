-- ============================================================
-- Parking Building Management System - Database Schema
-- Provider : PostgreSQL (Npgsql EF Core 9)
-- Generated: 2026-05-26
-- ============================================================

-- Enum comments (stored as INTEGER in DB)
-- Role            : 0=Admin | 1=Manager | 2=Staff | 3=Driver
-- SlotStatus      : 0=Available | 1=Occupied | 2=Reserved | 3=Maintenance
-- SessionStatus   : 0=Active | 1=Completed | 2=Overdue
-- IssueType       : 0=None | 1=LostTicket | 2=WrongPlate | 3=WrongSlot | 4=Unpaid
-- ReservationStatus: 0=Pending | 1=Confirmed | 2=CheckedIn | 3=Cancelled | 4=Completed | 5=Rejected
-- PaymentStatus   : 0=Pending | 1=Success | 2=Failed
-- PaymentMethod   : 0=Cash | 1=Momo | 2=VNPay | 3=CreditCard | 4=PayOS
-- CheckInMethod   : 0=WalkIn | 1=Booking

-- ============================================================
-- TABLE: Buildings
-- ============================================================
CREATE TABLE "Buildings" (
    "Id"            UUID            NOT NULL DEFAULT gen_random_uuid(),
    "Name"          TEXT            NOT NULL,
    "Address"       TEXT            NOT NULL,
    "TotalCapacity" INTEGER         NOT NULL,
    "CreatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT now(),
    "UpdatedAt"     TIMESTAMPTZ,
    "IsDeleted"     BOOLEAN         NOT NULL DEFAULT FALSE,
    CONSTRAINT "PK_Buildings" PRIMARY KEY ("Id")
);

-- ============================================================
-- TABLE: VehicleTypes
-- ============================================================
CREATE TABLE "VehicleTypes" (
    "Id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "Name"        TEXT        NOT NULL,
    "Description" TEXT,
    "CreatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    "UpdatedAt"   TIMESTAMPTZ,
    "IsDeleted"   BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT "PK_VehicleTypes" PRIMARY KEY ("Id")
);

-- ============================================================
-- TABLE: Users
-- ============================================================
CREATE TABLE "Users" (
    "Id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
    "Username"     TEXT        NOT NULL,
    "PasswordHash" TEXT        NOT NULL,
    "FullName"     TEXT        NOT NULL,
    "Role"         INTEGER     NOT NULL,           -- see Role enum
    "PhoneNumber"  TEXT,
    "Email"        TEXT,
    "QrCode"       TEXT        NOT NULL DEFAULT '',
    "CreatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    "UpdatedAt"    TIMESTAMPTZ,
    "IsDeleted"    BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT "PK_Users" PRIMARY KEY ("Id")
);

-- ============================================================
-- TABLE: Floors
-- ============================================================
CREATE TABLE "Floors" (
    "Id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "BuildingId" UUID        NOT NULL,
    "Name"       TEXT        NOT NULL,
    "FloorIndex" INTEGER     NOT NULL,
    "CreatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "UpdatedAt"  TIMESTAMPTZ,
    "IsDeleted"  BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT "PK_Floors" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Floors_Buildings_BuildingId"
        FOREIGN KEY ("BuildingId") REFERENCES "Buildings" ("Id") ON DELETE CASCADE
);

-- ============================================================
-- TABLE: ParkingSlots
-- ============================================================
CREATE TABLE "ParkingSlots" (
    "Id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
    "FloorId"         UUID        NOT NULL,
    "VehicleTypeId"   UUID        NOT NULL,
    "SlotNumber"      TEXT        NOT NULL,
    "Status"          INTEGER     NOT NULL DEFAULT 0,  -- SlotStatus
    "Row"             INTEGER     NOT NULL,
    "Column"          INTEGER     NOT NULL,
    "DistanceToEntry" INTEGER     NOT NULL,
    "CreatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    "UpdatedAt"       TIMESTAMPTZ,
    "IsDeleted"       BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT "PK_ParkingSlots" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ParkingSlots_Floors_FloorId"
        FOREIGN KEY ("FloorId") REFERENCES "Floors" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ParkingSlots_VehicleTypes_VehicleTypeId"
        FOREIGN KEY ("VehicleTypeId") REFERENCES "VehicleTypes" ("Id") ON DELETE CASCADE
);

-- ============================================================
-- TABLE: PricingPolicies
-- ============================================================
CREATE TABLE "PricingPolicies" (
    "Id"            UUID           NOT NULL DEFAULT gen_random_uuid(),
    "VehicleTypeId" UUID           NOT NULL,
    "BlockPrice"    NUMERIC(18,2)  NOT NULL,
    "BlockMinutes"  INTEGER        NOT NULL,
    "HourlyRate"    NUMERIC(18,2)  NOT NULL,
    "DailyMaxRate"  NUMERIC(18,2)  NOT NULL,
    "CreatedAt"     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    "UpdatedAt"     TIMESTAMPTZ,
    "IsDeleted"     BOOLEAN        NOT NULL DEFAULT FALSE,
    CONSTRAINT "PK_PricingPolicies" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PricingPolicies_VehicleTypes_VehicleTypeId"
        FOREIGN KEY ("VehicleTypeId") REFERENCES "VehicleTypes" ("Id") ON DELETE CASCADE
);

-- ============================================================
-- TABLE: Reservations
-- ============================================================
CREATE TABLE "Reservations" (
    "Id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
    "DriverId"      UUID        NOT NULL,
    "ParkingSlotId" UUID        NOT NULL,
    "VehicleTypeId" UUID        NOT NULL,
    "BookingCode"   TEXT        NOT NULL,
    "LicensePlate"  TEXT        NOT NULL,
    "StartTime"     TIMESTAMPTZ NOT NULL,
    "EndTime"       TIMESTAMPTZ NOT NULL,
    "Status"        INTEGER     NOT NULL DEFAULT 0,  -- ReservationStatus
    "CreatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    "UpdatedAt"     TIMESTAMPTZ,
    "IsDeleted"     BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT "PK_Reservations" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Reservations_Users_DriverId"
        FOREIGN KEY ("DriverId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Reservations_ParkingSlots_ParkingSlotId"
        FOREIGN KEY ("ParkingSlotId") REFERENCES "ParkingSlots" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Reservations_VehicleTypes_VehicleTypeId"
        FOREIGN KEY ("VehicleTypeId") REFERENCES "VehicleTypes" ("Id") ON DELETE RESTRICT
);

-- ============================================================
-- TABLE: ParkingSessions
-- ============================================================
CREATE TABLE "ParkingSessions" (
    "Id"            UUID           NOT NULL DEFAULT gen_random_uuid(),
    "DriverId"      UUID,                           -- nullable: walk-in không cần tài khoản
    "StaffId"       UUID,                           -- nullable: check-in tự động
    "ParkingSlotId" UUID           NOT NULL,
    "VehicleTypeId" UUID           NOT NULL,
    "ReservationId" UUID,                           -- nullable: walk-in không có đặt trước
    "LicensePlate"  TEXT           NOT NULL,
    "SessionCode"   TEXT           NOT NULL,
    "CheckInMethod" INTEGER        NOT NULL DEFAULT 0,  -- CheckInMethod
    "EntryTime"     TIMESTAMPTZ    NOT NULL,
    "ExitTime"      TIMESTAMPTZ,
    "EstimatedFee"  NUMERIC(18,2)  NOT NULL DEFAULT 0,
    "TotalFee"      NUMERIC(18,2)  NOT NULL DEFAULT 0,
    "Status"        INTEGER        NOT NULL DEFAULT 0,  -- SessionStatus
    "IssueType"     INTEGER        NOT NULL DEFAULT 0,  -- IssueType
    "CreatedAt"     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    "UpdatedAt"     TIMESTAMPTZ,
    "IsDeleted"     BOOLEAN        NOT NULL DEFAULT FALSE,
    CONSTRAINT "PK_ParkingSessions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ParkingSessions_Users_DriverId"
        FOREIGN KEY ("DriverId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_ParkingSessions_Users_StaffId"
        FOREIGN KEY ("StaffId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_ParkingSessions_ParkingSlots_ParkingSlotId"
        FOREIGN KEY ("ParkingSlotId") REFERENCES "ParkingSlots" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ParkingSessions_VehicleTypes_VehicleTypeId"
        FOREIGN KEY ("VehicleTypeId") REFERENCES "VehicleTypes" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ParkingSessions_Reservations_ReservationId"
        FOREIGN KEY ("ReservationId") REFERENCES "Reservations" ("Id") ON DELETE SET NULL
);

-- ============================================================
-- TABLE: Payments
-- ============================================================
CREATE TABLE "Payments" (
    "Id"               UUID           NOT NULL DEFAULT gen_random_uuid(),
    "PayOSOrderCode"   BIGINT         NOT NULL,
    "ParkingSessionId" UUID,                        -- nullable: payment có thể tách khỏi session
    "Amount"           NUMERIC(18,2)  NOT NULL,
    "Description"      TEXT,
    "PaymentDate"      TIMESTAMPTZ    NOT NULL,
    "PaymentMethod"    INTEGER        NOT NULL DEFAULT 4,  -- PaymentMethod (4=PayOS)
    "Status"           INTEGER        NOT NULL DEFAULT 0,  -- PaymentStatus
    "CreatedAt"        TIMESTAMPTZ    NOT NULL DEFAULT now(),
    "UpdatedAt"        TIMESTAMPTZ,
    "IsDeleted"        BOOLEAN        NOT NULL DEFAULT FALSE,
    CONSTRAINT "PK_Payments" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Payments_ParkingSessions_ParkingSessionId"
        FOREIGN KEY ("ParkingSessionId") REFERENCES "ParkingSessions" ("Id") ON DELETE SET NULL
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Floors
CREATE INDEX "IX_Floors_BuildingId"         ON "Floors" ("BuildingId");

-- ParkingSlots
CREATE INDEX "IX_ParkingSlots_FloorId"       ON "ParkingSlots" ("FloorId");
CREATE INDEX "IX_ParkingSlots_VehicleTypeId" ON "ParkingSlots" ("VehicleTypeId");

-- PricingPolicies
CREATE INDEX "IX_PricingPolicies_VehicleTypeId" ON "PricingPolicies" ("VehicleTypeId");

-- Reservations
CREATE INDEX "IX_Reservations_DriverId"      ON "Reservations" ("DriverId");
CREATE INDEX "IX_Reservations_ParkingSlotId" ON "Reservations" ("ParkingSlotId");
CREATE INDEX "IX_Reservations_VehicleTypeId" ON "Reservations" ("VehicleTypeId");

-- ParkingSessions
CREATE INDEX "IX_ParkingSessions_DriverId"      ON "ParkingSessions" ("DriverId");
CREATE INDEX "IX_ParkingSessions_StaffId"        ON "ParkingSessions" ("StaffId");
CREATE INDEX "IX_ParkingSessions_ParkingSlotId"  ON "ParkingSessions" ("ParkingSlotId");
CREATE INDEX "IX_ParkingSessions_VehicleTypeId"  ON "ParkingSessions" ("VehicleTypeId");
CREATE INDEX "IX_ParkingSessions_ReservationId"  ON "ParkingSessions" ("ReservationId");

-- Payments
CREATE UNIQUE INDEX "IX_Payments_PayOSOrderCode"   ON "Payments" ("PayOSOrderCode");
CREATE        INDEX "IX_Payments_ParkingSessionId" ON "Payments" ("ParkingSessionId");
