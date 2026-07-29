/**
 * Manager/Sessions.tsx
 * Branch: Feature/ManageSessions-Manager
 * Parking Session Management
 *
 * Features:
 *  - Paginated session list, filter by license plate / status / date
 *  - KPI banner: currently parked, overdue, completed today, today's revenue
 *  - Session detail view modal
 *  - Colored status badge (Active / Overdue / Completed)
 *  - IssueType badge warning for exceptions (Lost Ticket / Wrong Plate...)
 */

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardList, Search, RefreshCw, ChevronLeft,
  ChevronRight, Eye, Clock, CheckCircle2, AlertTriangle,
  Banknote, Car, X, Loader2, Calendar,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { searchSessions, getActiveSessions, getSessionById } from '../../services/sessionsService';
import type {
  SessionDto, SessionStatus, IssueType,
  SessionListResponse,
} from '../../services/sessionsService';
import {
  SESSION_STATUS_LABELS, ISSUE_TYPE_LABELS,
} from '../../services/sessionsService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const vnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n);

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function toLocalDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<SessionStatus, { bg: string; text: string; dot: string }> = {
  Active:    { bg: 'bg-[#FF4C4C]/10', text: 'text-[#FF4C4C]',  dot: 'bg-[#FF4C4C]'  },
  Overdue:   { bg: 'bg-red-400/10',   text: 'text-red-400',    dot: 'bg-red-400'    },
  Completed: { bg: 'bg-white/10',     text: 'text-white/60',   dot: 'bg-white/40'   },
};

