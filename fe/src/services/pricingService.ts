/**
 * pricingService.ts
 * Service cho PricingPolicies — dùng cho Manager/Admin Portal
 *
 * PriceSetting đã bị gộp vào PricingPolicy kể từ migration 20260622100041.
 * Tất cả fields (cũ + block ngày/đêm mới) đều nằm trong PricingPolicyResponse.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

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
  if (!text.trim()) { if (res.ok) return undefined as T; throw new Error(`Lỗi ${res.status}.`); }
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('Phản hồi không hợp lệ.'); }
  if (!res.ok) throw new Error((data as { message?: string }).message ?? `Lỗi ${res.status}.`);
  return data as T;
}

// ─── PricingPolicy ─────────────────────────────────────────────────────────────
// Chứa cả chính sách giá cũ (block/giờ/ngày) lẫn block ngày/đêm mới (dùng cho Booking)

export interface PricingPolicyResponse {
  id: string;
  vehicleTypeId: string;
  vehicleTypeName: string;

  // Giá cũ — dùng cho checkout Parking thường
  blockPrice: number;       // Giá mỗi block
  hourlyRate: number;       // Giá theo giờ
  dailyMaxRate: number;     // Giá tối đa 1 ngày

  // Block Ngày/Đêm — dùng cho Booking
  blockDurationHours: number;   // Thời lượng 1 block (giờ, mặc định 4)
  dayBlockRate: number;          // Giá block ban ngày
  nightBlockRate: number;        // Giá block ban đêm
  nightStartHour: number;        // Giờ bắt đầu đêm (mặc định 22)
  nightEndHour: number;          // Giờ kết thúc đêm / bắt đầu ngày (mặc định 6)
  dailyRate: number;             // Giá trọn ngày
  overtimeMultiplier: number;    // Hệ số tính phí overtime (mặc định 1.5)

  createdAt: string;
}

export interface CreatePricingPolicyRequest {
  vehicleTypeId: string;

  // Cũ
  blockPrice: number;
  hourlyRate: number;
  dailyMaxRate: number;

  // Mới
  blockDurationHours: number;
  dayBlockRate: number;
  nightBlockRate: number;
  nightStartHour: number;
  nightEndHour: number;
  dailyRate: number;
  overtimeMultiplier: number;
}

export interface UpdatePricingPolicyRequest {
  // Cũ
  blockPrice: number;
  hourlyRate: number;
  dailyMaxRate: number;

  // Mới
  blockDurationHours: number;
  dayBlockRate: number;
  nightBlockRate: number;
  nightStartHour: number;
  nightEndHour: number;
  dailyRate: number;
  overtimeMultiplier: number;
}

export const getAllPolicies = (token?: string): Promise<PricingPolicyResponse[]> =>
  apiFetch('/api/PricingPolicies', undefined, token);

export const getPolicyById = (id: string): Promise<PricingPolicyResponse> =>
  apiFetch(`/api/PricingPolicies/${id}`);

export const getPolicyByVehicleType = (vehicleTypeId: string): Promise<PricingPolicyResponse> =>
  apiFetch(`/api/PricingPolicies/vehicle-type/${vehicleTypeId}`);

export const createPolicy = (payload: CreatePricingPolicyRequest, token: string): Promise<PricingPolicyResponse> =>
  apiFetch('/api/PricingPolicies', { method: 'POST', body: JSON.stringify(payload) }, token);

export const updatePolicy = (id: string, payload: UpdatePricingPolicyRequest, token: string): Promise<PricingPolicyResponse> =>
  apiFetch(`/api/PricingPolicies/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token);

export const deletePolicy = (id: string, token: string): Promise<void> =>
  apiFetch(`/api/PricingPolicies/${id}`, { method: 'DELETE' }, token);
