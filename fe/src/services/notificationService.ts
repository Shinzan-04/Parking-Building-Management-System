import { apiClient } from './apiClient';

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

export const getNotifications = async (page = 1, pageSize = 20): Promise<NotificationListResponse> => {
  const raw = await apiClient<unknown>(`/api/notifications?page=${page}&pageSize=${pageSize}`);
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

export const getUnreadCount = async (): Promise<UnreadCountResponse> => {
  const raw = await apiClient<unknown>('/api/notifications/unread-count');
  if (typeof raw === 'number') return { unreadCount: raw };
  const obj = raw as Record<string, unknown> | null;
  return { unreadCount: ((obj?.['unreadCount'] ?? obj?.['UnreadCount']) as number) ?? 0 };
};

export const markAsRead = (id: string): Promise<{ message: string }> =>
  apiClient(`/api/notifications/${id}/read`, { method: 'PUT' });

export const markAllAsRead = (): Promise<{ message: string }> =>
  apiClient('/api/notifications/read-all', { method: 'PUT' });
