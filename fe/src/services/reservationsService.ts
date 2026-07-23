import { apiClient } from './apiClient';


export type ReservationStatus =
  | 'PaymentPending' | 'Paid' | 'PendingReview' | 'Confirmed' | 'CheckedIn' | 'Completed' | 'Cancelled' | 'Rejected' | 'NoShow' | 'PaymentFailed';

const STATUS_NUM_MAP: Record<number, ReservationStatus> = {
  0: 'PaymentPending', 1: 'Paid', 2: 'PendingReview', 3: 'Confirmed', 4: 'CheckedIn', 
  5: 'Completed', 6: 'Cancelled', 7: 'Rejected', 8: 'NoShow', 9: 'PaymentFailed'
};

export function normalizeReservationStatus(status: ReservationStatus | number): ReservationStatus {
  if (typeof status === 'number') return STATUS_NUM_MAP[status] ?? 'PaymentPending';
  return status;
}

export interface ReservationResponse {
  id: string;
  driverId: string;
  parkingSlotId: string;
  slotNumber: string;
  bookingCode: string;
  qrCodeBase64: string;
  licensePlate: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus | number;
  createdAt: string;
}


export interface CreateReservationRequest {
  vehicleId: string;
  parkingSlotId?: string;
  buildingId?: string;
  startTime: string;
  endTime: string;
  bookingMethod?: number; // 0 = Manual, 1 = AIRecommended
  paymentMethod?: number; // 0 = Wallet, 4 = PayOS
}

export const getMyReservations = (): Promise<ReservationResponse[]> =>
  apiClient('/api/reservations/my-reservations');

export const cancelReservation = (id: string): Promise<void> =>
  apiClient(`/api/reservations/${id}/cancel`, { method: 'PUT' });

export const createReservation = (payload: CreateReservationRequest): Promise<ReservationResponse> =>
  apiClient('/api/reservations', { method: 'POST', body: JSON.stringify(payload) });

export const confirmPayment = (id: string): Promise<{ message: string }> =>
  apiClient(`/api/reservations/${id}/payment-success`, { method: 'PUT' });

export const failPayment = (id: string): Promise<{ message: string }> =>
  apiClient(`/api/reservations/${id}/payment-failed`, { method: 'PUT' });

export interface AiSuggestionResponse {
  slotId: string;
  slotNumber: string;
  floorId: string;
  floorName: string;
  score: number;
  reason: string;
}

export const getAiSuggestions = (vehicleTypeId: string, buildingId?: string, topN: number = 5): Promise<AiSuggestionResponse[]> => {
  const params = new URLSearchParams();
  params.append('vehicleTypeId', vehicleTypeId);
  if (buildingId) params.append('buildingId', buildingId);
  params.append('topN', topN.toString());
  
  // ai-suggest can be public or authenticated, assuming authenticated if token is provided
  return apiClient(`/api/reservations/ai-suggest?${params.toString()}`);
}

// ─── Manager / Staff endpoints ────────────────────────────────────────────────

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  PaymentPending: 'Payment Pending',
  Paid: 'Paid',
  PendingReview: 'Pending Review',
  Confirmed: 'Confirmed',
  CheckedIn: 'Checked In',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  Rejected: 'Rejected',
  NoShow: 'No Show',
  PaymentFailed: 'Payment Failed'
};

export interface ReviewReservationRequest {
  isAccepted: boolean;
  reason?: string;
}

/** Lấy danh sách đặt chỗ đang Pending (Manager/Staff) */
export const getPendingReservations = (): Promise<ReservationResponse[]> =>
  apiClient('/api/reservations/pending');

/** Lấy tất cả danh sách đặt chỗ đang Active/Pending (để hiển thị và đổi chỗ) */
export const getAllActiveReservations = (): Promise<ReservationResponse[]> =>
  apiClient('/api/reservations/all-active');

/** Duyệt hoặc từ chối đặt chỗ */
export const reviewReservation = (
  id: string,
  payload: ReviewReservationRequest,
): Promise<{ message: string }> =>
  apiClient(`/api/reservations/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

/** Đổi chỗ thủ công cho khách (Staff/Manager) */
export const reassignSlot = (
  id: string,
  newSlotId: string,
): Promise<{ message: string }> =>
  apiClient(`/api/reservations/${id}/reassign-slot`, {
    method: 'PUT',
    body: JSON.stringify({ newSlotId }),
  });