function StatusBadge({ status }: { status: SessionStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.Completed;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {SESSION_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Issue badge ──────────────────────────────────────────────────────────────

const ISSUE_CFG: Partial<Record<IssueType, { bg: string; text: string }>> = {
  LostTicket:  { bg: 'bg-amber-400/10', text: 'text-amber-400' },
  WrongPlate:  { bg: 'bg-orange-400/10', text: 'text-orange-400' },
  WrongSlot:   { bg: 'bg-purple-400/10', text: 'text-purple-400' },
  Unpaid:      { bg: 'bg-red-400/10',   text: 'text-red-400'   },
};

function IssueBadge({ issue }: { issue: IssueType }) {
  if (issue === 'None') return null;
  const cfg = ISSUE_CFG[issue] ?? { bg: 'bg-white/10', text: 'text-white/60' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <AlertTriangle size={9} />
      {ISSUE_TYPE_LABELS[issue] ?? issue}
    </span>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function SessionDetailModal({
  sessionId, onClose, token,
}: { sessionId: string; onClose: () => void; token: string }) {
  const [session, setSession] = useState<SessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    (async () => {
      try {
        const s = await getSessionById(sessionId);
        setSession(s);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, token]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-lg shadow-2xl bg-white dark:bg-[#0E0E10]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <ClipboardList size={16} className="text-[#FF4C4C]" />
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">
              Parking Session Details
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-gray-400 dark:text-white/40 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-400 dark:text-white/40">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          )}
          {error && <p className="text-sm text-red-400 text-center py-8">{error}</p>}
          {session && (
            <div className="space-y-4">
              {/* License plate + status */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold font-mono text-gray-800 dark:text-white tracking-wider">
                    {session.licensePlate}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">{session.sessionCode}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge status={session.status} />
                  <IssueBadge issue={session.issueType} />
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Vehicle Type',    value: session.vehicleTypeName },
                  { label: 'Location',     value: `${session.buildingName} · ${session.floorName} · ${session.slotNumber}` },
                  { label: 'Entry Time',    value: fmtTime(session.entryTime) },
                  { label: 'Exit Time',     value: session.exitTime ? fmtTime(session.exitTime) : '—' },
                  { label: 'Duration',  value: session.duration || '—' },
                  { label: 'Staff',  value: session.staffName ?? '—' },
                ].map(row => (
                  <div key={row.label} className="bg-gray-50 dark:bg-white/[0.04] rounded-xl px-3.5 py-3">
                    <p className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider mb-0.5">{row.label}</p>
                    <p className="text-sm text-gray-800 dark:text-white font-medium">{row.value}</p>
                  </div>
                ))}
              </div>

              {/* Fee */}
              <div className="flex items-center justify-between px-4 py-3.5 bg-[#FF4C4C]/5 border border-[#FF4C4C]/20 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/60">
                  <Banknote size={15} className="text-[#FF4C4C]" />
                  Parking Fee
                </div>
                <p className="text-lg font-bold text-[#FF4C4C]">{vnd(session.totalFee)}đ</p>
              </div>

              {/* Entry image */}
              {session.entryImageUrl && (
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-white/10">
                  <p className="text-[10px] text-gray-400 dark:text-white/40 px-3 py-2 bg-gray-50 dark:bg-white/5 uppercase tracking-wider">Entry Photo</p>
                  <img src={session.entryImageUrl} alt="entry" className="w-full object-cover max-h-48" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-white/60 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

export default function AdminSessions() {
  const { token } = useAuth();

  // KPI
  const [summary, setSummary] = useState({
    totalActive: 0, totalOverdue: 0, totalCompletedToday: 0, totalRevenueToday: 0,
  });

  // List
  const [sessions,    setSessions]    = useState<SessionDto[]>([]);
  const [totalCount,  setTotalCount]  = useState(0);
  const [totalPages,  setTotalPages]  = useState(1);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [apiError,    setApiError]    = useState('');

  // Filters
  const [search,     setSearch]     = useState('');
  const [searchParams] = useSearchParams();
  const initStatus = (searchParams.get('status') as SessionStatus | '') || '';
  const [statusFilter, setStatusFilter] = useState<SessionStatus | ''>(initStatus);
  const today = toLocalDateStr(new Date());
  const [fromDate, setFromDate]     = useState(() => toLocalDateStr(new Date(Date.now() - 7 * 86400_000)));
  const [toDate,   setToDate]       = useState(today);

  // Detail modal
  const [detailId, setDetailId] = useState<string | null>(null);

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const handleSearchChange = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(v), 400);
  };

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setApiError('');

    try {
      // KPI (from active session summary)
      const kpiRes: SessionListResponse = await getActiveSessions({ pageSize: 1 });
      setSummary(kpiRes.summary);

      // Session list
      const params = {
        licensePlate: debouncedSearch || undefined,
        status:       statusFilter as SessionStatus || undefined,
        fromDate:     fromDate ? `${fromDate}T00:00:00` : undefined,
        toDate:       toDate   ? `${toDate}T23:59:59`   : undefined,
        page,
        pageSize: PAGE_SIZE,
      };
      const listRes: SessionListResponse = await searchSessions(params);
      setSessions(listRes.items);
      setTotalCount(listRes.totalCount);
      setTotalPages(listRes.totalPages || 1);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unable to load session list.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, debouncedSearch, statusFilter, fromDate, toDate, page]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, fromDate, toDate]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Parking Sessions</h2>
          <p className="text-sm text-white/40 mt-0.5">
            {totalCount.toLocaleString('vi-VN')} sessions · filtered by current filters
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

      {/* KPI mini-banner */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { icon: Car,          label: 'Currently Parked',       value: summary.totalActive,            color: '#FF4C4C', alert: false },
          { icon: AlertTriangle, label: 'Overdue',      value: summary.totalOverdue,            color: '#F87171', alert: summary.totalOverdue > 0 },
          { icon: CheckCircle2, label: 'Exited Today',    value: summary.totalCompletedToday,    color: '#F59E0B', alert: false },
          { icon: Banknote,     label: "Today's Revenue", value: null,                       color: '#F59E0B', alert: false },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className={`glass-card px-4 py-3.5 rounded-2xl flex items-center gap-3 ${kpi.alert ? 'border-red-400/30' : ''}`}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${kpi.color}18` }}>
                <Icon size={17} style={{ color: kpi.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-white">
                  {kpi.value !== null
                    ? kpi.value.toLocaleString('vi-VN')
                    : `${vnd(summary.totalRevenueToday)}đ`}
                </p>
                <p className="text-xs text-white/40 truncate">{kpi.label}</p>
              </div>
              {kpi.alert && <span className="ml-auto w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search by license plate..."
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl">
          {([
            { value: '',           label: 'All' },
            { value: 'Active',     label: 'Currently Parked' },
            { value: 'Overdue',    label: 'Overdue' },
            { value: 'Completed',  label: 'Exited' },
          ] as { value: SessionStatus | ''; label: string }[]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === opt.value
                  ? 'bg-[#FF4C4C] text-white'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <Calendar size={13} className="text-white/40" />
          <input type="date" value={fromDate} max={toDate}
            onChange={e => setFromDate(e.target.value)}
            className="bg-transparent text-xs text-white/70 focus:outline-none"
          />
          <span className="text-white/30 text-xs">—</span>
          <input type="date" value={toDate} min={fromDate} max={today}
            onChange={e => setToDate(e.target.value)}
            className="bg-transparent text-xs text-white/70 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-white/40">
            <Loader2 size={22} className="animate-spin text-[#FF4C4C]" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-white/30">
            <ClipboardList size={28} />
            <p className="text-sm">No sessions found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {['License Plate', 'Vehicle Type', 'Location', 'Status', 'Entry Time', 'Duration', 'Fee', 'Exception', ''].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-white/40 px-4 py-3 first:pl-6 last:pr-6">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                      <td className="px-6 py-3">
                        <span className="font-mono font-semibold text-sm text-white">{s.licensePlate}</span>
                        <p className="text-[10px] text-white/30 mt-0.5">{s.sessionCode}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-[#FF4C4C]/10 text-[#FF4C4C] px-2 py-0.5 rounded-full">{s.vehicleTypeName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-white/70">{s.buildingName}</p>
                        <p className="text-[10px] text-white/40">{s.floorName} · {s.slotNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-white/60">
                          <Clock size={11} className="text-white/30" />
                          {new Date(s.entryTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <p className="text-[10px] text-white/30 mt-0.5">
                          {new Date(s.entryTime).toLocaleDateString('vi-VN')}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-white/60">{s.duration || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-[#FF4C4C]">{vnd(s.totalFee)}đ</span>
                        {s.estimatedFee > 0 && s.status !== 'Completed' && (
                          <p className="text-[10px] text-white/30">~{vnd(s.estimatedFee)}đ</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <IssueBadge issue={s.issueType} />
                      </td>
                      <td className="pr-6 py-3">
                        <button
                          onClick={() => setDetailId(s.id)}
                          className="p-2 rounded-xl text-white/30 hover:text-[#FF4C4C] hover:bg-[#FF4C4C]/10 transition-all"
                          title="View details"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
              <p className="text-xs text-white/40">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} / {totalCount.toLocaleString('vi-VN')} sessions
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pg = i + 1;
                  if (totalPages > 5) {
                    if (page <= 3) pg = i + 1;
                    else if (page >= totalPages - 2) pg = totalPages - 4 + i;
                    else pg = page - 2 + i;
                  }
                  return (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={`w-8 h-8 rounded-xl text-xs font-medium transition-all ${
                        page === pg
                          ? 'bg-[#FF4C4C] text-white'
                          : 'text-white/50 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {pg}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail modal */}
      {detailId && token && (
        <SessionDetailModal
          sessionId={detailId}
          token={token}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
