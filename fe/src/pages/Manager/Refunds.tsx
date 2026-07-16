import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  RefreshCw, Search, CheckCircle2, XCircle, Clock, AlertCircle,
  RotateCcw, ChevronLeft, ChevronRight, Banknote, X, Info,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getPaymentList,
  type PaymentListItem, type PaymentStatus,
} from '../../services/paymentService';

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  { value: '',             label: 'All'             },
  { value: 'Refunding',    label: 'Pending Review'  },
  { value: 'Refunded',     label: 'Refunded'        },
  { value: 'RefundFailed', label: 'Rejected / Error' },
  { value: 'Success',      label: 'Success'         },
  { value: 'Pending',      label: 'Pending'         },
  { value: 'Failed',       label: 'Failed'          },
];

function statusBadge(status: PaymentStatus) {
  const map: Record<PaymentStatus, { cls: string; label: string; icon: React.ReactNode }> = {
    Pending:      { cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',  label: 'Pending',        icon: <Clock size={11} />        },
    Success:      { cls: 'bg-green-500/15  text-green-400  border-green-500/30',   label: 'Success',        icon: <CheckCircle2 size={11} /> },
    Failed:       { cls: 'bg-red-500/15    text-red-400    border-red-500/30',     label: 'Failed',         icon: <XCircle size={11} />      },
    Refunding:    { cls: 'bg-blue-500/15   text-blue-400   border-blue-500/30',    label: 'Pending Review', icon: <RotateCcw size={11} />    },
    Refunded:     { cls: 'bg-teal-500/15   text-teal-400   border-teal-500/30',    label: 'Refunded',       icon: <CheckCircle2 size={11} /> },
    RefundFailed: { cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30',  label: 'Rejected / Error', icon: <AlertCircle size={11} />  },
  };
  const cfg = map[status] ?? { cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30', label: status, icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

const fmt   = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const fmtDt = (dt: string | null) =>
  dt ? new Date(dt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—';

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ item, onClose }: { item: PaymentListItem; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0E0E10] shadow-2xl overflow-y-auto max-h-[90vh] animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-base font-semibold text-white">Transaction Details</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {([
              ['Payment ID',      item.paymentId],
              ['Order Code',      `#${item.payOSOrderCode}`],
              ['Amount',          fmt(item.amount)],
              ['Status',          null as null],
              ['Method',          item.paymentMethod],
              ['Payment Date',    fmtDt(item.paymentDate)],
              ['User',            item.userFullName ?? '—'],
              ['Email',           item.userEmail ?? '—'],
              ['Reservation ID',  item.reservationId ?? '—'],
              ['Session ID',      item.parkingSessionId ?? '—'],
              ['Description',     item.description ?? '—'],
            ] as [string, string | null][]).map(([k, v]) => (
              <div key={k} className="space-y-1">
                <p className="text-xs text-white/40">{k}</p>
                {v === null
                  ? statusBadge(item.status)
                  : <p className="text-sm font-medium text-white break-all">{v}</p>}
              </div>
            ))}
          </div>

          {(item.refundedAt || item.refundReferenceId || item.refundFailureReason) && (
            <div className="rounded-xl p-4 space-y-2.5 bg-white/5 border border-white/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Refund Information</p>
              {([
                ['Refund Time',           fmtDt(item.refundedAt)],
                ['Reference ID',          item.refundReferenceId],
                ['Provider',              item.refundProvider],
                ['Transaction ID',        item.refundTransactionId],
                ['Rejection / Error Reason', item.refundFailureReason],
              ] as [string, string | null][]).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 text-sm">
                  <span className="text-white/40 shrink-0">{k}</span>
                  <span className={`font-medium text-right break-all ${k.includes('Rejection') ? 'text-orange-400' : 'text-white'}`}>{v}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-xl p-3 bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            You have view-only access. Approving or rejecting refunds is an Admin responsibility.
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ManagerRefunds() {
  const { user } = useAuth();
  const token = user?.accessToken ?? '';

  const [items, setItems]         = useState<PaymentListItem[]>([]);
  const [totalCount, setTotal]    = useState(0);
  const [page, setPage]           = useState(1);
  const [statusFilter, setFilter] = useState('Refunding');
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<PaymentListItem | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await getPaymentList(token, { status: statusFilter || undefined, page, pageSize: PAGE_SIZE });
      setItems(res.items); setTotal(res.totalCount);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to load data');
    } finally { setLoading(false); }
  }, [token, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? items.filter(i =>
        (i.userFullName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (i.userEmail ?? '').toLowerCase().includes(search.toLowerCase()) ||
        String(i.payOSOrderCode).includes(search) ||
        (i.description ?? '').toLowerCase().includes(search.toLowerCase()))
    : items;

  const refundingCount  = items.filter(i => i.status === 'Refunding').length;
  const refundedCount   = items.filter(i => i.status === 'Refunded').length;
  const failedCount     = items.filter(i => i.status === 'RefundFailed').length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Banknote size={22} className="text-[#FF4C4C]" />
            Refund Report
          </h2>
          <p className="text-sm mt-0.5 text-white/40">
            Track refund requests and history (view-only)
          </p>
        </div>
        <button
          onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-white/60 transition-all"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary cards — only shown when viewing all */}
      {statusFilter === '' && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pending Review', count: refundingCount, color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: <RotateCcw size={18} className="text-blue-400" /> },
            { label: 'Refunded',       count: refundedCount,  color: 'text-teal-400',   bg: 'bg-teal-500/10',   border: 'border-teal-500/20',   icon: <CheckCircle2 size={18} className="text-teal-400" /> },
            { label: 'Rejected/Error', count: failedCount,    color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: <AlertCircle size={18} className="text-orange-400" /> },
          ].map(({ label, count, color, bg, border, icon }) => (
            <div key={label} className={`rounded-xl p-4 border ${bg} ${border} flex items-center gap-3`}>
              {icon}
              <div>
                <p className={`text-xl font-bold ${color}`}>{count}</p>
                <p className="text-xs text-white/40">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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
            >{opt.label}</button>
          ))}
        </div>

        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search by name, email, order code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-white/25 outline-none focus:border-[#FF4C4C]/50 focus:ring-1 focus:ring-[#FF4C4C]/30 transition-colors"
          />
        </div>
      </div>

      <p className="text-xs text-white/30">
        {loading ? 'Loading...' : `Showing ${filtered.length} / ${totalCount} transactions`}
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
                {['Order Code', 'User', 'Amount', 'Status', 'Payment Date', 'Refund Date', 'Details'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/30">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-14 text-center text-white/30">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" />Loading...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-white/30">
                  No transactions found
                </td></tr>
              ) : filtered.map(item => (
                <tr key={item.paymentId} className="border-t border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-white/40">#{item.payOSOrderCode}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-white">{item.userFullName ?? '—'}</p>
                    <p className="text-xs text-white/35 mt-0.5">{item.userEmail ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-sm text-[#FF4C4C]">{fmt(item.amount)}</td>
                  <td className="px-4 py-3 space-y-1">
                    {statusBadge(item.status)}
                    {item.refundFailureReason && (
                      <p className="text-xs text-orange-400/80 max-w-[200px] line-clamp-1" title={item.refundFailureReason}>
                        {item.refundFailureReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/40 whitespace-nowrap">{fmtDt(item.paymentDate)}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {item.refundedAt
                      ? <span className="text-teal-400">{fmtDt(item.refundedAt)}</span>
                      : <span className="text-white/25">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDetailItem(item)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
                      title="View details"
                    ><Info size={15} /></button>
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
          <span className="text-sm text-white/40 px-2">Page {page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-2 rounded-xl border border-white/10 bg-white/5 disabled:opacity-30 hover:bg-white/10 text-white/50 transition-colors"
          ><ChevronRight size={16} /></button>
        </div>
      )}

      {detailItem && <DetailModal item={detailItem} onClose={() => setDetailItem(null)} />}
    </div>
  );
}
