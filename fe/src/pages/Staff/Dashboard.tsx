import { useState, useEffect, useCallback } from 'react';
import { Car, MapPin, TrendingUp, Clock, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Building2 } from 'lucide-react';
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

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const [stats, setStats]               = useState<DashboardStats | null>(null);
  const [buildingName, setBuildingName] = useState<string>('');
  const [recentSessions, setRecentSessions] = useState<SessionDto[]>([]);
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
        searchSessions(sessionParams, token),
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
      setRecentSessions(sessionsRes.items.slice(0, 6));
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, buildingId]);

  useEffect(() => { loadData(); }, [loadData]);

  const vnd = (n: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
        <p className="text-sm" style={{ color: 'var(--admin-text-faint)' }}>Đang tải dữ liệu...</p>
      </div>
    );
  }

  const occupancyPct = stats && stats.totalSlots > 0
    ? Math.round((stats.occupiedSlots / stats.totalSlots) * 1000) / 10
    : 0;

  const kpiCards = [
    { label: 'Xe đang đỗ',        value: stats?.occupiedSlots ?? 0, unit: 'xe',  icon: Car,        color: '#FF4C4C' },
    { label: 'Chỗ còn trống',     value: stats?.availableSlots ?? 0, unit: 'chỗ', icon: MapPin,     color: '#FF4C4C' },
    { label: 'Tỷ lệ lấp đầy',    value: `${occupancyPct}%`,        unit: '',    icon: TrendingUp, color: '#A78BFA' },
    { label: 'Phiên đang hoạt động', value: stats?.activeSessions ?? 0, unit: 'phiên', icon: Clock, color: '#34D399' },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--admin-text-primary)' }}>
              Tổng quan tòa nhà
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

      {overdueCount > 0 && (
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl" style={{ backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <AlertTriangle size={16} className="text-red-400 shrink-0 animate-pulse" />
          <p className="text-sm text-red-400 font-medium">
            <span className="font-bold">{overdueCount}</span> xe đang quá giờ đỗ — cần xử lý ngay
          </p>
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
              {typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
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
              Tình trạng bãi đỗ
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--admin-text-faint)' }}>Dữ liệu real-time</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--admin-text-muted)' }}>Tỷ lệ lấp đầy</span>
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
              { label: 'Tổng chỗ',  value: stats?.totalSlots ?? 0 },
              { label: 'Đang dùng', value: stats?.occupiedSlots ?? 0, red: true },
              { label: 'Còn trống', value: stats?.availableSlots ?? 0 },
            ].map(item => (
              <div key={item.label} className="rounded-xl px-3 py-3 text-center" style={{ backgroundColor: 'var(--admin-bg-card)' }}>
                <p className={`text-xl font-bold ${item.red ? 'text-[#FF4C4C]' : ''}`} style={item.red ? {} : { color: 'var(--admin-text-primary)' }}>
                  {item.value.toLocaleString('vi-VN')}
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
              Tổng kết hôm nay
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--admin-text-faint)' }}>Trong tòa nhà được gán</p>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Lượt hoàn thành hôm nay', value: todayCompleted, unit: 'lượt' },
              { label: 'Doanh thu hôm nay',        value: `${vnd(todayRevenue)}đ`, unit: '' },
              { label: 'Xe quá giờ',               value: overdueCount, unit: 'xe', warn: overdueCount > 0 },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--admin-border)' }}>
                <span className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>{item.label}</span>
                <span className={`text-base font-bold ${item.warn ? 'text-red-400' : ''}`} style={item.warn ? {} : { color: 'var(--admin-text-primary)' }}>
                  {typeof item.value === 'number' ? item.value.toLocaleString('vi-VN') : item.value}
                  {item.unit && <span className="text-xs font-normal ml-1" style={{ color: 'var(--admin-text-faint)' }}>{item.unit}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent sessions */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--admin-border)' }}>
          <h3 className="text-base font-semibold" style={{ color: 'var(--admin-text-primary)' }}>
            Phiên đỗ xe gần đây
          </h3>
          <span className="text-xs" style={{ color: 'var(--admin-text-faint)' }}>
            {recentSessions.length} phiên gần nhất
          </span>
        </div>

        {recentSessions.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm" style={{ color: 'var(--admin-text-faint)' }}>
            Không có dữ liệu
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--admin-border)' }}>
                  {['Biển số', 'Tầng / Chỗ', 'Giờ vào', 'Giờ ra', 'Phí', 'Trạng thái'].map(h => (
                    <th key={h} className="text-left text-xs font-medium px-4 py-3 first:pl-6" style={{ color: 'var(--admin-text-faint)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentSessions.map(s => (
                  <tr key={s.id} className="border-b last:border-0 transition-colors" style={{ borderColor: 'var(--admin-border)' }}>
                    <td className="px-6 py-3.5">
                      <span className="text-sm font-mono font-semibold" style={{ color: 'var(--admin-text-primary)' }}>{s.licensePlate}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>{s.floorName}</p>
                      <p className="text-[10px]" style={{ color: 'var(--admin-text-faint)' }}>{s.slotNumber}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--admin-text-muted)' }}>
                        <Clock size={12} style={{ color: 'var(--admin-text-faint)' }} />
                        {new Date(s.entryTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
                        {s.exitTime
                          ? new Date(s.exitTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>
                        {s.totalFee > 0 ? `${vnd(s.totalFee)}đ` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {s.status === 'Completed' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--admin-bg-card)', color: 'var(--admin-text-muted)' }}>
                          <CheckCircle2 size={11} />
                          Đã ra
                        </span>
                      ) : s.status === 'Overdue' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-400/10 text-red-400">
                          <AlertTriangle size={11} />
                          Quá giờ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FF4C4C]/10 text-[#FF4C4C]">
                          <span className="w-1.5 h-1.5 bg-[#FF4C4C] rounded-full animate-pulse" />
                          Đang đỗ
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
