/**
 * Manager/Reservations.tsx
 * Nhánh: Feature/ManageReservations-Manager
 * Quản lý đặt chỗ xe (Reservations) — duyệt / từ chối
 *
 * Tính năng:
 *  - Tab "Chờ duyệt" (Pending): danh sách yêu cầu cần xét duyệt
 *  - Tab "Tất cả": hiển thị tất cả reservations của tôi (phòng sau có thể mở rộng)
 *  - Modal duyệt: confirm Approve
 *  - Modal từ chối: form nhập lý do + confirm Reject
 *  - Badge trạng thái màu sắc
 *  - Tự động refresh sau khi duyệt/từ chối
 */

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarCheck, Check, X, Loader2, RefreshCw,
  AlertTriangle, Clock, MapPin, FileText,
  CheckCircle2, XCircle, ClipboardList,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getPendingReservations, reviewReservation,
  normalizeReservationStatus,
  RESERVATION_STATUS_LABELS,
} from '../../services/reservationsService';
import type { ReservationResponse, ReviewReservationRequest } from '../../services/reservationsService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  Pending:   'bg-amber-400/10 text-amber-400',
  Confirmed: 'bg-[#FF4C4C]/10 text-[#FF4C4C]',
  CheckedIn: 'bg-amber-500/10 text-amber-500',
  Cancelled: 'bg-white/10 text-white/50',
  Completed: 'bg-white/10 text-white/40',
  Rejected:  'bg-red-400/10 text-red-400',
};

