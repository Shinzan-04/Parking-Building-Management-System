import { useState, useEffect, useCallback } from 'react';
import { Car, Banknote, TrendingUp, Clock, CheckCircle2, AlertTriangle, Loader2, RefreshCw, MapPin } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import { getBuildings, getParkingSlots, isSlotOccupied } from '../../services/buildingsService';
import { searchSessions } from '../../services/sessionsService';
import type { SessionDto } from '../../services/sessionsService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const vnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n);

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getLast7Days(): { label: string; date: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      label: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()],
      date: toDateStr(d),
    };
  });
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, color, formatter }: {
  active?: boolean; payload?: { value: number }[]; label?: string;
  color: string; formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--admin-bg-surface)] border border-white/10 rounded-xl px-4 py-2.5 text-sm shadow-xl">
      <p className="text-white/60 mb-1">{label}</p>
      <p className="font-semibold" style={{ color }}>{formatter(payload[0].value)}</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ManagerDashboard() {
  const { token } = useAuth();

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // KPI
  const [activeCount,    setActiveCount]    = useState(0);
  const [overdueCount,   setOverdueCount]   = useState(0);
  const [totalCapacity,  setTotalCapacity]  = useState(0);
  const [todayRevenue,   setTodayRevenue]   = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(0);

  // Charts + table
  const [revenueData,    setRevenueData]    = useState<{ day: string; revenue: number }[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionDto[]>([]);

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError,   setApiError]   = useState('');

  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setApiError('');

    try {
      const last7    = getLast7Days();
      const weekAgo  = last7[0].date;
      const todayStr = last7[6].date;

      const [firstPage, buildings, slots] = await Promise.all([
        searchSessions({
          status: 'Completed',
          fromDate: `${weekAgo}T00:00:00Z`,
          toDate:   `${todayStr}T23:59:59Z`,
          pageSize: 200,
        }, token),
        getBuildings(),
        getParkingSlots(),
      ]);

      // Fetch remaining pages if needed
      let allCompleted = [...firstPage.items];
      if (firstPage.totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: firstPage.totalPages - 1 }, (_, i) =>
            searchSessions({
              status: 'Completed',
              fromDate: `${weekAgo}T00:00:00Z`,
              toDate:   `${todayStr}T23:59:59Z`,
              pageSize: 200,
              page: i + 2,
            }, token)
          )
        );
        rest.forEach(r => allCompleted.push(...r.items));
      }

      const { summary } = firstPage;
      const totalCap = buildings.reduce((s, b) => s + b.totalCapacity, 0);
      const occupied = slots.filter(s => isSlotOccupied(s.status)).length;

      setTotalCapacity(totalCap);
      setActiveCount(occupied);
      setOverdueCount(summary.totalOverdue);
      setTodayRevenue(summary.totalRevenueToday);
      setTodayCompleted(summary.totalCompletedToday);

      // Revenue chart — group by exit date
      const rev: Record<string, number> = {};
      last7.forEach(d => { rev[d.date] = 0; });
      allCompleted.forEach(s => {
        if (!s.exitTime) return;
        const dk = s.exitTime.split('T')[0];
        if (dk in rev) rev[dk] += s.totalFee;
      });
      setRevenueData(last7.map(d => ({ day: d.label, revenue: rev[d.date] ?? 0 })));

      // Recent sessions table — 6 most recent completed
      setRecentSessions(allCompleted.slice(0, 6));
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // Lắng nghe sự kiện Realtime (SignalR) được phát từ useNotification
  useEffect(() => {
    const handleUpdate = () => {
      // Gọi refresh (cập nhật background, không hiện loader tròn giữa màn hình)
      loadData(true);
    };

    window.addEventListener('dashboardUpdate', handleUpdate);
    window.addEventListener('slotUpdate', handleUpdate);

    return () => {
      window.removeEventListener('dashboardUpdate', handleUpdate);
      window.removeEventListener('slotUpdate', handleUpdate);
    };
  }, [loadData]);

  const available    = totalCapacity - activeCount;
  const occupancyPct = totalCapacity > 0 ? Math.round((activeCount / totalCapacity) * 1000) / 10 : 0;
  const maxRevenue   = Math.max(...revenueData.map(d => d.revenue), 1);

  const stats = [
    { label: 'Xe đang đỗ',        value: activeCount.toLocaleString('vi-VN'),  unit: 'xe',  icon: Car,        color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5'  },
    { label: 'Chỗ còn trống',     value: available.toLocaleString('vi-VN'),    unit: 'chỗ', icon: MapPin,     color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5'  },
    { label: 'Doanh thu hôm nay', value: vnd(todayRevenue),                    unit: 'đ',   icon: Banknote,   color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5'  },
    { label: 'Tỷ lệ lấp đầy',    value: `${occupancyPct}%`,                   unit: '',    icon: TrendingUp, color: '#A78BFA', bg: 'from-violet-400/20 to-violet-400/5' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
        <p className="text-sm text-white/40">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Tổng quan hoạt động</h2>
          <p className="text-sm text-white/40 capitalize mt-0.5">{today}</p>
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

      {overdueCount > 0 && (
        <div className="flex items-center gap-3 px-5 py-3.5 bg-red-400/10 border border-red-400/20 rounded-xl">
          <AlertTriangle size={16} className="text-red-400 shrink-0 animate-pulse" />
          <p className="text-sm text-red-400 font-medium">
            <span className="font-bold">{overdueCount}</span> xe đang quá giờ đỗ — cần xử lý ngay
          </p>
        </div>
      )}

      {/* KPI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass-card p-5 rounded-2xl">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.bg}`}>
                  <Icon size={20} style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">
                {stat.value}
                {stat.unit && <span className="text-sm font-normal text-white/40 ml-1">{stat.unit}</span>}
              </p>
              <p className="text-sm text-white/50 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Revenue bar chart */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">Doanh thu 7 ngày qua</h3>
              <p className="text-xs text-white/40 mt-0.5">
                Tổng: {vnd(revenueData.reduce((s, d) => s + d.revenue, 0))}đ
              </p>
            </div>
            <span className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full">7 ngày gần nhất</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#ffffff66', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#ffffff66', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v =>
                  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
                  : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k`
                  : String(v)
                }
              />
              <Tooltip content={<ChartTooltip color="#FF4C4C" formatter={v => `${vnd(v)}đ`} />} cursor={{ fill: '#ffffff05' }} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {revenueData.map((entry, i) => (
                  <Cell key={i} fill={entry.revenue === maxRevenue && entry.revenue > 0 ? '#FF4C4C' : '#FF4C4C55'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Occupancy panel */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between gap-5">
          <div>
            <h3 className="text-base font-semibold text-white mb-1">Tình trạng bãi đỗ</h3>
            <p className="text-xs text-white/40">Dữ liệu real-time</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Tỷ lệ lấp đầy</span>
              <span className="font-semibold text-[#FF4C4C]">{occupancyPct}%</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(occupancyPct, 100)}%`,
                  backgroundColor: occupancyPct >= 90 ? '#F87171' : occupancyPct >= 70 ? '#FF4C4C' : '#FF4C4C',
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Tổng chỗ',  value: totalCapacity, color: 'text-white' },
              { label: 'Đang dùng', value: activeCount,   color: 'text-[#FF4C4C]' },
              { label: 'Còn trống', value: available,     color: 'text-[#FF4C4C]' },
            ].map(item => (
              <div key={item.label} className="bg-white/5 rounded-xl px-3 py-3 text-center">
                <p className={`text-xl font-bold ${item.color}`}>{item.value.toLocaleString('vi-VN')}</p>
                <p className="text-xs text-white/40 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Lượt hoàn thành hôm nay', value: todayCompleted, color: 'text-white/80' },
              { label: 'Xe quá giờ',               value: overdueCount,  color: overdueCount > 0 ? 'text-red-400' : 'text-white/80' },
            ].map(item => (
              <div key={item.label} className="bg-white/5 rounded-xl px-3 py-3">
                <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-white/40 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent sessions table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Phiên đỗ xe gần đây</h3>
          <span className="text-xs text-white/30">{recentSessions.length} phiên gần nhất (7 ngày)</span>
        </div>

        {recentSessions.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-white/30 text-sm">
            Không có dữ liệu trong 7 ngày qua
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Biển số', 'Tòa nhà / Chỗ', 'Giờ vào', 'Giờ ra', 'Thời gian', 'Phí', 'Trạng thái'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-white/40 px-4 py-3 first:pl-6">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentSessions.map(s => (
                  <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                    <td className="px-6 py-3.5">
                      <span className="text-sm font-mono font-semibold text-white">{s.licensePlate}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs text-white/60">{s.buildingName}</p>
                      <p className="text-[10px] text-white/30">{s.floorName} · {s.slotNumber}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm text-white/70">
                        <Clock size={12} className="text-white/30" />
                        {new Date(s.entryTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-white/70">
                        {s.exitTime
                          ? new Date(s.exitTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-white/70">{s.duration || '—'}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-medium text-white">
                        {s.totalFee > 0 ? `${vnd(s.totalFee)}đ` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {s.status === 'Completed' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-white/50">
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
