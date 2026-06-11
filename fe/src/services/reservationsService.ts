const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

// ReservationStatus: Pending=0, Confirmed=1, CheckedIn=2, Cancelled=3, Completed=4, Rejected=5
export type ReservationStatus =
  | 'Pending' | 'Confirmed' | 'CheckedIn' | 'Cancelled' | 'Completed' | 'Rejected';

const STATUS_NUM_MAP: Record<number, ReservationStatus> = {
  0: 'Pending', 1: 'Confirmed', 2: 'CheckedIn', 3: 'Cancelled', 4: 'Completed', 5: 'Rejected',
};

export function normalizeReservationStatus(status: ReservationStatus | number): ReservationStatus {
  if (typeof status === 'number') return STATUS_NUM_MAP[status] ?? 'Pending';
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
  parkingSlotId: string;
  vehicleTypeId: string;
  licensePlate: string;
  startTime: string;
  endTime: string;
}

export const getMyReservations = (token: string): Promise<ReservationResponse[]> =>
  authFetch('/api/reservations/my-reservations', token);

export const cancelReservation = (id: string, token: string): Promise<void> =>
  authFetch(`/api/reservations/${id}/cancel`, token, { method: 'PUT' });

export const createReservation = (payload: CreateReservationRequest, token: string): Promise<ReservationResponse> =>
  authFetch('/api/reservations', token, { method: 'POST', body: JSON.stringify(payload) });

// ─── Manager / Staff endpoints ────────────────────────────────────────────────

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  Pending:   'Chờ duyệt',
  Confirmed: 'Đã duyệt',
  CheckedIn: 'Đã vào bãi',
  Cancelled: 'Đã hủy',
  Completed: 'Hoàn thành',
  Rejected:  'Đã từ chối',
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