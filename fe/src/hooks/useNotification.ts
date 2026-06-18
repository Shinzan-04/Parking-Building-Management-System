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

    const hub = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/parking-hub?access_token=${encodeURIComponent(token)}`)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    hub.on('ReceiveNotification', () => {
      // New notification pushed — refresh unread badge and prepend to list
      fetchUnreadCount();
      fetchNotifications(1);
    });

    hub.start().catch(() => {
      // Hub connection failed — REST polling still works; just no real-time push
    });

    hubRef.current = hub;

    return () => {
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
