/**
 * sessionsService.ts
 * Service cho Sessions API — dùng cho Manager Reports & Sessions management
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

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type SessionStatus   = 'Active' | 'Completed' | 'Overdue';
export type CheckInMethod   = 'WalkIn' | 'Booking';
export type IssueType       = 'None' | 'LostTicket' | 'WrongPlate' | 'WrongSlot' | 'Unpaid';

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  Active:    'Đang đỗ',
  Completed: 'Đã ra',
  Overdue:   'Quá giờ',
};

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  None:        'Bình thường',
  LostTicket:  'Mất vé',
  WrongPlate:  'Sai biển số',
  WrongSlot:   'Sai khu vực',
  Unpaid:      'Chưa thanh toán',
};

export interface SessionDto {
  id: string;
  sessionCode: string;
  licensePlate: string;
  checkInMethod: CheckInMethod;
  status: SessionStatus;
  issueType: IssueType;
  slotNumber: string;
  floorName: string;
  buildingName: string;
  vehicleTypeName: string;
  driverName?: string;
  staffName?: string;
  entryTime: string;
  exitTime?: string;
  estimatedFee: number;
  totalFee: number;
  duration: string;
  entryImageUrl?: string;
}

export interface SessionSummary {
  totalActive: number;
  totalOverdue: number;
  totalCompletedToday: number;
  totalRevenueToday: number;
}

export interface SessionListResponse {
  items: SessionDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: SessionSummary;
}

export interface SessionFilterParams {
  licensePlate?: string;
  status?: SessionStatus;
  buildingId?: string;
  floorId?: string;
  fromDate?: string;   // ISO string
  toDate?: string;     // ISO string
  page?: number;
  pageSize?: number;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

function buildQueryString(params: SessionFilterParams): string {
  const q = new URLSearchParams();
  if (params.licensePlate) q.set('licensePlate', params.licensePlate);
  if (params.status)       q.set('status', params.status);
  if (params.buildingId)   q.set('buildingId', params.buildingId);
  if (params.floorId)      q.set('floorId', params.floorId);
  if (params.fromDate)     q.set('fromDate', params.fromDate);
  if (params.toDate)       q.set('toDate', params.toDate);
  if (params.page)         q.set('page', String(params.page));
  if (params.pageSize)     q.set('pageSize', String(params.pageSize));
  return q.toString() ? `?${q.toString()}` : '';
}

/** Lấy danh sách session đang Active */
export const getActiveSessions = (params: SessionFilterParams, token: string): Promise<SessionListResponse> =>
  apiFetch(`/api/sessions/active${buildQueryString(params)}`, undefined, token);

/** Tìm kiếm session theo bộ lọc (bao gồm Completed) */
export const searchSessions = (params: SessionFilterParams, token: string): Promise<SessionListResponse> =>
  apiFetch(`/api/sessions/search${buildQueryString(params)}`, undefined, token);

/** Xem chi tiết 1 session */
export const getSessionById = (id: string, token: string): Promise<SessionDto> =>
  apiFetch(`/api/sessions/${id}`, undefined, token);

/** Tìm session Active theo biển số */
export const findSessionByPlate = (plate: string, token: string): Promise<SessionDto | null> =>
  apiFetch(`/api/sessions/find-by-plate?plate=${encodeURIComponent(plate)}`, undefined, token);
