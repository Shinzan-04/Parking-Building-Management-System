import { useState, useEffect, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  type NotificationResponse,
} from '../services/notificationService';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

export function useNotification(token: string | null) {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(false);
  const hubRef = useRef<signalR.HubConnection | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getUnreadCount(token);
      setUnreadCount(res.unreadCount);
    } catch {
      // silently ignore — badge stays at last known count
    }
  }, [token]);

  const fetchNotifications = useCallback(async (page = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getNotifications(token, page);
      const items = Array.isArray(res.items) ? res.items : [];
      setNotifications(page === 1 ? items : prev => [...prev, ...items]);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleMarkAsRead = useCallback(async (id: string) => {
    if (!token) return;
    try {
      await markAsRead(id, token);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n),
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // silently ignore
    }
  }, [token]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (!token) return;
    try {
      await markAllAsRead(token);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // silently ignore
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    if (!token) return;
    fetchNotifications();
    fetchUnreadCount();
  }, [token, fetchNotifications, fetchUnreadCount]);

  // SignalR connection
  useEffect(() => {
    if (!token) return;

    // Cờ để phát hiện React Strict Mode cleanup chạy trước khi connect xong
    let cancelled = false;

    const hub = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/parking-hub`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    hub.on('ReceiveNotification', () => {
      // New notification pushed — refresh unread badge and prepend to list
      fetchUnreadCount();
      fetchNotifications(1);
    });

    // Phát sự kiện toàn cục để các màn hình khác (Dashboard, SlotList) bắt lấy
    hub.on('ReceiveDashboardUpdate', () => {
      window.dispatchEvent(new CustomEvent('dashboardUpdate'));
    });

    hub.on('ReceiveSlotUpdate', (data: { slotId: string, status: string }) => {
      window.dispatchEvent(new CustomEvent('slotUpdate', { detail: data }));
    });

    hub.on('ReceiveWalletUpdate', (newBalance: number) => {
      window.dispatchEvent(new CustomEvent('walletUpdate', { detail: { balance: newBalance } }));
    });

    // Dùng setTimeout nhỏ để tránh lỗi "connection stopped during negotiation" 
    // do React Strict Mode unmount ngay lập tức khi vừa mount
    const timer = setTimeout(() => {
      if (cancelled) return;

      hub.start()
        .then(() => {
          if (cancelled) {
            hub.stop();
            return;
          }
          hubRef.current = hub;
          console.log('[SignalR] Kết nối thành công');
        })
        .catch((err) => {
          if (!cancelled) {
            console.error('[SignalR] Kết nối thất bại:', err);
          }
        });
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      hub.stop();
    };
  }, [token, fetchUnreadCount, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
  };
}
