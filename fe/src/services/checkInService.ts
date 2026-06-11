const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

export interface WalkInRequest {
  licensePlate: string;
  vehicleTypeId: string;
  staffId?: string;
  slotId?: string;
}

export interface CheckInResult {
  sessionId: string;
  sessionCode: string;
  sessionQrCodeBase64?: string;
  licensePlate: string;
  slotNumber: string;
  floorName: string;
  vehicleTypeName: string;
  isAIAssigned: boolean;
  entryTime: string;
  message: string;
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
    throw new Error((data as { message?: string }).message ?? `Yêu cầu thất bại (${res.status}).`);
  }
  return data as T;
}

export const checkInWalkIn = (payload: WalkInRequest, token: string): Promise<CheckInResult> =>
  authFetch('/api/checkin/walk-in', token, { method: 'POST', body: JSON.stringify(payload) });