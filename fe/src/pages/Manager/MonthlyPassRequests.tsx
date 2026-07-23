import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  RefreshCw, Search, CheckCircle2, XCircle, Clock, AlertCircle,
  ChevronLeft, ChevronRight, Ticket, X, Info,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getAllSubscriptions,
  type SubscriptionResponse, type SubscriptionStatus,
} from '../../services/subscriptionService';

const PAGE_SIZE = 15;

const STATUS_OPTIONS: { value: SubscriptionStatus | ''; label: string }[] = [
  { value: '',              label: 'All'                    },
  { value: 'PendingCancel', label: 'Pending Cancellation'   },
  { value: 'Active',        label: 'Active'                 },
  { value: 'PendingPayment',label: 'Pending Payment'        },
  { value: 'Expired',       label: 'Expired'                },
  { value: 'Canceled',      label: 'Canceled'                },
];

function statusBadge(status: SubscriptionStatus) {
  const map: Record<SubscriptionStatus, { cls: string; label: string; icon: React.ReactNode }> = {
    Active:         { cls: 'bg-green-500/15  text-green-400  border-green-500/30',  label: 'Active',               icon: <CheckCircle2 size={11} /> },
    PendingPayment: { cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', label: 'Pending Payment',      icon: <Clock size={11} />        },
    PendingCancel:  { cls: 'bg-blue-500/15   text-blue-400   border-blue-500/30',   label: 'Pending Cancellation', icon: <Clock size={11} />        },
    Expired:        { cls: 'bg-gray-500/15   text-gray-400   border-gray-500/30',   label: 'Expired',              icon: <XCircle size={11} />      },
    Canceled:       { cls: 'bg-red-500/15    text-red-400    border-red-500/30',    label: 'Canceled',             icon: <XCircle size={11} />      },
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
          <h3 className="text-base font-semibold text-white">Monthly Pass Details</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {([
              ['Subscription ID', item.id],
              ['License Plate',   item.licensePlate],
              ['Vehicle Type',    item.vehicleTypeName],
              ['Status',          null as null],
              ['Driver',          item.driverName],
              ['Start Date',      fmtDate(item.startDate)],
              ['End Date',        fmtDate(item.endDate)],
              ['Created At',      fmtDt(item.createdAt)],
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
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Cancellation Info</p>
              {item.cancelReason && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-white/40 shrink-0">Cancellation Reason</span>
                  <span className="font-medium text-right break-all text-white">{item.cancelReason}</span>
                </div>
              )}
              {item.cancelRejectReason && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-white/40 shrink-0">Rejection Reason</span>
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

// ─── Main Page (view-only cho Manager) ────────────────────────────────────────
export default function ManagerMonthlyPassRequests() {
  const { user } = useAuth();
  const token = user?.accessToken ?? '';

  const [items, setItems]         = useState<SubscriptionResponse[]>([]);
  const [page, setPage]           = useState(1);
  const [statusFilter, setFilter] = useState<SubscriptionStatus | ''>('PendingCancel');
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<SubscriptionResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await getAllSubscriptions();
      setItems(res);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Error loading data');
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Ticket size={22} className="text-[#FF4C4C]" />
            Monthly Pass
          </h2>
          <p className="text-sm mt-0.5 text-white/40">
            Track monthly pass cancellation requests from drivers (view only — Admin handles approval)
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
            placeholder="Search by driver name, license plate..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-white/25 outline-none focus:border-[#FF4C4C]/50 focus:ring-1 focus:ring-[#FF4C4C]/30 transition-colors"
          />
        </div>
      </div>

      <p className="text-xs text-white/30">
        {loading ? 'Loading...' : `Showing ${paged.length} / ${filtered.length} monthly passes`}
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
                {['Driver', 'License Plate', 'Valid Period', 'Status', 'Created At', 'Details'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/30">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && paged.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-14 text-center text-white/30">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" />Loading...
                </td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-14 text-center text-sm text-white/30">
                  No monthly passes found
                </td></tr>
              ) : paged.map(item => (
                <tr key={item.id} className="border-t border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-white">{item.driverName}</p>
                    <p className="text-xs text-white/35 mt-0.5">{item.vehicleTypeName}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white/60">{item.licensePlate}</td>
                  <td className="px-4 py-3 text-xs text-white/40 whitespace-nowrap">
                    {fmtDate(item.startDate)} → {fmtDate(item.endDate)}
                  </td>
                  <td className="px-4 py-3 space-y-1">
                    {statusBadge(item.status)}
                    {item.cancelReason && (
                      <p className="text-xs text-white/40 max-w-[200px] line-clamp-1" title={item.cancelReason}>
                        Reason: {item.cancelReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/40 whitespace-nowrap">{fmtDt(item.createdAt)}</td>
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
