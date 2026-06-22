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
  const hubRef         = useRef<signalR.HubConnection | null>(null);
  const tokenRef       = useRef(token);
  const unreadCountRef = useRef(0);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { unreadCountRef.current = unreadCount; }, [unreadCount]);

  const fetchAll = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;
    setLoading(true);
    try {
      const [notiRes, countRes] = await Promise.all([
        getNotifications(t, 1, 20),
        getUnreadCount(t),
      ]);
      const items = Array.isArray(notiRes.items) ? notiRes.items : [];
      setNotifications(items);
      setUnreadCount(countRes.unreadCount);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []); // không depend vào token — đọc qua ref

  const handleMarkAsRead = useCallback(async (id: string) => {
    const t = tokenRef.current;
    if (!t) return;
    try {
      await markAsRead(id, t);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // silently ignore
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;
    // Không làm gì nếu không có unread
    if (unreadCountRef.current === 0) return;
    // Optimistic update ngay trước khi gọi API
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await markAllAsRead(t);
    } catch (err) {
      console.error('[Notification] markAllAsRead thất bại:', err);
      // Rollback nếu API lỗi — fetch lại từ server
      fetchAll();
    }
  }, [fetchAll]);

  // Initial load — chỉ chạy 1 lần khi token xuất hiện
  useEffect(() => {
    if (!token) return;
    fetchAll();
  }, [token, fetchAll]);

  // SignalR — chỉ tạo lại connection khi token thay đổi
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const hub = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/parking-hub`, {
        accessTokenFactory: () => tokenRef.current ?? '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    hub.on('ReceiveNotification', async () => {
      // Chỉ prepend notification mới (chưa có trong list) — không reset toàn bộ
      const t = tokenRef.current;
      if (!t) return;
      try {
        const [notiRes, countRes] = await Promise.all([
          getNotifications(t, 1, 5),
          getUnreadCount(t),
        ]);
        const fresh = Array.isArray(notiRes.items) ? notiRes.items : [];
        setUnreadCount(countRes.unreadCount);
        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const brandNew = fresh.filter(n => !existingIds.has(n.id));
          return brandNew.length > 0 ? [...brandNew, ...prev] : prev;
        });
      } catch {
        // silently ignore
      }
    });

    hub.on('ReceiveDashboardUpdate', () => {
      window.dispatchEvent(new CustomEvent('dashboardUpdate'));
    });

    hub.on('ReceiveSlotUpdate', (data: { slotId: string; status: string }) => {
      window.dispatchEvent(new CustomEvent('slotUpdate', { detail: data }));
    });

    hub.on('ReceiveWalletUpdate', (newBalance: number) => {
      window.dispatchEvent(new CustomEvent('walletUpdate', { detail: { balance: newBalance } }));
    });

    const timer = setTimeout(() => {
      if (cancelled) return;
      hub.start()
        .then(() => {
          if (cancelled) { hub.stop(); return; }
          hubRef.current = hub;
        })
        .catch(() => { /* silently ignore */ });
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      hub.stop();
    };
  }, [token]); // chỉ depend vào token, không depend vào callbacks

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications: fetchAll,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
  };
}