function StatusBadge({ status }: { status: string }) {
  const label = RESERVATION_STATUS_LABELS[status] ?? status;
  const style = STATUS_STYLE[status] ?? 'bg-white/10 text-white/50';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

// ─── Reservation Card ─────────────────────────────────────────────────────────

function ReservationCard({
  r, onApprove, onReject,
}: {
  r: ReservationResponse;
  onApprove: (r: ReservationResponse) => void;
  onReject:  (r: ReservationResponse) => void;
}) {
  const status = normalizeReservationStatus(r.status);
  const isPending = status === 'Pending';

  return (
    <div className="glass-card p-5 rounded-2xl space-y-4 hover:border-white/20 transition-all">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 flex items-center justify-center shrink-0">
            <CalendarCheck size={18} className="text-[#FF4C4C]" />
          </div>
          <div>
            <p className="font-bold font-mono text-white text-base">{r.licensePlate}</p>
            <p className="text-xs text-white/40 mt-0.5">{r.bookingCode}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Info rows */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5 px-3 py-2 bg-white/[0.04] rounded-xl">
          <MapPin size={13} className="text-white/40 shrink-0" />
          <span className="text-xs text-white/70">Slot: <span className="font-semibold text-white">{r.slotNumber}</span></span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-start gap-2 px-3 py-2 bg-white/[0.04] rounded-xl">
            <Clock size={12} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Bắt đầu</p>
              <p className="text-xs text-white font-medium">{fmtDateTime(r.startTime)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 px-3 py-2 bg-white/[0.04] rounded-xl">
            <Clock size={12} className="text-[#FF4C4C] shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Kết thúc</p>
              <p className="text-xs text-white font-medium">{fmtDateTime(r.endTime)}</p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-white/30 border-t border-white/5 pt-2">
        Yêu cầu lúc: {fmtDateTime(r.createdAt)}
      </p>

      {/* Actions */}
      {isPending && (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(r)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-black bg-[#FF4C4C] hover:bg-[#ff3333] hover:opacity-90 transition-opacity"
          >
            <Check size={14} /> Duyệt
          </button>
          <button
            onClick={() => onReject(r)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-all"
          >
            <X size={14} /> Từ chối
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ManagerReservations() {
  const { token } = useAuth();

  const [pending,    setPending]    = useState<ReservationResponse[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError,   setApiError]   = useState('');

  // Approve modal
  const [approveTarget, setApproveTarget] = useState<ReservationResponse | null>(null);
  const [approving,     setApproving]     = useState(false);
  const [approveError,  setApproveError]  = useState('');

  // Reject modal
  const [rejectTarget,  setRejectTarget]  = useState<ReservationResponse | null>(null);
  const [rejectReason,  setRejectReason]  = useState('');
  const [rejecting,     setRejecting]     = useState(false);
  const [rejectError,   setRejectError]   = useState('');

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setApiError('');
    try {
      const data = await getPendingReservations(token);
      setPending(data);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Không thể tải danh sách đặt chỗ.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Approve ──────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!approveTarget || !token) return;
    setApproving(true);
    setApproveError('');
    try {
      const payload: ReviewReservationRequest = { isAccepted: true };
      await reviewReservation(approveTarget.id, payload, token);
      setPending(prev => prev.filter(r => r.id !== approveTarget.id));
      setApproveTarget(null);
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : 'Duyệt thất bại.');
      setApproving(false);
    }
  };

  // ─── Reject ───────────────────────────────────────────────────────────────

  const handleReject = async () => {
    if (!rejectTarget || !token) return;
    if (!rejectReason.trim()) { setRejectError('Vui lòng nhập lý do từ chối.'); return; }
    setRejecting(true);
    setRejectError('');
    try {
      const payload: ReviewReservationRequest = { isAccepted: false, reason: rejectReason.trim() };
      await reviewReservation(rejectTarget.id, payload, token);
      setPending(prev => prev.filter(r => r.id !== rejectTarget.id));
      setRejectTarget(null);
      setRejectReason('');
    } catch (e) {
      setRejectError(e instanceof Error ? e.message : 'Từ chối thất bại.');
      setRejecting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
        <p className="text-sm text-white/40">Đang tải danh sách đặt chỗ...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Quản lý đặt chỗ</h2>
          <p className="text-sm text-white/40 mt-0.5">
            {pending.length} yêu cầu đang chờ duyệt
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{apiError}</p>
        </div>
      )}

      {/* Pending count banner */}
      {pending.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-4 bg-amber-400/10 border border-amber-400/20 rounded-xl">
          <div className="w-9 h-9 rounded-xl bg-amber-400/20 flex items-center justify-center shrink-0">
            <Clock size={17} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-400">
              Có {pending.length} yêu cầu đặt chỗ đang chờ duyệt
            </p>
            <p className="text-xs text-amber-400/70 mt-0.5">Vui lòng xem xét và xét duyệt kịp thời</p>
          </div>
        </div>
      )}

      {/* Pending section */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <CalendarCheck size={16} className="text-[#FF4C4C]" />
          <h3 className="text-base font-semibold text-white">Chờ duyệt</h3>
          {pending.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-amber-400 text-black rounded-full">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="glass-card rounded-2xl flex flex-col items-center justify-center py-16 gap-3 text-white/30">
            <ClipboardList size={28} />
            <p className="text-sm">Không có yêu cầu nào đang chờ duyệt</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pending.map(r => (
              <ReservationCard
                key={r.id}
                r={r}
                onApprove={r => setApproveTarget(r)}
                onReject={r => { setRejectTarget(r); setRejectReason(''); setRejectError(''); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ══ APPROVE MODAL ══ */}
      {approveTarget && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-[#FF4C4C]/20 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5" style={{ backgroundColor: 'var(--admin-bg-surface)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} className="text-[#FF4C4C]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Xác nhận duyệt</h3>
                <p className="text-xs text-white/40 mt-0.5">Đặt chỗ sẽ được chấp nhận</p>
              </div>
            </div>

            <p className="text-sm text-white/70">
              Duyệt yêu cầu đặt chỗ cho biển số{' '}
              <span className="font-bold font-mono text-white">{approveTarget.licensePlate}</span>{' '}
              tại slot <span className="font-semibold text-white">{approveTarget.slotNumber}</span>?
            </p>

            <div className="text-xs text-white/40 space-y-1 px-3 py-2.5 bg-white/5 rounded-xl">
              <p>📅 Từ: {fmtDateTime(approveTarget.startTime)}</p>
              <p>📅 Đến: {fmtDateTime(approveTarget.endTime)}</p>
            </div>

            {approveError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertTriangle size={12} /> {approveError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setApproveTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-black bg-[#FF4C4C] hover:bg-[#ff3333] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {approving && <Loader2 size={14} className="animate-spin" />}
                Xác nhận duyệt
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ══ REJECT MODAL ══ */}
      {rejectTarget && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-red-400/20 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5" style={{ backgroundColor: 'var(--admin-bg-surface)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center shrink-0">
                <XCircle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Từ chối đặt chỗ</h3>
                <p className="text-xs text-white/40 mt-0.5">Biển số: {rejectTarget.licensePlate}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                <FileText size={11} className="inline mr-1" />
                Lý do từ chối <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Nhập lý do từ chối yêu cầu đặt chỗ này..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-400/50 transition-colors resize-none"
              />
            </div>

            {rejectError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertTriangle size={12} /> {rejectError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setRejectTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {rejecting && <Loader2 size={14} className="animate-spin" />}
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
