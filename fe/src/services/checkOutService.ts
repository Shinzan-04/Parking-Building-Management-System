/**
 * checkOutService.ts
 * Service cho API CheckOut
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
  if (!text.trim()) {
    if (res.ok) return undefined as T;
    throw new Error(`Error ${res.status}.`);
  }
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid response.');
  }
  if (!res.ok) throw new Error(data.message ?? `Error ${res.status}.`);
  return data as T;
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface FeeBreakdownDto {
  dayPassCount: number;
  nightPassCount: number;
  dayPassTotal: number;
  nightPassTotal: number;
  totalFee: number;
}

export interface CheckOutSearchResult {
  sessionId: string;
  licensePlate: string;
  slotNumber: string;
  floorName: string;
  entryTime: string;
  estimatedExitTime: string;
  totalHours: number;
  vehicleTypeName: string;
  hourlyRate: number;
  estimatedFee: number;
  pricingModel: string;
  dayPassPrice?: number;
  nightPassPrice?: number;
  dailyMaxPrice?: number;
  feeBreakdown?: FeeBreakdownDto;
  message: string;
  isPlateMismatch?: boolean;
  penaltyFee?: number;
}

export interface CheckOutConfirmRequest {
  sessionId: string;
  staffId: string;
  paymentMethod?: number; // PaymentMethod Enum (Cash = 0)
  paymentAmount?: number;
  exitLicensePlateOcr?: string;
  staffConfirmed?: boolean;
}

export interface CheckOutConfirmResponse {
  sessionId: string;
  licensePlate: string;
  slotNumber: string;
  floorName: string;
  entryTime: string;
  exitTime: string;
  totalHours: number;
  hourlyRate: number;
  totalFee: number;
  pricingModel: string;
  dayPassPrice?: number;
  nightPassPrice?: number;
  dailyMaxPrice?: number;
  feeBreakdown?: FeeBreakdownDto;
  paymentAmount?: number;
  changeAmount?: number;
  paymentMethod: number;
  paymentId: string;
  message: string;
}

export interface OcrCheckOutRequest {
  imageBase64: string;
  staffId?: string;
  buildingId?: string;
}

export interface OcrCheckOutResult {
  sessionId: string;
  entryLicensePlate: string;
  exitLicensePlate: string;
  isMatch: boolean;
  matchStatus: string;
  slotNumber: string;
  floorName: string;
  entryTime: string;
  estimatedExitTime: string;
  totalHours: number;
  vehicleTypeName: string;
  hourlyRate: number;
  estimatedFee: number;
  pricingModel: string;
  dayPassPrice?: number;
  nightPassPrice?: number;
  dailyMaxPrice?: number;
  feeBreakdown?: FeeBreakdownDto;
  ocrConfidence: number;
  message: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

/** Tìm kiếm xe đang gửi trong bãi theo biển số (chuẩn hóa trên BE) */
export const searchCheckOut = (licensePlate: string, token: string, buildingId?: string): Promise<CheckOutSearchResult> => {
  let url = `/api/CheckOut/search?licensePlate=${encodeURIComponent(licensePlate)}`;
  if (buildingId) {
    url += `&buildingId=${encodeURIComponent(buildingId)}`;
  }
  return apiFetch(url, undefined, token);
};

/** Tìm kiếm xe đang gửi trong bãi theo mã QR */
export const searchCheckOutByQr = (qrCode: string, licensePlate: string, token: string, buildingId?: string): Promise<CheckOutSearchResult> => {
  let url = `/api/CheckOut/search?qrCode=${encodeURIComponent(qrCode)}&licensePlate=${encodeURIComponent(licensePlate)}`;
  if (buildingId) {
    url += `&buildingId=${encodeURIComponent(buildingId)}`;
  }
  return apiFetch(url, undefined, token);
};

/** Xác nhận thanh toán và cho xe ra bãi */
export const confirmCheckOut = (request: CheckOutConfirmRequest, token: string): Promise<CheckOutConfirmResponse> =>
  apiFetch(`/api/CheckOut/confirm`, {
    method: 'POST',
    body: JSON.stringify(request),
  }, token);

/** Xử lý check-out bằng OCR */
export const ocrCheckOut = (request: OcrCheckOutRequest, token: string): Promise<OcrCheckOutResult> =>
  apiFetch(`/api/CheckOut/ocr-checkout`, {
    method: 'POST',
    body: JSON.stringify(request),
  }, token);
