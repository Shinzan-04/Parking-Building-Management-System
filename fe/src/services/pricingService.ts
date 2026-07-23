import { apiClient } from './apiClient';

/**
 * pricingService.ts
 * Service cho PricingPolicies — dùng cho Manager/Admin Portal
 *
 * PriceSetting đã bị gộp vào PricingPolicy kể từ migration 20260622100041.
 * Tất cả fields (cũ + block ngày/đêm mới) đều nằm trong PricingPolicyResponse.
 */



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

  // Versioning — thêm từ migration AddPricingPolicyVersioning
  version: number;               // Số phiên bản (1, 2, 3,...)
  isActive: boolean;             // Chính sách đang có hiệu lực
  effectiveDate: string;         // Ngày bắt đầu có hiệu lực (ISO string)
  previousVersionId: string | null; // ID phiên bản trước đó

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

export const getAllPolicies = (): Promise<PricingPolicyResponse[]> =>
  apiClient('/api/PricingPolicies');

export const getPolicyById = (id: string): Promise<PricingPolicyResponse> =>
  apiClient(`/api/PricingPolicies/${id}`);

export const getPolicyByVehicleType = (vehicleTypeId: string): Promise<PricingPolicyResponse> =>
  apiClient(`/api/PricingPolicies/vehicle-type/${vehicleTypeId}`);

export const createPolicy = (payload: CreatePricingPolicyRequest): Promise<PricingPolicyResponse> =>
  apiClient('/api/PricingPolicies', { method: 'POST', body: JSON.stringify(payload) });

export const updatePolicy = (id: string, payload: UpdatePricingPolicyRequest): Promise<PricingPolicyResponse> =>
  apiClient(`/api/PricingPolicies/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const deletePolicy = (id: string): Promise<void> =>
  apiClient(`/api/PricingPolicies/${id}`, { method: 'DELETE' });
