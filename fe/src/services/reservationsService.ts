const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

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

async function authFetch<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
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
  try { data = JSON.parse(text); } catch { throw new Error('Phản hồi từ máy chủ không hợp lệ.'); }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('sp_token');
      localStorage.removeItem('sp_user');
      window.location.replace('/auth');
    }
    throw new Error((data as { message?: string }).message ?? `Yêu cầu thất bại (${res.status}).`);
  }
  return data as T;
}

export interface CreateReservationRequest {
  vehicleId: string;
  parkingSlotId?: string;
  buildingId?: string;
  startTime: string;
  endTime: string;
  bookingMethod?: number; // 0 = Manual, 1 = AIRecommended
}

export const getMyReservations = (token: string): Promise<ReservationResponse[]> =>
  authFetch('/api/reservations/my-reservations', token);

export const cancelReservation = (id: string, token: string): Promise<void> =>
  authFetch(`/api/reservations/${id}/cancel`, token, { method: 'PUT' });

export const createReservation = (payload: CreateReservationRequest, token: string): Promise<ReservationResponse> =>
  authFetch('/api/reservations', token, { method: 'POST', body: JSON.stringify(payload) });

export const confirmPayment = (id: string, token: string): Promise<{ message: string }> =>
  authFetch(`/api/reservations/${id}/payment-success`, token, { method: 'PUT' });

export const failPayment = (id: string, token: string): Promise<{ message: string }> =>
  authFetch(`/api/reservations/${id}/payment-failed`, token, { method: 'PUT' });

export interface AiSuggestionResponse {
  slotId: string;
  slotNumber: string;
  floorId: string;
  floorName: string;
  score: number;
  reason: string;
}

export const getAiSuggestions = (vehicleTypeId: string, buildingId?: string, topN: number = 5, token?: string): Promise<AiSuggestionResponse[]> => {
  const params = new URLSearchParams();
  params.append('vehicleTypeId', vehicleTypeId);
  if (buildingId) params.append('buildingId', buildingId);
  params.append('topN', topN.toString());
  
  // ai-suggest can be public or authenticated, assuming authenticated if token is provided
  return authFetch(`/api/reservations/ai-suggest?${params.toString()}`, token || '');
}

// ─── Manager / Staff endpoints ────────────────────────────────────────────────

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  PaymentPending: 'Chờ thanh toán',
  Paid: 'Đã thanh toán',
  PendingReview: 'Chờ duyệt',
  Confirmed: 'Đã duyệt',
  CheckedIn: 'Đã vào bãi',
  Completed: 'Hoàn thành',
  Cancelled: 'Đã hủy',
  Rejected: 'Đã từ chối',
  NoShow: 'Quá hạn',
  PaymentFailed: 'Thanh toán lỗi'
};

export interface ReviewReservationRequest {
  isAccepted: boolean;
  reason?: string;
}

/** Lấy danh sách đặt chỗ đang Pending (Manager/Staff) */
export const getPendingReservations = (token: string): Promise<ReservationResponse[]> =>
  authFetch('/api/reservations/pending', token);

/** Duyệt hoặc từ chối đặt chỗ */
export const reviewReservation = (
  id: string,
  payload: ReviewReservationRequest,
  token: string,
): Promise<{ message: string }> =>
  authFetch(`/api/reservations/${id}/review`, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });