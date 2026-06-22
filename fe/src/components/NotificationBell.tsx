import { Component, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { useNotification } from '../hooks/useNotification';
import type { NotificationResponse } from '../services/notificationService';

// ── Error boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '12px 16px', fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={14} />
          Lỗi hiển thị thông báo
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
interface Props {
  token: string | null;
  accentColor?: string;
}

function timeAgo(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    // Đảm bảo parse đúng UTC — backend trả ISO string không có 'Z' suffix
    const normalized = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
    const diff = Date.now() - new Date(normalized).getTime();
    if (isNaN(diff) || diff < 0) return 'vừa xong';
    const mins = Math.floor(diff / 60_000);
    if (mins < 1)  return 'vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs} giờ trước`;
    return `${Math.floor(hrs / 24)} ngày trước`;
  } catch {
    return '';
  }
}

// ── Panel (inner) ─────────────────────────────────────────────────────────────
function NotificationPanel({
  notifications,
  unreadCount,
  loading,
  accentColor,
  onMarkAsRead,
  onMarkAllAsRead,
  panelRef,
  top,
  right,
}: {
  notifications: NotificationResponse[];
  unreadCount: number;
  loading: boolean;
  accentColor: string;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  panelRef: React.RefObject<HTMLDivElement | null>;
  top: number;
  right: number;
}) {
  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top,
        right,
        width: 320,
        maxHeight: 420,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
        backgroundColor: 'var(--admin-bg-surface)',
        border: '1px solid var(--admin-border)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--admin-border)', flexShrink: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--admin-text-primary)' }}>
          Thông báo
          {unreadCount > 0 && (
            <span style={{ backgroundColor: accentColor, color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 6px' }}>
              {unreadCount}
            </span>
          )}
        </span>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllAsRead}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: accentColor, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <CheckCheck size={13} />
            Đọc tất cả
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading && notifications.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '32px 0', fontSize: 12, color: 'var(--admin-text-faint)', margin: 0 }}>
            Đang tải...
          </p>
        ) : notifications.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '32px 0', fontSize: 12, color: 'var(--admin-text-faint)', margin: 0 }}>
            Không có thông báo nào.
          </p>
        ) : (
          notifications.map(n => (
            <button
              key={n.id}
              onClick={() => { if (!n.isRead) onMarkAsRead(n.id); }}
              style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '10px 16px', cursor: 'pointer', background: 'none', border: 'none', borderBottom: '1px solid var(--admin-border)', color: 'inherit' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--admin-bg-card)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span style={{ marginTop: 4, width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: !n.isRead ? accentColor : 'transparent' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: !n.isRead ? 600 : 400, color: 'var(--admin-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.title ?? ''}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--admin-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.message ?? ''}
                </p>
                {n.createdAt && (
                  <p style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--admin-text-faint)' }}>
                    <Clock size={10} />
                    {timeAgo(n.createdAt)}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NotificationBell({ token, accentColor = '#FF4C4C' }: Props) {
  const [open, setOpen]   = useState(false);
  const [top, setTop]     = useState(0);
  const [right, setRight] = useState(0);
  const btnRef   = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotification(token);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t))   return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Close on scroll outside panel, or on resize
  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const handleBellClick = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setTop(r.bottom + 8);
      setRight(Math.max(8, window.innerWidth - r.right));
    }
    const opening = !open;
    setOpen(opening);
    // Khi mở panel: mark all as read (optimistic update trong hook)
    if (opening) {
      markAllAsRead();
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={handleBellClick}
        className="relative p-2 rounded-xl transition-colors"
        style={{ backgroundColor: 'var(--admin-bg-card)', color: 'var(--admin-text-muted)' }}
        title="Thông báo"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-0.5"
            style={{ backgroundColor: accentColor, boxShadow: '0 0 0 2px var(--admin-bg-base)' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <ErrorBoundary>
          <NotificationPanel
            notifications={notifications}
            unreadCount={unreadCount}
            loading={loading}
            accentColor={accentColor}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            panelRef={panelRef}
            top={top}
            right={right}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
