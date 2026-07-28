import { useState, useEffect, useCallback } from 'react';
import { Car, MapPin, TrendingUp, Clock, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Building2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getBuildings } from '../../services/buildingsService';
import { searchSessions } from '../../services/sessionsService';
import type { SessionDto } from '../../services/sessionsService';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

interface DashboardStats {
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  activeSessions: number;
}

export default function StaffDashboard() {
  const { user, token } = useAuth();

  const buildingId = user?.assignedBuildingId;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const [stats, setStats]               = useState<DashboardStats | null>(null);
  const [buildingName, setBuildingName] = useState<string>('');
  const [recentSessions, setRecentSessions] = useState<SessionDto[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError,   setApiError]   = useState('');

  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setApiError('');

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const weekAgo  = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];

      const sessionParams: Parameters<typeof searchSessions>[0] = {
        status: 'Completed',
        fromDate: `${weekAgo}T00:00:00Z`,
        toDate:   `${todayStr}T23:59:59Z`,
        pageSize: 50,
        ...(buildingId ? { buildingId } : {}),
      };

      const [sessionsRes, buildings] = await Promise.all([
        searchSessions(sessionParams),
        buildingId ? Promise.resolve(null) : getBuildings(),
      ]);

      // Building name
      if (buildingId) {
        const res = await fetch(`${BASE_URL}/api/buildings/${buildingId}`);
        if (res.ok) {
          const b = await res.json();
          setBuildingName(b.name ?? '');
        }
      } else if (buildings && buildings.length > 0) {
        setBuildingName(buildings.map(b => b.name).join(', '));
      }

      // Stats
      if (buildingId) {
        const statsRes = await fetch(`${BASE_URL}/api/dashboard/realtime-stats/building/${buildingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (statsRes.ok) {
          const s = await statsRes.json();
          setStats(s);
        }
      } else {
        const statsRes = await fetch(`${BASE_URL}/api/dashboard/realtime-stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (statsRes.ok) {
          const s = await statsRes.json();
          setStats(s);
        }
      }

      const { summary } = sessionsRes;
      setTodayRevenue(summary.totalRevenueToday);
      setTodayCompleted(summary.totalCompletedToday);
      setOverdueCount(summary.totalOverdue);
      setRecentSessions(sessionsRes.items);
      setCurrentPage(1);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unable to load data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, buildingId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Lắng nghe sự kiện Realtime (SignalR) được phát từ useNotification
  useEffect(() => {
    const handleUpdate = () => {
      // Refresh ngầm
      loadData(true);
    };

    window.addEventListener('dashboardUpdate', handleUpdate);
    window.addEventListener('slotUpdate', handleUpdate);

    return () => {
      window.removeEventListener('dashboardUpdate', handleUpdate);
      window.removeEventListener('slotUpdate', handleUpdate);
    };
  }, [loadData]);

  const vnd = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
        <p className="text-sm" style={{ color: 'var(--admin-text-faint)' }}>Loading data...</p>
      </div>
    );
  }

  const occupancyPct = stats && stats.totalSlots > 0
    ? Math.round((stats.occupiedSlots / stats.totalSlots) * 1000) / 10
    : 0;

  const filteredSessions = recentSessions.filter(s => s.licensePlate.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage) || 1;
  const displayedSessions = filteredSessions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const kpiCards = [
    { label: 'Parked vehicles', value: stats?.occupiedSlots ?? 0, unit: 'vehicles', icon: Car, color: '#FF4C4C' },
    { label: 'Available slots', value: stats?.availableSlots ?? 0, unit: 'slots', icon: MapPin, color: '#FF4C4C' },
    { label: 'Occupancy rate', value: `${occupancyPct}%`, unit: '', icon: TrendingUp, color: '#A78BFA' },
    { label: 'Active sessions', value: stats?.activeSessions ?? 0, unit: 'sessions', icon: Clock, color: '#34D399' },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--admin-text-primary)' }}>
              Building Overview
            </h2>
            {buildingName && (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#FF4C4C]/10 text-[#FF4C4C]">
                <Building2 size={12} />
                {buildingName}
              </span>
            )}
          </div>
          <p className="text-sm capitalize" style={{ color: 'var(--admin-text-faint)' }}>{today}</p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="p-2.5 rounded-xl transition-colors"
          style={{ backgroundColor: 'var(--admin-bg-card)', color: 'var(--admin-text-muted)' }}
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{apiError}</p>
        </div>
      )}



      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, unit, icon: Icon, color }) => (
          <div key={label} className="glass-card p-5 rounded-2xl">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${color}20` }}>
                <Icon size={20} style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--admin-text-primary)' }}>
              {typeof value === 'number' ? value.toLocaleString('en-US') : value}
              {unit && <span className="text-sm font-normal ml-1" style={{ color: 'var(--admin-text-faint)' }}>{unit}</span>}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--admin-text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Occupancy + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Occupancy */}
        <div className="glass-card p-6 rounded-2xl flex flex-col gap-5">
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--admin-text-primary)' }}>
              Parking Status
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--admin-text-faint)' }}>Real-time data</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--admin-text-muted)' }}>Occupancy Rate</span>
              <span className="font-semibold text-[#FF4C4C]">{occupancyPct}%</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--admin-bg-card)' }}>
              <div
                className="h-full rounded-full transition-all duration-700 bg-[#FF4C4C]"
                style={{ width: `${Math.min(occupancyPct, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Slots', value: stats?.totalSlots ?? 0 },
              { label: 'Occupied', value: stats?.occupiedSlots ?? 0, red: true },
              { label: 'Available', value: stats?.availableSlots ?? 0 },
            ].map(item => (
              <div key={item.label} className="rounded-xl px-3 py-3 text-center" style={{ backgroundColor: 'var(--admin-bg-card)' }}>
                <p className={`text-xl font-bold ${item.red ? 'text-[#FF4C4C]' : ''}`} style={item.red ? {} : { color: 'var(--admin-text-primary)' }}>
                  {item.value.toLocaleString('en-US')}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--admin-text-faint)' }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Today summary */}
        <div className="glass-card p-6 rounded-2xl flex flex-col gap-5">
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--admin-text-primary)' }}>
              Today's Summary
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--admin-text-faint)' }}>In assigned building</p>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Completed sessions', value: todayCompleted, unit: 'sessions' },
              { label: 'Today\'s revenue', value: `${vnd(todayRevenue)} VND`, unit: '' },
              { label: 'Overtime vehicles', value: overdueCount, unit: 'vehicles', warn: overdueCount > 0 },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--admin-border)' }}>
                <span className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>{item.label}</span>
                <span className={`text-base font-bold ${item.warn ? 'text-red-400' : ''}`} style={item.warn ? {} : { color: 'var(--admin-text-primary)' }}>
                  {typeof item.value === 'number' ? item.value.toLocaleString('en-US') : item.value}
                  {item.unit && <span className="text-xs font-normal ml-1" style={{ color: 'var(--admin-text-faint)' }}>{item.unit}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent sessions */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ borderColor: 'var(--admin-border)' }}>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold" style={{ color: 'var(--admin-text-primary)' }}>
              Recent Parking Sessions
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--admin-bg-surface)', color: 'var(--admin-text-muted)' }}>
              {filteredSessions.length} sessions
            </span>
          </div>
          
          {/* Filter Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--admin-text-faint)' }} />
            <input
              type="text"
              placeholder="Filter by license plate..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="text-sm pl-9 pr-4 py-2 rounded-lg outline-none w-full sm:w-64 transition-all"
              style={{
                backgroundColor: 'var(--admin-bg-surface)',
                color: 'var(--admin-text-primary)',
                border: '1px solid var(--admin-border)'
              }}
            />
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm" style={{ color: 'var(--admin-text-faint)' }}>
            No data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--admin-border)' }}>
                  {['License Plate', 'Floor / Slot', 'Entry Time', 'Exit Time', 'Fee', 'Status'].map(h => (
                    <th key={h} className="text-left text-xs font-medium px-4 py-3 first:pl-6" style={{ color: 'var(--admin-text-faint)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedSessions.map(s => (
                  <tr key={s.id} className="border-b last:border-0 transition-colors" style={{ borderColor: 'var(--admin-border)' }}>
                    <td className="px-6 py-3.5">
                      <span className="text-sm font-mono font-semibold" style={{ color: 'var(--admin-text-primary)' }}>{s.licensePlate}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>{s.floorName}</p>
                      <p className="text-[10px]" style={{ color: 'var(--admin-text-faint)' }}>{s.slotNumber}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-0.5 text-sm" style={{ color: 'var(--admin-text-muted)' }}>
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} style={{ color: 'var(--admin-text-faint)' }} />
                          {new Date(s.entryTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </div>
                        <span className="text-[10px]" style={{ color: 'var(--admin-text-faint)' }}>
                          {new Date(s.entryTime).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-0.5 text-sm" style={{ color: 'var(--admin-text-muted)' }}>
                        {s.exitTime ? (
                          <>
                            <span style={{ color: 'var(--admin-text-muted)' }}>
                              {new Date(s.exitTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </span>
                            <span className="text-[10px]" style={{ color: 'var(--admin-text-faint)' }}>
                              {new Date(s.exitTime).toLocaleDateString('en-GB')}
                            </span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--admin-text-muted)' }}>-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>
                        {s.totalFee > 0 ? `${vnd(s.totalFee)} VND` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {s.status === 'Completed' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                          <CheckCircle2 size={11} />
                          Completed
                        </span>
                      ) : s.status === 'Overdue' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-400/10 text-red-400">
                          <AlertTriangle size={11} />
                          Overdue
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FF4C4C]/10 text-[#FF4C4C]">
                          <span className="w-1.5 h-1.5 bg-[#FF4C4C] rounded-full animate-pulse" />
                          Parked
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {recentSessions.length > itemsPerPage && (
          <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--admin-border)' }}>
            <span className="text-xs" style={{ color: 'var(--admin-text-faint)' }}>
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, recentSessions.length)} of {recentSessions.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg disabled:opacity-50 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--admin-text-primary)' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium min-w-[3rem] text-center" style={{ color: 'var(--admin-text-primary)' }}>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg disabled:opacity-50 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--admin-text-primary)' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
