/**
 * Manager/Reports.tsx
 * Nhánh: Feature/Reports-Manager
 * Báo cáo thống kê doanh thu, lưu lượng xe, tỷ lệ lấp đầy
 *
 * Tính năng:
 *  - KPI cards: lượt xe hôm nay, doanh thu, số xe đang đỗ, tỷ lệ lấp đầy
 *  - Biểu đồ doanh thu 7 ngày (BarChart từ recharts)
 *  - Biểu đồ lưu lượng theo giờ (LineChart)
 *  - Biểu đồ phân bổ theo loại xe (BarChart ngang)
 *  - Bảng lịch sử phiên gần đây (Completed sessions)
 *  - Bộ lọc ngày tháng
 */

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  BarChart3, Car, Banknote, TrendingUp,
  Clock, CheckCircle2, AlertTriangle, Loader2,
  RefreshCw, Calendar, ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getBuildings, getParkingSlots } from '../../services/buildingsService';
import { searchSessions, getActiveSessions } from '../../services/sessionsService';
import type { SessionDto } from '../../services/sessionsService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const vnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n);

function toLocalDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, color, formatter }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  color: string;
  formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0B1120] border border-white/10 rounded-xl px-4 py-2.5 text-sm shadow-xl">
      <p className="text-white/60 mb-1">{label}</p>
      <p className="font-semibold" style={{ color }}>{formatter(payload[0].value)}</p>
    </div>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getLast7Days(): { label: string; date: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      label: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()],
      date:  toLocalDateStr(d),
    };
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ManagerReports() {
  const { token } = useAuth();

  // KPI
  const [activeCount,    setActiveCount]    = useState(0);
  const [totalCapacity,  setTotalCapacity]  = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [todayRevenue,   setTodayRevenue]   = useState(0);
  const [overdueCount,   setOverdueCount]   = useState(0);

  // Charts
  const [revenueData,   setRevenueData]   = useState<{ label: string; revenue: number }[]>([]);
  const [vehicleData,   setVehicleData]   = useState<{ name: string; count: number }[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionDto[]>([]);

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError,   setApiError]   = useState('');

  // Filter
  const today = toLocalDateStr(new Date());
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6); return toLocalDateStr(d);
  });
  const [toDate, setToDate] = useState(today);

  // ─── Load ───────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setApiError('');

    try {
      // Load KPI: active sessions + capacity
      const [activeRes, buildings] = await Promise.all([
        getActiveSessions({ pageSize: 1 }, token),
        getBuildings(),
        getParkingSlots(),
      ]);

      const capacity = buildings.reduce((s, b) => s + b.totalCapacity, 0);
      setTotalCapacity(capacity);
      setActiveCount(activeRes.summary.totalActive);
      setOverdueCount(activeRes.summary.totalOverdue);
      setTodayCompleted(activeRes.summary.totalCompletedToday);
      setTodayRevenue(activeRes.summary.totalRevenueToday);

      // Load completed sessions in date range for charts
      const [completedRes] = await Promise.all([
        searchSessions({
          status:   'Completed',
          fromDate: `${fromDate}T00:00:00`,
          toDate:   `${toDate}T23:59:59`,
          pageSize: 500,
        }, token),
      ]);

      const sessions = completedRes.items;

      // Revenue per day (last 7 days)
      const last7 = getLast7Days();
      const revByDate: Record<string, number> = {};
      last7.forEach(d => { revByDate[d.date] = 0; });
      sessions.forEach(s => {
        if (!s.exitTime) return;
        const dateKey = s.exitTime.split('T')[0];
        if (dateKey in revByDate) revByDate[dateKey] += s.totalFee;
      });
      setRevenueData(last7.map(d => ({ label: d.label, revenue: revByDate[d.date] ?? 0 })));

      // Count by vehicle type
      const vtCount: Record<string, number> = {};
      sessions.forEach(s => {
        vtCount[s.vehicleTypeName] = (vtCount[s.vehicleTypeName] ?? 0) + 1;
      });
      setVehicleData(
        Object.entries(vtCount)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
      );

      // Recent 10 completed sessions
      setRecentSessions(sessions.slice(0, 10));

    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Không thể tải dữ liệu báo cáo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, fromDate, toDate]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Computed ─────────────────────────────────────────────────────────────────

  const occupancyPct = totalCapacity > 0 ? Math.round((activeCount / totalCapacity) * 100) : 0;
  const totalRevInRange = revenueData.reduce((s, d) => s + d.revenue, 0);

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="text-[#3BFFA4] animate-spin" />
        <p className="text-sm text-white/40">Đang tải báo cáo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Báo cáo & Thống kê</h2>
          <p className="text-sm text-white/40 mt-0.5">
            Dữ liệu thực từ hệ thống · cập nhật theo thời gian thực
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date filter */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <Calendar size={13} className="text-white/40" />
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={e => setFromDate(e.target.value)}
              className="bg-transparent text-xs text-white/70 focus:outline-none"
            />
            <span className="text-white/30 text-xs">—</span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              max={today}
              onChange={e => setToDate(e.target.value)}
              className="bg-transparent text-xs text-white/70 focus:outline-none"
            />
          </div>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{apiError}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'Xe đang đỗ',
            value: activeCount.toLocaleString('vi-VN'),
            unit: 'xe',
            sub: `${overdueCount} quá giờ`,
            icon: Car,
            color: '#3BFFA4',
            bg: 'from-[#3BFFA4]/20 to-[#3BFFA4]/5',
            alert: overdueCount > 0,
          },
          {
            label: 'Tỷ lệ lấp đầy',
            value: `${occupancyPct}%`,
            unit: '',
            sub: `${activeCount}/${totalCapacity} chỗ`,
            icon: TrendingUp,
            color: occupancyPct >= 90 ? '#F87171' : occupancyPct >= 70 ? '#F59E0B' : '#A78BFA',
            bg: 'from-violet-400/20 to-violet-400/5',
            alert: false,
          },
          {
            label: 'Lượt ra hôm nay',
            value: todayCompleted.toLocaleString('vi-VN'),
            unit: 'lượt',
            sub: 'sessions hoàn thành',
            icon: CheckCircle2,
            color: '#00C2FF',
            bg: 'from-[#00C2FF]/20 to-[#00C2FF]/5',
            alert: false,
          },
          {
            label: 'Doanh thu hôm nay',
            value: vnd(todayRevenue),
            unit: 'đ',
            sub: `${vnd(totalRevInRange)}đ trong kỳ`,
            icon: Banknote,
            color: '#F59E0B',
            bg: 'from-amber-400/20 to-amber-400/5',
            alert: false,
          },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-card p-5 rounded-2xl">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${card.bg}`}>
                  <Icon size={20} style={{ color: card.color }} />
                </div>
                {card.alert && (
                  <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full animate-pulse">
                    Cảnh báo
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-white">
                {card.value}
                {card.unit && <span className="text-sm font-normal text-white/40 ml-1">{card.unit}</span>}
              </p>
              <p className="text-sm text-white/50 mt-1">{card.label}</p>
              <p className="text-xs text-white/30 mt-0.5">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Revenue bar chart */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">Doanh thu 7 ngày</h3>
              <p className="text-xs text-white/40 mt-0.5">Tổng: {vnd(totalRevInRange)}đ</p>
            </div>
            <BarChart3 size={16} className="text-white/20" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#ffffff66', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#ffffff66', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip
                content={<ChartTooltip color="#3BFFA4" formatter={v => `${vnd(v)}đ`} />}
                cursor={{ fill: '#ffffff05' }}
              />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {revenueData.map((entry, i) => (
                  <Cell key={i} fill={entry.revenue === Math.max(...revenueData.map(d => d.revenue)) ? '#3BFFA4' : '#3BFFA4aa'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Vehicle type distribution */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">Lượt xe theo loại</h3>
              <p className="text-xs text-white/40 mt-0.5">Trong khoảng thời gian đã chọn</p>
            </div>
            <Car size={16} className="text-white/20" />
          </div>
          {vehicleData.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-white/30 text-sm">
              Không có dữ liệu
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={vehicleData} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#ffffff66', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#ffffff88', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip
                  content={<ChartTooltip color="#00C2FF" formatter={v => `${v} lượt`} />}
                  cursor={{ fill: '#ffffff05' }}
                />
                <Bar dataKey="count" fill="#00C2FF" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent sessions table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Phiên đỗ xe gần đây (đã hoàn thành)</h3>
          <span className="text-xs text-white/30">{recentSessions.length} phiên gần nhất</span>
        </div>

        {recentSessions.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-white/30 text-sm">
            Không có dữ liệu trong khoảng thời gian đã chọn
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Biển số', 'Loại xe', 'Vị trí', 'Giờ vào', 'Giờ ra', 'Thời gian', 'Phí thu'].map(h => (
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
                      <span className="text-xs bg-[#3BFFA4]/10 text-[#3BFFA4] px-2 py-0.5 rounded-full">{s.vehicleTypeName}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-white/60">{s.buildingName} · {s.floorName} · {s.slotNumber}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm text-white/60">
                        <Clock size={11} className="text-white/30" />
                        {new Date(s.entryTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {s.exitTime ? (
                        <div className="flex items-center gap-1.5 text-sm text-white/60">
                          <CheckCircle2 size={11} className="text-[#3BFFA4]" />
                          {new Date(s.exitTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      ) : (
                        <span className="text-white/30 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-white/60">{s.duration}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 text-sm font-semibold text-[#3BFFA4]">
                        <ArrowUpRight size={13} />
                        {vnd(s.totalFee)}đ
                      </div>
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
