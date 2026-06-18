-- Fix SlotNumber: Re-number all parking slots per floor using prefix from floor name
-- Format: {last word of floor name uppercase}-{3-digit padded index}
-- Example: "Tầng G" → G-001, G-002...  "Tầng 1" → 1-001, 1-002...
-- Run in DBeaver / pgAdmin

-- Preview first (SELECT only):
/*
SELECT
  ps."Id",
  f."Name" AS floor_name,
  ps."SlotNumber" AS old_number,
  UPPER(SPLIT_PART(TRIM(f."Name"), ' ', -1))
    || '-'
    || LPAD(ROW_NUMBER() OVER (PARTITION BY ps."FloorId" ORDER BY ps."CreatedAt")::text, 3, '0')
  AS new_number
FROM "ParkingSlots" ps
JOIN "Floors" f ON f."Id" = ps."FloorId"
WHERE ps."IsDeleted" = false
ORDER BY f."Name", ps."CreatedAt";
*/

-- UPDATE (run this after verifying preview):
UPDATE "ParkingSlots" ps
SET "SlotNumber" = sub.new_number
FROM (
  SELECT
    ps2."Id",
    UPPER(SPLIT_PART(TRIM(f."Name"), ' ', -1))
      || '-'
      || LPAD(ROW_NUMBER() OVER (PARTITION BY ps2."FloorId" ORDER BY ps2."CreatedAt")::text, 3, '0')
    AS new_number
  FROM "ParkingSlots" ps2
  JOIN "Floors" f ON f."Id" = ps2."FloorId"
  WHERE ps2."IsDeleted" = false
) sub
WHERE ps."Id" = sub."Id";

-- Verify result:
SELECT f."Name" AS floor, ps."SlotNumber", ps."Status"
FROM "ParkingSlots" ps
JOIN "Floors" f ON f."Id" = ps."FloorId"
WHERE ps."IsDeleted" = false
ORDER BY f."Name", ps."SlotNumber";
