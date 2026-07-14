import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  RefreshCw, Search, CheckCircle2, XCircle, Clock, AlertCircle,
  ChevronLeft, ChevronRight, Ticket, X, Info,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getAllSubscriptions, processCancelSubscription,
  type SubscriptionResponse, type SubscriptionStatus,
} from '../../services/subscriptionService';

const PAGE_SIZE = 15;

const STATUS_OPTIONS: { value: SubscriptionStatus | ''; label: string }[] = [
  { value: '',              label: 'Tất cả'        },
  { value: 'PendingCancel', label: 'Chờ duyệt hủy' },
  { value: 'Active',        label: 'Đang hiệu lực' },
  { value: 'PendingPayment',label: 'Chờ thanh toán'},
  { value: 'Expired',       label: 'Đã hết hạn'    },
  { value: 'Canceled',      label: 'Đã hủy'        },
];

function statusBadge(status: SubscriptionStatus) {
  const map: Record<SubscriptionStatus, { cls: string; label: string; icon: React.ReactNode }> = {
    Active:         { cls: 'bg-green-500/15  text-green-400  border-green-500/30',  label: 'Đang hiệu lực', icon: <CheckCircle2 size={11} /> },
    PendingPayment: { cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', label: 'Chờ thanh toán',icon: <Clock size={11} />        },
    PendingCancel:  { cls: 'bg-blue-500/15   text-blue-400   border-blue-500/30',   label: 'Chờ duyệt hủy', icon: <Clock size={11} />        },
    Expired:        { cls: 'bg-gray-500/15   text-gray-400   border-gray-500/30',   label: 'Đã hết hạn',    icon: <XCircle size={11} />      },
    Canceled:       { cls: 'bg-red-500/15    text-red-400    border-red-500/30',    label: 'Đã hủy',        icon: <XCircle size={11} />      },
  };
  const cfg = map[status] ?? { cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30', label: status, icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

const fmtDt = (dt: string | null) =>
  dt ? new Date(dt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const fmtDate = (dt: string) => new Date(dt).toLocaleDateString('vi-VN');

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ item, onClose }: { item: SubscriptionResponse; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0E0E10] shadow-2xl overflow-y-auto max-h-[90vh] animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-base font-semibold text-white">Chi tiết vé tháng</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {([
              ['Subscription ID', item.id],
              ['Biển số',         item.licensePlate],
              ['Loại xe',         item.vehicleTypeName],
              ['Trạng thái',      null as null],
              ['Tài xế',          item.driverName],
              ['Ngày bắt đầu',    fmtDate(item.startDate)],
              ['Ngày kết thúc',   fmtDate(item.endDate)],
              ['Ngày tạo',        fmtDt(item.createdAt)],
            ] as [string, string | null][]).map(([k, v]) => (
              <div key={k} className="space-y-1">
                <p className="text-xs text-white/40">{k}</p>
                {v === null
                  ? statusBadge(item.status)
                  : <p className="text-sm font-medium text-white break-all">{v}</p>}
              </div>
            ))}
          </div>

          {(item.cancelReason || item.cancelRejectReason) && (
            <div className="rounded-xl p-4 space-y-2.5 bg-white/5 border border-white/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Thông tin hủy vé</p>
              {item.cancelReason && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-white/40 shrink-0">Lý do hủy</span>
                  <span className="font-medium text-right break-all text-white">{item.cancelReason}</span>
                </div>
              )}
              {item.cancelRejectReason && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-white/40 shrink-0">Lý do từ chối</span>
                  <span className="font-medium text-right break-all text-orange-400">{item.cancelRejectReason}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Approve Modal ────────────────────────────────────────────────────────────
function ApproveModal({ item, loading, onConfirm, onClose }: {
  item: SubscriptionResponse; loading: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0E0E10] shadow-2xl animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-teal-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} className="text-teal-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Duyệt hủy vé tháng</h3>
            <p className="text-sm text-white/50 mt-1">
              Duyệt hủy vé tháng xe <span className="text-teal-400 font-semibold">{item.licensePlate}</span> của {item.driverName}?
            </p>
            <p className="text-xs text-white/30 mt-1">Tài xế sẽ được hoàn 70% giá trị vé vào ví. Hành động không thể hoàn tác.</p>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
          >Huỷ</button>
          <button
            onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <RefreshCw size={14} className="animate-spin" />}
            Chấp thuận
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────
function RejectModal({ item, loading, onConfirm, onClose }: {
  item: SubscriptionResponse; loading: boolean;
  onConfirm: (reason: string) => void; onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0E0E10] shadow-2xl animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
            <XCircle size={28} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Từ chối hủy vé tháng</h3>
            <p className="text-sm text-white/50 mt-1">
              Từ chối yêu cầu hủy vé xe <span className="text-[#FF4C4C] font-semibold">{item.licensePlate}</span> của {item.driverName}?
            </p>
          </div>
        </div>

        <div className="px-6 pb-2 space-y-1.5">
          <label className="text-xs font-medium text-white/50">
            Lý do từ chối <span className="text-[#FF4C4C]">*</span>
          </label>
          <textarea
            rows={3}
            autoFocus
            placeholder="Nhập lý do từ chối để thông báo cho tài xế..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-white/25 outline-none resize-none focus:border-[#FF4C4C]/50 focus:ring-1 focus:ring-[#FF4C4C]/30 transition-colors"
          />
        </div>

        <div className="px-6 py-4 flex gap-3">
          <button
            onClick={onClose} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
          >Huỷ</button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={loading || !reason.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#FF4C4C] hover:bg-[#e03c3c] text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <RefreshCw size={14} className="animate-spin" />}
            Từ chối
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminMonthlyPassRequests() {
  const { user } = useAuth();
  const token = user?.accessToken ?? '';

  const [items, setItems]         = useState<SubscriptionResponse[]>([]);
  const [page, setPage]           = useState(1);
  const [statusFilter, setFilter] = useState<SubscriptionStatus | ''>('PendingCancel');
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [detailItem,  setDetailItem]  = useState<SubscriptionResponse | null>(null);
  const [approveItem, setApproveItem] = useState<SubscriptionResponse | null>(null);
  const [rejectItem,  setRejectItem]  = useState<SubscriptionResponse | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await getAllSubscriptions(token);
      setItems(res);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Lỗi tải dữ liệu');
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleApprove = async () => {
    if (!approveItem) return;
    setActionLoading(true);
    try {
      await processCancelSubscription(approveItem.id, { isApproved: true, refundAmount: 0 }, token);
      showToast('success', `Đã duyệt hủy vé tháng xe ${approveItem.licensePlate}`);
      setApproveItem(null); load();
    } catch (e: unknown) {
      showToast('error', (e as Error).message ?? 'Duyệt hủy thất bại');
    } finally { setActionLoading(false); }
  };

  const handleReject = async (reason: string) => {
    if (!rejectItem) return;
    setActionLoading(true);
    try {
      await processCancelSubscription(rejectItem.id, { isApproved: false, refundAmount: 0, rejectReason: reason }, token);
      showToast('success', 'Đã từ chối yêu cầu hủy vé tháng');
      setRejectItem(null); load();
    } catch (e: unknown) {
      showToast('error', (e as Error).message ?? 'Từ chối thất bại');
    } finally { setActionLoading(false); }
  };

  const filtered = items
    .filter(i => !statusFilter || i.status === statusFilter)
    .filter(i => !search.trim() || (
      (i.driverName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (i.licensePlate ?? '').toLowerCase().includes(search.toLowerCase())
    ));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Toast */}
      {toast && createPortal(
        <div className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium animate-slide-in-right ${
          toast.type === 'success' ? 'bg-teal-600 text-white' : 'bg-[#FF4C4C] text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>,
        document.body
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Ticket size={22} className="text-[#FF4C4C]" />
            Duyệt vé tháng
          </h2>
          <p className="text-sm mt-0.5 text-white/40">
            Chấp thuận hoặc từ chối các yêu cầu hủy vé tháng từ tài xế
          </p>
        </div>
        <button
          onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-white/60 transition-all"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status tabs */}
        <div className="flex gap-1 flex-wrap rounded-xl p-1 bg-white/5 border border-white/8">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setFilter(opt.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                statusFilter === opt.value
                  ? 'bg-[#FF4C4C] text-white shadow-lg shadow-[#FF4C4C]/20'
                  : 'text-white/50 hover:bg-white/10 hover:text-white/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Tìm theo tên tài xế, biển số..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-white/25 outline-none focus:border-[#FF4C4C]/50 focus:ring-1 focus:ring-[#FF4C4C]/30 transition-colors"
          />
        </div>
      </div>

      <p className="text-xs text-white/30">
        {loading ? 'Đang tải...' : `Hiển thị ${paged.length} / ${filtered.length} vé tháng`}
      </p>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <AlertCircle size={16} className="shrink-0" />{error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#0E0E10]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                {['Tài xế', 'Biển số', 'Hiệu lực', 'Trạng thái', 'Ngày tạo', 'Thao tác'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/30">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && paged.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-14 text-center text-white/30">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" />Đang tải...
                </td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-14 text-center text-sm text-white/30">
                  Không tìm thấy vé tháng nào
                </td></tr>
              ) : paged.map(item => (
                <tr key={item.id} className="border-t border-white/[0.06] hover:bg-white/[0.03] transition-colors">

                  {/* Tài xế */}
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-white">{item.driverName}</p>
                    <p className="text-xs text-white/35 mt-0.5">{item.vehicleTypeName}</p>
                  </td>

                  {/* Biển số */}
                  <td className="px-4 py-3 font-mono text-xs text-white/60">{item.licensePlate}</td>

                  {/* Hiệu lực */}
                  <td className="px-4 py-3 text-xs text-white/40 whitespace-nowrap">
                    {fmtDate(item.startDate)} → {fmtDate(item.endDate)}
                  </td>

                  {/* Trạng thái */}
                  <td className="px-4 py-3 space-y-1">
                    {statusBadge(item.status)}
                    {item.cancelReason && (
                      <p className="text-xs text-white/40 max-w-[200px] line-clamp-1" title={item.cancelReason}>
                        Lý do: {item.cancelReason}
                      </p>
                    )}
                  </td>

                  {/* Ngày tạo */}
                  <td className="px-4 py-3 text-xs text-white/40 whitespace-nowrap">{fmtDt(item.createdAt)}</td>

                  {/* Thao tác */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setDetailItem(item)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
                        title="Xem chi tiết"
                      ><Info size={15} /></button>

                      {item.status === 'PendingCancel' && (
                        <>
                          <button
                            onClick={() => setApproveItem(item)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-600/80 hover:bg-teal-500 text-white transition-colors"
                          >
                            <CheckCircle2 size={12} />Chấp thuận
                          </button>
                          <button
                            onClick={() => setRejectItem(item)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#FF4C4C]/80 hover:bg-[#FF4C4C] text-white transition-colors"
                          >
                            <XCircle size={12} />Từ chối
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 rounded-xl border border-white/10 bg-white/5 disabled:opacity-30 hover:bg-white/10 text-white/50 transition-colors"
          ><ChevronLeft size={16} /></button>
          <span className="text-sm text-white/40 px-2">Trang {page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-2 rounded-xl border border-white/10 bg-white/5 disabled:opacity-30 hover:bg-white/10 text-white/50 transition-colors"
          ><ChevronRight size={16} /></button>
        </div>
      )}

      {/* Modals */}
      {detailItem  && <DetailModal  item={detailItem}  onClose={() => setDetailItem(null)} />}
      {approveItem && (
        <ApproveModal item={approveItem} loading={actionLoading}
          onConfirm={handleApprove} onClose={() => !actionLoading && setApproveItem(null)} />
      )}
      {rejectItem && (
        <RejectModal item={rejectItem} loading={actionLoading}
          onConfirm={handleReject} onClose={() => !actionLoading && setRejectItem(null)} />
      )}
    </div>
  );
}
