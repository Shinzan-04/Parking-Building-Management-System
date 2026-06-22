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
  const hubRef   = useRef<signalR.HubConnection | null>(null);
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Fetch danh sách + unread count từ server (đọc đúng isRead từ DB)
  const fetchNotifications = useCallback(async () => {
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
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  // Chỉ lấy badge count — dùng lúc initial load
  const refreshCount = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;
    try {
      const res = await getUnreadCount(t);
      setUnreadCount(res.unreadCount);
    } catch { /* ignore */ }
  }, []);

  // Mark 1 notification đã đọc
  const handleMarkAsRead = useCallback(async (id: string) => {
    const t = tokenRef.current;
    if (!t) return;
    try {
      await markAsRead(id, t);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  }, []);

  // Mark tất cả đã đọc — update UI ngay, gọi API song song
  const handleMarkAllAsRead = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;
    // Optimistic: update UI ngay lập tức
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    // Gọi API để lưu vào DB — log rõ kết quả để debug
    markAllAsRead(t)
      .then(() => console.log('[Notification] markAllAsRead: DB updated OK'))
      .catch(err => console.error('[Notification] markAllAsRead: FAIL', err));
  }, []);

  // Initial load: chỉ lấy unread count để hiện badge, KHÔNG mark gì cả
  useEffect(() => {
    if (!token) return;
    refreshCount();
  }, [token, refreshCount]);

  // SignalR: nhận notification mới — cập nhật badge + prepend vào list nếu đang mở
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
      } catch { /* ignore */ }
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
        .then(() => { if (cancelled) { hub.stop(); return; } hubRef.current = hub; })
        .catch(() => { /* ignore */ });
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      hub.stop();
    };
  }, [token]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,   // gọi khi mở bell để load danh sách
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
  };
}
