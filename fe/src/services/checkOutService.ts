import { apiClient } from './apiClient';

/**
 * checkOutService.ts
 * Service cho API CheckOut
 */



// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface FeeBreakdownDto {
  dayPassCount: number;
  nightPassCount: number;
  dayPassTotal: number;
  nightPassTotal: number;
  totalFee: number;
  surchargeLogs?: {
    name: string;
    timestamp: string;
    amount: number;
  }[];
}

export interface CheckOutSearchResult {
  sessionId: string;
  sessionCode: string;
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
  sessionCode: string;
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
export const searchCheckOut = (licensePlate: string, buildingId?: string): Promise<CheckOutSearchResult> => {
  let url = `/api/CheckOut/search?licensePlate=${encodeURIComponent(licensePlate)}`;
  if (buildingId) {
    url += `&buildingId=${encodeURIComponent(buildingId)}`;
  }
  return apiClient(url);
};

/** Tìm kiếm xe đang gửi trong bãi theo mã QR */
export const searchCheckOutByQr = (qrCode: string, licensePlate: string, buildingId?: string, isLostTicket?: boolean): Promise<CheckOutSearchResult> => {
  let url = `/api/CheckOut/search?qrCode=${encodeURIComponent(qrCode)}&licensePlate=${encodeURIComponent(licensePlate)}`;
  if (buildingId) {
    url += `&buildingId=${encodeURIComponent(buildingId)}`;
  }
  if (isLostTicket) {
    url += `&isLostTicket=true`;
  }
  return apiClient(url);
};

/** Xác nhận thanh toán và cho xe ra bãi */
export const confirmCheckOut = (request: CheckOutConfirmRequest): Promise<CheckOutConfirmResponse> =>
  apiClient(`/api/CheckOut/confirm`, {
    method: 'POST',
    body: JSON.stringify(request),
  });

/** Xử lý check-out bằng OCR */
export const ocrCheckOut = (request: OcrCheckOutRequest): Promise<OcrCheckOutResult> =>
  apiClient(`/api/CheckOut/ocr-checkout`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
