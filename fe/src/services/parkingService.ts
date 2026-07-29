import { apiClient } from './apiClient';

/**
 * parkingService.ts
 * Service mở rộng cho ParkingSlots — dùng cho Manager Portal
 * Bao gồm: CRUD slot, cập nhật trạng thái, thống kê theo tầng
 */


// ─── Enums (khớp với backend ParkingEnums.cs) ─────────────────────────────────

export type SlotStatus = 'Available' | 'TemporaryHeld' | 'Reserved' | 'Occupied' | 'Maintenance';

export const SLOT_STATUS_LABELS: Record<SlotStatus, string> = {
  Available:   'Available',
  TemporaryHeld: 'On Hold',
  Occupied:    'Occupied',
  Reserved:    'Reserved',
  Maintenance: 'Maintenance',
};

export const SLOT_STATUS_COLORS: Record<SlotStatus, { bg: string; text: string; dot: string }> = {
  Available:   { bg: 'bg-[#3BFFA4]/10', text: 'text-[#3BFFA4]',  dot: 'bg-[#3BFFA4]' },
  TemporaryHeld: { bg: 'bg-purple-400/10', text: 'text-purple-400', dot: 'bg-purple-400' },
  Occupied:    { bg: 'bg-[#00C2FF]/10', text: 'text-[#00C2FF]',  dot: 'bg-[#00C2FF]' },
  Reserved:    { bg: 'bg-amber-400/10', text: 'text-amber-400',   dot: 'bg-amber-400' },
  Maintenance: { bg: 'bg-red-400/10',   text: 'text-red-400',     dot: 'bg-red-400' },
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ParkingSlotDetail {
  id: string;
  floorId: string;
  floorName: string;
  vehicleTypeId: string;
  vehicleTypeName: string;
  slotNumber: string;
  status: SlotStatus;
  isAIRecommended: boolean;
  createdAt: string;
}

export interface CreateSlotRequest {
  floorId: string;
  vehicleTypeId: string;
  slotNumber: string;
}

export interface UpdateSlotStatusRequest {
  status: number; // Enum value: 0=Available, 1=Occupied, 2=Reserved, 3=Maintenance
}

export interface SlotRecommendation {
  slotId: string;
  floorId: string;
  slotNumber: string;
  floorName: string;
  floorIndex: number;
  row: number;
  column: number;
  distanceToEntry: number;
  score: number;
  reason: string;
}

// ─── Status numeric mapping (phải khớp với BE enum) ──────────────────────────

export const SLOT_STATUS_ENUM: Record<SlotStatus, number> = {
  Available:   0,
  TemporaryHeld: 1,
  Reserved:    2,
  Occupied:    3,
  Maintenance: 4,
};

export const SLOT_STATUS_FROM_ENUM: Record<number, SlotStatus> = {
  0: 'Available',
  1: 'TemporaryHeld',
  2: 'Reserved',
  3: 'Occupied',
  4: 'Maintenance',
};

// ─── Helper ───────────────────────────────────────────────────────────────────


// ─── ParkingSlots API ─────────────────────────────────────────────────────────

/** Lấy tất cả slots */
export const getAllSlots = (buildingId?: string): Promise<ParkingSlotDetail[]> => {
  const query = buildingId ? `?buildingId=${buildingId}` : '';
  return apiClient(`/api/parkingslots${query}`);
};

/** Lấy slots theo tầng (thực tế - vật lý) */
export const getSlotsByFloor = (floorId: string): Promise<ParkingSlotDetail[]> =>
  apiClient(`/api/parkingslots/floor/${floorId}`);

/** Lấy slots theo tầng có tính toán đặt chỗ tương lai */
export const getAvailableSlotsByFloor = (floorId: string, startTime: string, endTime: string): Promise<ParkingSlotDetail[]> =>
  apiClient(`/api/parkingslots/floor/${floorId}/availability?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`);

/** Lấy slots còn trống theo loại xe */
export const getAvailableSlotsByVehicleType = (vehicleTypeId: string): Promise<ParkingSlotDetail[]> =>
  apiClient(`/api/parkingslots/available/${vehicleTypeId}`);

/** Tạo slot mới */
export const createSlot = (payload: CreateSlotRequest): Promise<ParkingSlotDetail> =>
  apiClient('/api/parkingslots', { method: 'POST', body: JSON.stringify(payload) });

/** Cập nhật trạng thái slot (PATCH) — gửi integer vì backend dùng System.Text.Json mặc định */
export const updateSlotStatus = (
  slotId: string,
  status: SlotStatus,
): Promise<ParkingSlotDetail> =>
  apiClient(
    `/api/parkingslots/${slotId}/status`,
    { method: 'PATCH', body: JSON.stringify({ status: SLOT_STATUS_ENUM[status] }) },
  );

/** Xoá slot */
export const deleteSlot = (slotId: string): Promise<void> =>
  apiClient(`/api/parkingslots/${slotId}`, { method: 'DELETE' });

export const bulkUpdateSlotVehicleType = (slotIds: string[], vehicleTypeId: string): Promise<void> =>
  apiClient(`/api/parkingslots/bulk-update-vehicle-type`, {
    method: 'PATCH',
    body: JSON.stringify({ slotIds, vehicleTypeId }),
  });

/** Gợi ý slot AI cho loại xe */
export const getRecommendedSlots = (vehicleTypeId: string, top = 5): Promise<{
  totalRecommendations: number;
  slots: SlotRecommendation[];
}> =>
  apiClient(`/api/checkin/recommend-slots/${vehicleTypeId}?top=${top}`);
