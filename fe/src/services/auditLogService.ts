const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

export interface AuditLogDto {
  id: string;
  userId: string;
  actionType: string;
  entityName: string;
  entityId: string | null;
  oldValues: string | null;
  newValues: string | null;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
  userFullName: string | null;
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
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid response from server.');
  }

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

export const getAuditLogs = (token: string): Promise<AuditLogDto[]> =>
  authFetch('/api/AuditLogs', token);
