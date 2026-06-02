import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Car, Clock, CheckCircle2, QrCode, CalendarClock, Banknote, History, Loader2, AlertTriangle, XCircle } from 'lucide-react';
import {
  getMyReservations, cancelReservation, normalizeReservationStatus,
  type ReservationResponse,
} from '../../services/reservationsService';

const STATUS_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  Pending:    { label: 'Chờ duyệt',  bg: 'bg-amber-400/10',  text: 'text-amber-400'  },
  Confirmed:  { label: 'Đã xác nhận', bg: 'bg-[#3BFFA4]/10', text: 'text-[#3BFFA4]' },
  CheckedIn:  { label: 'Đang đỗ',    bg: 'bg-[#00C2FF]/10',  text: 'text-[#00C2FF]' },
  Cancelled:  { label: 'Đã huỷ',     bg: 'bg-white/5',       text: 'text-white/40'  },
  Completed:  { label: 'Hoàn thành', bg: 'bg-white/5',       text: 'text-white/50'  },
  Rejected:   { label: 'Từ chối',    bg: 'bg-red-400/10',    text: 'text-red-400'   },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('vi-VN'),
    time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [cancelling, setCancelling]     = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    getMyReservations(token)
      .then(setReservations)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleLogout = () => { logout(); navigate('/auth'); };

  const handleCancel = async (id: string) => {
    if (!token || cancelling) return;
    setCancelling(id);
    try {
      await cancelReservation(id, token);
      setReservations(prev =>
        prev.map(r => r.id === id ? { ...r, status: 'Cancelled' as const } : r)
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không thể huỷ đặt chỗ.');
    } finally {
      setCancelling(null);
    }
  };

  const activeReservation = reservations.find(r => {
    const s = normalizeReservationStatus(r.status);
    return s === 'Pending' || s === 'Confirmed';
  });

  const checkedIn = reservations.filter(r => normalizeReservationStatus(r.status) === 'CheckedIn').length;
  const activeCount = reservations.filter(r => {
    const s = normalizeReservationStatus(r.status);
    return s === 'Pending' || s === 'Confirmed';
  }).length;

  const initials = user?.fullName?.charAt(0)?.toUpperCase() ?? 'U';

  return (
    <div className="min-h-screen bg-[#101A31] text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0B1120]/90 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4] flex items-center justify-center">
            <Car size={18} className="text-[#101A31]" />
          </div>
          <span className="text-sm font-bold">ParkingSystem</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4] flex items-center justify-center text-[#101A31] font-bold text-xs">
              {initials}
            </div>
            <span className="text-sm text-white/80 font-medium hidden sm:block">{user?.fullName ?? 'User'}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut size={16} />
            <span className="hidden sm:block">Đăng xuất</span>
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Welcome + QR */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 glass-card p-6 rounded-2xl">
            <p className="text-sm text-white/50 mb-1">Xin chào,</p>
            <h2 className="text-2xl font-bold text-white mb-1">{user?.fullName ?? 'Người dùng'}</h2>
            <p className="text-sm text-white/40">Chào mừng trở lại SmartPark</p>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xl font-bold text-[#00C2FF]">{reservations.length}</p>
                <p className="text-xs text-white/40 mt-0.5">Tổng đặt chỗ</p>
              </div>
              <div className="text-center border-x border-white/10">
                <p className="text-xl font-bold text-[#3BFFA4]">{checkedIn}</p>
                <p className="text-xs text-white/40 mt-0.5">Đang đỗ</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-amber-400">{activeCount}</p>
                <p className="text-xs text-white/40 mt-0.5">Chờ / xác nhận</p>
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div className="glass-card p-6 rounded-2xl flex flex-col items-center justify-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/5">
              <QrCode size={20} className="text-[#00C2FF]" />
            </div>
            <p className="text-sm font-medium text-white">Mã QR của bạn</p>
            {user?.qrCodeImageBase64 ? (
              <img
                src={`data:image/png;base64,${user.qrCodeImageBase64}`}
                alt="QR Code"
                className="w-24 h-24 rounded-xl"
              />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <QrCode size={40} className="text-white/20" />
              </div>
            )}
            <p className="text-xs text-white/30 font-mono">{user?.qrCode ?? '—'}</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl">
            <AlertTriangle size={15} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Active reservation */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock size={18} className="text-[#00C2FF]" />
            <h3 className="text-base font-semibold text-white">Đặt chỗ sắp tới</h3>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-4 text-white/40 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Đang tải...
            </div>
          ) : activeReservation ? (
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-[#00C2FF]/20">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const s = normalizeReservationStatus(activeReservation.status);
                    const cfg = STATUS_LABEL[s] ?? STATUS_LABEL.Pending;
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {cfg.label}
                      </span>
                    );
                  })()}
                  <span className="text-xs text-white/40 font-mono">{activeReservation.bookingCode}</span>
                </div>
                <p className="text-sm font-medium text-white">
                  Chỗ {activeReservation.slotNumber} · {activeReservation.licensePlate}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-white/50">
                  <Clock size={11} />
                  {fmtDate(activeReservation.startTime).date} {fmtDate(activeReservation.startTime).time}
                  {' → '}
                  {fmtDate(activeReservation.endTime).time}
                </div>
              </div>
              <button
                onClick={() => handleCancel(activeReservation.id)}
                disabled={cancelling === activeReservation.id}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-400/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                {cancelling === activeReservation.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Huỷ đặt chỗ
              </button>
            </div>
          ) : (
            <p className="text-sm text-white/40 py-2">Không có đặt chỗ sắp tới.</p>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Tổng đặt chỗ',     value: reservations.length, unit: 'lần',  color: '#00C2FF', icon: History        },
            { label: 'Chờ / xác nhận',   value: activeCount,          unit: 'chỗ',  color: '#F59E0B', icon: CalendarClock  },
            { label: 'Đang đỗ xe',        value: checkedIn,            unit: 'xe',   color: '#A78BFA', icon: Car            },
            { label: 'Hoàn thành',        value: reservations.filter(r => normalizeReservationStatus(r.status) === 'Completed').length, unit: 'lần', color: '#3BFFA4', icon: Banknote },
          ].map(({ label, value, unit, color, icon: Icon }) => (
            <div key={label} className="glass-card p-5 rounded-2xl">
              <div className="p-2 rounded-xl w-fit mb-3" style={{ background: `${color}20` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <p className="text-2xl font-bold text-white">
                {value}
                <span className="text-xs font-normal text-white/40 ml-1">{unit}</span>
              </p>
              <p className="text-xs text-white/50 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Reservation history */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
            <History size={16} className="text-[#00C2FF]" />
            <h3 className="text-base font-semibold text-white">Lịch sử đặt chỗ</h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-white/40 text-sm">
              <Loader2 size={18} className="animate-spin" />
              Đang tải dữ liệu...
            </div>
          ) : reservations.length === 0 ? (
            <p className="text-center py-12 text-sm text-white/30">Chưa có đặt chỗ nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-xs font-medium text-white/40 px-6 py-3">Mã đặt chỗ</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Biển số / Chỗ</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Bắt đầu</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Kết thúc</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Trạng thái</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) => {
                    const statusStr = normalizeReservationStatus(r.status);
                    const cfg = STATUS_LABEL[statusStr] ?? STATUS_LABEL.Pending;
                    const start = fmtDate(r.startTime);
                    const end   = fmtDate(r.endTime);
                    const canCancel = statusStr === 'Pending' || statusStr === 'Confirmed';
                    return (
                      <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                        <td className="px-6 py-3.5">
                          <span className="text-xs font-mono text-white/60">{r.bookingCode}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-medium text-white font-mono">{r.licensePlate}</p>
                          <p className="text-xs text-white/40 mt-0.5">Chỗ {r.slotNumber}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-sm text-white/70">
                            <Clock size={11} className="text-white/30" />{start.time}
                          </div>
                          <p className="text-xs text-white/30 mt-0.5">{start.date}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-sm text-white/70">{end.time}</div>
                          <p className="text-xs text-white/30 mt-0.5">{end.date}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                            {statusStr === 'CheckedIn' && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                            {statusStr !== 'CheckedIn' && <CheckCircle2 size={10} />}
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {canCancel && (
                            <button
                              onClick={() => handleCancel(r.id)}
                              disabled={cancelling === r.id}
                              className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-40"
                              title="Huỷ đặt chỗ"
                            >
                              {cancelling === r.id ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}