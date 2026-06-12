/**
 * Manager/Sessions.tsx
 * Nhánh: Feature/ManageSessions-Manager
 * Quản lý phiên đỗ xe (Parking Sessions)
 *
 * Tính năng:
 *  - Danh sách session có phân trang, bộ lọc theo biển số / trạng thái / ngày
 *  - KPI banner: đang đỗ, quá giờ, hoàn thành hôm nay, doanh thu hôm nay
 *  - Modal xem chi tiết session
 *  - Badge trạng thái màu sắc (Active / Overdue / Completed)
 *  - Badge IssueType cảnh báo ngoại lệ (Mất vé / Sai biển số…)
 */

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useRef } from 'react';
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
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function toLocalDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<SessionStatus, { bg: string; text: string; dot: string }> = {
  Active:    { bg: 'bg-[#3BFFA4]/10', text: 'text-[#3BFFA4]',  dot: 'bg-[#3BFFA4]'  },
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
        const s = await getSessionById(sessionId, token);
        setSession(s);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không tải được chi tiết.');
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0F1B2D] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <ClipboardList size={16} className="text-[#3BFFA4]" />
            <h3 className="text-base font-semibold text-white">
              Chi tiết phiên đỗ xe
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-white/40">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Đang tải...</span>
            </div>
          )}
          {error && <p className="text-sm text-red-400 text-center py-8">{error}</p>}
          {session && (
            <div className="space-y-4">
              {/* License plate + status */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold font-mono text-white tracking-wider">
                    {session.licensePlate}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">{session.sessionCode}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge status={session.status} />
                  <IssueBadge issue={session.issueType} />
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Loại xe',    value: session.vehicleTypeName },
                  { label: 'Vị trí',     value: `${session.buildingName} · ${session.floorName} · ${session.slotNumber}` },
                  { label: 'Giờ vào',    value: fmtTime(session.entryTime) },
                  { label: 'Giờ ra',     value: session.exitTime ? fmtTime(session.exitTime) : '—' },
                  { label: 'Thời gian',  value: session.duration || '—' },
                  { label: 'Nhân viên',  value: session.staffName ?? '—' },
                ].map(row => (
                  <div key={row.label} className="bg-white/[0.04] rounded-xl px-3.5 py-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">{row.label}</p>
                    <p className="text-sm text-white font-medium">{row.value}</p>
                  </div>
                ))}
              </div>

              {/* Fee */}
              <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-[#3BFFA4]/10 to-[#00C2FF]/10 border border-[#3BFFA4]/20 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Banknote size={15} className="text-[#3BFFA4]" />
                  Phí gửi xe
                </div>
                <p className="text-lg font-bold text-[#3BFFA4]">{vnd(session.totalFee)}đ</p>
              </div>

              {/* Entry image */}
              {session.entryImageUrl && (
                <div className="rounded-xl overflow-hidden border border-white/10">
                  <p className="text-[10px] text-white/40 px-3 py-2 bg-white/5 uppercase tracking-wider">Ảnh xe vào</p>
                  <img src={session.entryImageUrl} alt="entry" className="w-full object-cover max-h-48" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/10">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

export default function ManagerSessions() {
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
  const [statusFilter, setStatusFilter] = useState<SessionStatus | ''>('');
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
      const kpiRes: SessionListResponse = await getActiveSessions({ pageSize: 1 }, token);
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
      const listRes: SessionListResponse = await searchSessions(params, token);
      setSessions(listRes.items);
      setTotalCount(listRes.totalCount);
      setTotalPages(listRes.totalPages || 1);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Không thể tải danh sách phiên.');
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
          <h2 className="text-2xl font-bold text-white">Phiên đỗ xe</h2>
          <p className="text-sm text-white/40 mt-0.5">
            {totalCount.toLocaleString('vi-VN')} phiên · lọc theo bộ lọc hiện tại
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
          { icon: Car,          label: 'Đang đỗ',       value: summary.totalActive,            color: '#3BFFA4', alert: false },
          { icon: AlertTriangle, label: 'Quá giờ',      value: summary.totalOverdue,            color: '#F87171', alert: summary.totalOverdue > 0 },
          { icon: CheckCircle2, label: 'Ra hôm nay',    value: summary.totalCompletedToday,    color: '#00C2FF', alert: false },
          { icon: Banknote,     label: 'Doanh thu hôm nay', value: null,                       color: '#F59E0B', alert: false },
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
            placeholder="Tìm biển số xe..."
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#3BFFA4]/50 transition-colors"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl">
          {([
            { value: '',           label: 'Tất cả' },
            { value: 'Active',     label: 'Đang đỗ' },
            { value: 'Overdue',    label: 'Quá giờ' },
            { value: 'Completed',  label: 'Đã ra' },
          ] as { value: SessionStatus | ''; label: string }[]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === opt.value
                  ? 'bg-[#3BFFA4] text-[#101A31]'
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
            <Loader2 size={22} className="animate-spin text-[#3BFFA4]" />
            <span className="text-sm">Đang tải...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-white/30">
            <ClipboardList size={28} />
            <p className="text-sm">Không tìm thấy phiên nào.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Biển số', 'Loại xe', 'Vị trí', 'Trạng thái', 'Giờ vào', 'Thời gian', 'Phí', 'Ngoại lệ', ''].map(h => (
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
                        <span className="text-xs bg-[#3BFFA4]/10 text-[#3BFFA4] px-2 py-0.5 rounded-full">{s.vehicleTypeName}</span>
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
                        <span className="text-sm font-semibold text-[#3BFFA4]">{vnd(s.totalFee)}đ</span>
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
                          className="p-2 rounded-xl text-white/30 hover:text-[#3BFFA4] hover:bg-[#3BFFA4]/10 transition-all"
                          title="Xem chi tiết"
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
                Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} / {totalCount.toLocaleString('vi-VN')} phiên
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
                          ? 'bg-[#3BFFA4] text-[#101A31]'
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
