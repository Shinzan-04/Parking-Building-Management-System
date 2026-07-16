import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getAuditLogs, type AuditLogDto } from '../../services/auditLogService';
import {
  Loader2, AlertTriangle, Search, RefreshCw,
  ShieldCheck, Pencil, Trash2, Plus, ChevronDown, ChevronUp,
  User, Globe, Tag, Clock,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Map ActionType to a readable label & color */
function resolveAction(action: string): { label: string; color: string; bg: string; Icon: React.ElementType } {
  const a = (action || '').toLowerCase();
  if (a.includes('create') || a.includes('add'))
    return { label: 'Created',       color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  Icon: Plus       };
  if (a.includes('update') || a.includes('edit') || a.includes('approve') || a.includes('reject') || a.includes('cancel'))
    return { label: 'Updated',       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', Icon: Pencil     };
  if (a.includes('delete') || a.includes('remove'))
    return { label: 'Deleted',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  Icon: Trash2     };
  if (a.includes('force') || a.includes('admin'))
    return { label: 'Admin intervention', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', Icon: ShieldCheck };
  return { label: action, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', Icon: Tag };
}

/** Return the display label of EntityName */
function entityLabel(name: string): string {
  const map: Record<string, string> = {
    subscription: 'Monthly Pass Subscription',
    pricingpolicy: 'Pricing',
    monthlypasspolicy: 'Monthly Pass Policy',
    parkingslot: 'Parking Slot',
    parkingsession: 'Parking Session',
    user: 'User',
    vehicle: 'Vehicle',
    auditlog: 'Log',
  };
  return map[(name || '').toLowerCase()] ?? name;
}

/** Safely parse JSON, returns object or null */
function safeJson(val: string | null | undefined): Record<string, unknown> | null {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

/** Only show important key-value pairs, excluding internal IDs */
const HIDDEN_KEYS = ['id', 'createdat', 'updatedat', 'subscriptionid', 'vehicletypeid', 'buildingid', 'policyid'];

function KeyValueList({ obj }: { obj: Record<string, unknown> }) {
  const entries = Object.entries(obj).filter(([k]) => !HIDDEN_KEYS.includes(k.toLowerCase()));
  if (entries.length === 0) return <span className="text-xs opacity-50">No significant changes</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
          style={{ backgroundColor: 'var(--admin-bg-base)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)' }}
        >
          <span style={{ color: 'var(--admin-text-faint)' }}>{k}:</span>
          <strong>{String(v ?? '—')}</strong>
        </span>
      ))}
    </div>
  );
}

// ── Expandable diff row ───────────────────────────────────────────────────────
function LogRow({ log }: { log: AuditLogDto }) {
  const [expanded, setExpanded] = useState(false);
  const action = resolveAction(log.actionType || '');
  const Icon = action.Icon;

  const oldObj = safeJson(log.oldValues);
  const newObj = safeJson(log.newValues);
  const hasDiff = oldObj || newObj;

  return (
    <div
      className="rounded-xl border transition-all"
      style={{ backgroundColor: 'var(--admin-bg-surface)', borderColor: 'var(--admin-border)' }}
    >
      {/* Main row */}
      <div className="flex items-start gap-4 px-5 py-4">
        {/* Action icon */}
        <div
          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5"
          style={{ backgroundColor: action.bg }}
        >
          <Icon size={16} style={{ color: action.color }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Top: action badge + entity */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: action.bg, color: action.color }}
            >
              {action.label}
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>
              {entityLabel(log.entityName || '')}
            </span>
            {log.reason && (
              <span className="text-sm" style={{ color: 'var(--admin-text-faint)' }}>
                — {log.reason}
              </span>
            )}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--admin-text-faint)' }}>
            <span className="flex items-center gap-1">
              <User size={11} />
              {log.userFullName || 'System'}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {log.createdAt ? new Date(log.createdAt).toLocaleString('vi-VN') : '—'}
            </span>
            {log.ipAddress && (
              <span className="flex items-center gap-1">
                <Globe size={11} />
                {log.ipAddress}
              </span>
            )}
          </div>
        </div>

        {/* Expand button */}
        {hasDiff && (
          <button
            onClick={() => setExpanded(p => !p)}
            className="shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition-colors"
            style={{
              backgroundColor: expanded ? 'var(--admin-bg-card)' : 'transparent',
              color: 'var(--admin-text-faint)',
              border: '1px solid var(--admin-border)',
            }}
          >
            Details
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {/* Expanded diff */}
      {expanded && hasDiff && (
        <div
          className="mx-5 mb-4 rounded-xl overflow-hidden grid grid-cols-2 divide-x text-sm"
          style={{ borderColor: 'var(--admin-border)', border: '1px solid var(--admin-border)' }}
        >
          <div className="p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--admin-text-faint)' }}>
              Before change
            </p>
            {oldObj ? <KeyValueList obj={oldObj} /> : <span className="text-xs opacity-40">No previous data</span>}
          </div>
          <div className="p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: action.color }}>
              After change
            </p>
            {newObj ? <KeyValueList obj={newObj} /> : <span className="text-xs opacity-40">No new data</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const ACTION_FILTERS = [
  { key: 'all',    label: 'All' },
  { key: 'create', label: 'Created' },
  { key: 'update', label: 'Updated' },
  { key: 'delete', label: 'Deleted' },
];

export default function AuditLogs() {
  const { token } = useAuth();
  const [logs,      setLogs]      = useState<AuditLogDto[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState('');
  const [search,    setSearch]    = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const fetchLogs = async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const data = await getAuditLogs(token);
      setLogs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load activity logs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [token]);

  const filtered = useMemo(() => {
    return (logs || []).filter(log => {
      const s = search.toLowerCase();
      const matchSearch =
        (log.userFullName?.toLowerCase() || '').includes(s) ||
        (log.actionType?.toLowerCase()   || '').includes(s) ||
        (log.entityName?.toLowerCase()   || '').includes(s) ||
        (log.reason?.toLowerCase()       || '').includes(s);

      const a = (log.actionType || '').toLowerCase();
      const matchAction =
        actionFilter === 'all'    ? true :
        actionFilter === 'create' ? (a.includes('create') || a.includes('add')) :
        actionFilter === 'update' ? (a.includes('update') || a.includes('edit') || a.includes('approve') || a.includes('reject') || a.includes('cancel') || a.includes('force')) :
        actionFilter === 'delete' ? (a.includes('delete') || a.includes('remove')) :
        true;

      return matchSearch && matchAction;
    });
  }, [logs, search, actionFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--admin-text-primary)' }}>
            Activity Log
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--admin-text-faint)' }}>
            Track all important changes in the system — {logs.length} actions
          </p>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors"
          style={{ backgroundColor: 'var(--admin-bg-card)', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border)' }}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--admin-text-faint)' }} />
          <input
            type="text"
            placeholder="Search user, action, entity, reason..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: 'var(--admin-bg-surface)',
              borderColor: 'var(--admin-border)',
              color: 'var(--admin-text-primary)',
            }}
          />
        </div>

        {/* Action filter tabs */}
        <div
          className="flex items-center gap-0.5 p-1 rounded-xl shrink-0"
          style={{ backgroundColor: 'var(--admin-bg-surface)', border: '1px solid var(--admin-border)' }}
        >
          {ACTION_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActionFilter(f.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={
                actionFilter === f.key
                  ? { backgroundColor: 'var(--admin-bg-card)', color: 'var(--admin-text-primary)' }
                  : { color: 'var(--admin-text-faint)' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline list */}
      {filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl border"
          style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text-faint)' }}
        >
          <ShieldCheck size={36} className="mb-3 opacity-30" />
          <p className="text-sm">No logs found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(log => (
            <LogRow key={log.id} log={log} />
          ))}
        </div>
      )}

      {/* Footer count */}
      {filtered.length > 0 && (
        <p className="text-xs text-center pb-2" style={{ color: 'var(--admin-text-faint)' }}>
          Showing {filtered.length} / {logs.length} actions
        </p>
      )}
    </div>
  );
}
