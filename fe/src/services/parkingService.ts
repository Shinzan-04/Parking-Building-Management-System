/**
 * parkingService.ts
 * Service mở rộng cho ParkingSlots — dùng cho Manager Portal
 * Bao gồm: CRUD slot, cập nhật trạng thái, thống kê theo tầng
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

// ─── Enums (khớp với backend ParkingEnums.cs) ─────────────────────────────────

export type SlotStatus = 'Available' | 'Occupied' | 'Reserved' | 'Maintenance';

export const SLOT_STATUS_LABELS: Record<SlotStatus, string> = {
  Available:   'Còn trống',
  Occupied:    'Đang sử dụng',
  Reserved:    'Đã đặt trước',
  Maintenance: 'Bảo trì',
};

export const SLOT_STATUS_COLORS: Record<SlotStatus, { bg: string; text: string; dot: string }> = {
  Available:   { bg: 'bg-[#3BFFA4]/10', text: 'text-[#3BFFA4]',  dot: 'bg-[#3BFFA4]' },
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
  Occupied:    1,
  Reserved:    2,
  Maintenance: 3,
};

export const SLOT_STATUS_FROM_ENUM: Record<number, SlotStatus> = {
  0: 'Available',
  1: 'Occupied',
  2: 'Reserved',
  3: 'Maintenance',
};

// ─── Helper ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text.trim()) {
    if (res.ok) return undefined as T;
    throw new Error(`Yêu cầu thất bại (${res.status}).`);
  }

  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('Phản hồi không hợp lệ.'); }

  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? `Yêu cầu thất bại (${res.status}).`);
  }
  return data as T;
}

// ─── ParkingSlots API ─────────────────────────────────────────────────────────

/** Lấy tất cả slots */
export const getAllSlots = (): Promise<ParkingSlotDetail[]> =>
  apiFetch('/api/parkingslots');

/** Lấy slots theo tầng */
export const getSlotsByFloor = (floorId: string): Promise<ParkingSlotDetail[]> =>
  apiFetch(`/api/parkingslots/floor/${floorId}`);

/** Lấy slots còn trống theo loại xe */
export const getAvailableSlotsByVehicleType = (vehicleTypeId: string): Promise<ParkingSlotDetail[]> =>
  apiFetch(`/api/parkingslots/available/${vehicleTypeId}`);

/** Tạo slot mới */
export const createSlot = (payload: CreateSlotRequest, token: string): Promise<ParkingSlotDetail> =>
  apiFetch('/api/parkingslots', { method: 'POST', body: JSON.stringify(payload) }, token);

/** Cập nhật trạng thái slot (PATCH) */
export const updateSlotStatus = (
  slotId: string,
  status: SlotStatus,
  token: string,
): Promise<ParkingSlotDetail> =>
  apiFetch(
    `/api/parkingslots/${slotId}/status`,
    { method: 'PATCH', body: JSON.stringify({ status: SLOT_STATUS_ENUM[status] }) },
    token,
  );

/** Xoá slot */
export const deleteSlot = (slotId: string, token: string): Promise<void> =>
  apiFetch(`/api/parkingslots/${slotId}`, { method: 'DELETE' }, token);

/** Gợi ý slot AI cho loại xe */
export const getRecommendedSlots = (vehicleTypeId: string, top = 5): Promise<{
  totalRecommendations: number;
  slots: SlotRecommendation[];
}> =>
  apiFetch(`/api/checkin/recommend-slots/${vehicleTypeId}?top=${top}`);
