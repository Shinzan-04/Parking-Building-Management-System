/**
 * pricingService.ts
 * Service cho PricingPolicies & PriceSettings — dùng cho Manager Portal
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

// ─── PricingPolicy (Chính sách tính giá theo block/giờ) ───────────────────────

export interface PricingPolicyResponse {
  id: string;
  vehicleTypeId: string;
  vehicleTypeName: string;
  blockPrice: number;       // Giá theo block (VD: 5.000đ / 15 phút)
  blockMinutes: number;     // Thời lượng 1 block (phút)
  hourlyRate: number;       // Giá theo giờ
  dailyMaxRate: number;     // Giá tối đa 1 ngày
  createdAt: string;
}

export interface CreatePricingPolicyRequest {
  vehicleTypeId: string;
  blockPrice: number;
  blockMinutes: number;
  hourlyRate: number;
  dailyMaxRate: number;
}

export interface UpdatePricingPolicyRequest {
  blockPrice: number;
  blockMinutes: number;
  hourlyRate: number;
  dailyMaxRate: number;
}

export const getAllPolicies = (): Promise<PricingPolicyResponse[]> =>
  apiFetch('/api/PricingPolicies');

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

// ─── PriceSetting (Bảng giá vé ngày/đêm) ─────────────────────────────────────

export interface PriceSettingResponse {
  id: string;
  vehicleTypeId: string;
  vehicleTypeName: string;
  dayPassPrice: number;     // Giá vé theo giờ ban ngày
  nightPassPrice: number;   // Giá vé theo giờ ban đêm
  dailyMaxPrice: number;    // Giá trần cả ngày
  dayStartHour: number;     // Bắt đầu giờ ban ngày (mặc định 6)
  nightStartHour: number;   // Bắt đầu giờ ban đêm (mặc định 18)
  updatedByName?: string;
  updatedAt?: string;
  createdAt: string;
}

export interface CreatePriceSettingRequest {
  vehicleTypeId: string;
  dayPassPrice: number;
  nightPassPrice: number;
  dailyMaxPrice: number;
  dayStartHour: number;
  nightStartHour: number;
}

export interface UpdatePriceSettingRequest {
  dayPassPrice: number;
  nightPassPrice: number;
  dailyMaxPrice: number;
  dayStartHour: number;
  nightStartHour: number;
}

export const getAllPriceSettings = (token: string): Promise<PriceSettingResponse[]> =>
  apiFetch('/api/PriceSettings', undefined, token);

export const getPriceSettingByVehicleType = (vehicleTypeId: string, token: string): Promise<PriceSettingResponse> =>
  apiFetch(`/api/PriceSettings/${vehicleTypeId}`, undefined, token);

export const createPriceSetting = (payload: CreatePriceSettingRequest, token: string): Promise<PriceSettingResponse> =>
  apiFetch('/api/PriceSettings', { method: 'POST', body: JSON.stringify(payload) }, token);

export const updatePriceSetting = (vehicleTypeId: string, payload: UpdatePriceSettingRequest, token: string): Promise<PriceSettingResponse> =>
  apiFetch(`/api/PriceSettings/${vehicleTypeId}`, { method: 'PUT', body: JSON.stringify(payload) }, token);

export const deletePriceSetting = (vehicleTypeId: string, token: string): Promise<void> =>
  apiFetch(`/api/PriceSettings/${vehicleTypeId}`, { method: 'DELETE' }, token);
