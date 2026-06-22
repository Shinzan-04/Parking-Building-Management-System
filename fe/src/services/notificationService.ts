const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

export interface NotificationResponse {
  id: string;
  title: string;
  message: string;
  type: string;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationResponse[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

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
    throw new Error(`Yêu cầu thất bại (${res.status}).`);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Phản hồi từ máy chủ không hợp lệ.');
  }

  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? `Yêu cầu thất bại (${res.status}).`);
  }
  return data as T;
}

// Backend không cấu hình camelCase nên trả PascalCase — normalize về camelCase
function normalizeNotification(n: Record<string, unknown>): NotificationResponse {
  return {
    id:          (n['id']          ?? n['Id'])          as string,
    title:       (n['title']       ?? n['Title']        ?? '') as string,
    message:     (n['message']     ?? n['Message']      ?? '') as string,
    type:        (n['type']        ?? n['Type']         ?? '') as string,
    referenceId: (n['referenceId'] ?? n['ReferenceId']  ?? null) as string | null,
    isRead:      Boolean(n['isRead'] ?? n['IsRead']),
    createdAt:   (n['createdAt']   ?? n['CreatedAt']    ?? '') as string,
  };
}

export const getNotifications = async (token: string, page = 1, pageSize = 20): Promise<NotificationListResponse> => {
  const raw = await apiFetch<unknown>(`/api/notifications?page=${page}&pageSize=${pageSize}`, undefined, token);
  // Backend trả array thẳng (không có wrapper)
  if (Array.isArray(raw)) {
    const items = (raw as Record<string, unknown>[]).map(normalizeNotification);
    return { items, totalCount: items.length, page, pageSize };
  }
  const obj = raw as Record<string, unknown> | null;
  const rawItems = (obj?.['items'] ?? obj?.['Items'] ?? []) as Record<string, unknown>[];
  return {
    items:      rawItems.map(normalizeNotification),
    totalCount: (obj?.['totalCount'] ?? obj?.['TotalCount'] ?? 0) as number,
    page:       (obj?.['page']       ?? obj?.['Page']       ?? page) as number,
    pageSize:   (obj?.['pageSize']   ?? obj?.['PageSize']   ?? pageSize) as number,
  };
};

export const getUnreadCount = async (token: string): Promise<UnreadCountResponse> => {
  const raw = await apiFetch<unknown>('/api/notifications/unread-count', undefined, token);
  if (typeof raw === 'number') return { unreadCount: raw };
  const obj = raw as Record<string, unknown> | null;
  return { unreadCount: ((obj?.['unreadCount'] ?? obj?.['UnreadCount']) as number) ?? 0 };
};

export const markAsRead = (id: string, token: string): Promise<{ message: string }> =>
  apiFetch(`/api/notifications/${id}/read`, { method: 'PUT' }, token);

export const markAllAsRead = (token: string): Promise<{ message: string }> =>
  apiFetch('/api/notifications/read-all', { method: 'PUT' }, token);
