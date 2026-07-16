/**
 * Admin/Reports.tsx
 * Branch: Feature/AdminReports-Settings
 * Admin overall report — system-wide overview
 *
 * Features:
 *  - KPI: total users, total buildings, vehicles currently parked, today's revenue
 *  - 7-day revenue chart (BarChart)
 *  - Vehicle type distribution chart (horizontal)
 *  - Table of 10 most recent sessions
 *  - Date filter
 */

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  BarChart3, Car, Banknote, Users, Building2,
  CheckCircle2, AlertTriangle, Loader2, RefreshCw,
  Calendar, ArrowUpRight, TrendingUp, Clock,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getBuildings } from '../../services/buildingsService';
import { searchSessions } from '../../services/sessionsService';
import type { SessionDto } from '../../services/sessionsService';
import { getUsers } from '../../services/usersService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const vnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n);

function toLocalDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { label: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()], date: toLocalDateStr(d) };
  });
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────

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

export default function AdminReports() {
  const { token } = useAuth();

  // KPI
  const [totalUsers,    setTotalUsers]    = useState(0);
  const [totalBuildings, setTotalBuildings] = useState(0);
  const [totalCapacity, setTotalCapacity]  = useState(0);
  const [activeCount,   setActiveCount]   = useState(0);
  const [overdueCount,  setOverdueCount]  = useState(0);
  const [todayRevenue,  setTodayRevenue]  = useState(0);
  const [todayCompleted,setTodayCompleted]= useState(0);

  // Charts
  const [revenueData,    setRevenueData]    = useState<{ label: string; revenue: number }[]>([]);
  const [vehicleData,    setVehicleData]    = useState<{ name: string; count: number }[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionDto[]>([]);

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError,   setApiError]   = useState('');

  const today   = toLocalDateStr(new Date());
  const weekAgo = toLocalDateStr(new Date(Date.now() - 6 * 86400_000));
  const [fromDate, setFromDate] = useState(weekAgo);
  const [toDate,   setToDate]   = useState(today);

  // ─── Load ────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setApiError('');

    try {
      const PAGE_SIZE = 200;
      const sessionParams = {
        status: 'Completed' as const,
        fromDate: `${fromDate}T00:00:00Z`,
        toDate:   `${toDate}T23:59:59Z`,
        pageSize: PAGE_SIZE,
      };

      // Run in parallel: page 1 sessions + buildings + users
      const [firstPage, buildings, users] = await Promise.all([
        searchSessions({ ...sessionParams, page: 1 }, token),
        getBuildings(),
        getUsers(token),
      ]);

      // If there are multiple pages, fetch the remaining pages in parallel
      const allItems = [...firstPage.items];
      if (firstPage.totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: firstPage.totalPages - 1 }, (_, i) =>
            searchSessions({ ...sessionParams, page: i + 2 }, token)
          )
        );
        rest.forEach(r => allItems.push(...r.items));
      }
      const completedRes = { ...firstPage, items: allItems };

      // summary is global real-time stats, returned in every searchSessions response
      const { summary } = firstPage;

      setTotalUsers(users.length);
      setTotalBuildings(buildings.length);
      setTotalCapacity(buildings.reduce((s, b) => s + b.totalCapacity, 0));
      setActiveCount(summary.totalActive);
      setOverdueCount(summary.totalOverdue);
      setTodayRevenue(summary.totalRevenueToday);
      setTodayCompleted(summary.totalCompletedToday);

      // Revenue chart
      const last7 = getLast7Days();
      const rev: Record<string, number> = {};
      last7.forEach(d => { rev[d.date] = 0; });
      completedRes.items.forEach(s => {
        if (!s.exitTime) return;
        const dk = s.exitTime.split('T')[0];
        if (dk in rev) rev[dk] += s.totalFee;
      });
      setRevenueData(last7.map(d => ({ label: d.label, revenue: rev[d.date] ?? 0 })));

      // Vehicle distribution
      const vtCount: Record<string, number> = {};
      completedRes.items.forEach(s => {
        vtCount[s.vehicleTypeName] = (vtCount[s.vehicleTypeName] ?? 0) + 1;
      });
      setVehicleData(
        Object.entries(vtCount)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
      );

      setRecentSessions(completedRes.items.slice(0, 10));
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unable to load report.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, fromDate, toDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const occupancyPct = totalCapacity > 0 ? Math.round((activeCount / totalCapacity) * 100) : 0;
  const totalRevInRange = revenueData.reduce((s, d) => s + d.revenue, 0);

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
        <p className="text-sm text-white/40">Loading report...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Overall Report</h2>
          <p className="text-sm text-white/40 mt-0.5">System-wide overview — Admin View</p>
        </div>
        <div className="flex items-center gap-2">
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
          <button onClick={() => loadData(true)} disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white">
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

      {/* System KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'System Accounts', value: totalUsers.toLocaleString('vi-VN'), unit: 'users', icon: Users,     color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5' },
          { label: 'Managed Buildings',    value: totalBuildings.toLocaleString('vi-VN'), unit: `${totalCapacity} total slots`, icon: Building2, color: '#A78BFA', bg: 'from-violet-400/20 to-violet-400/5' },
          { label: 'Vehicles Parked (real-time)', value: activeCount.toLocaleString('vi-VN'), unit: `${occupancyPct}% occupied`, icon: Car, color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5' },
          { label: "Today's Revenue",  value: vnd(todayRevenue),                      unit: todayCompleted + ' sessions · today', icon: Banknote, color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-card p-5 rounded-2xl">
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${card.bg} w-fit mb-4`}>
                <Icon size={19} style={{ color: card.color }} />
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="text-sm text-white/50 mt-1">{card.label}</p>
              <p className="text-xs text-white/30 mt-0.5">{card.unit}</p>
            </div>
          );
        })}
      </div>

      {/* Alert row */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 px-5 py-3.5 bg-red-400/10 border border-red-400/20 rounded-xl">
          <AlertTriangle size={16} className="text-red-400 shrink-0 animate-pulse" />
          <p className="text-sm text-red-400 font-medium">
            <span className="font-bold">{overdueCount}</span> vehicle(s) overdue for parking — needs immediate action
          </p>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Revenue chart */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">7-Day Revenue</h3>
              <p className="text-xs text-white/40 mt-0.5">Total: {vnd(totalRevInRange)}đ</p>
            </div>
            <BarChart3 size={16} className="text-white/20" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#ffffff66', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#ffffff66', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip content={<ChartTooltip color="#FF4C4C" formatter={v => `${vnd(v)}đ`} />}
                cursor={{ fill: '#ffffff05' }} />
              <Bar dataKey="revenue" radius={[6,6,0,0]}>
                {revenueData.map((entry, i) => (
                  <Cell key={i}
                    fill={entry.revenue === Math.max(...revenueData.map(d => d.revenue)) ? '#FF4C4C' : '#FF4C4C99'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Vehicle type chart */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">Vehicle Count by Type</h3>
              <p className="text-xs text-white/40 mt-0.5">Within the selected report period</p>
            </div>
            <TrendingUp size={16} className="text-white/20" />
          </div>
          {vehicleData.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-white/30 text-sm">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={vehicleData} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#ffffff66', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#ffffff88', fontSize: 12 }}
                  axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<ChartTooltip color="#FF4C4C" formatter={v => `${v} sessions`} />}
                  cursor={{ fill: '#ffffff05' }} />
                <Bar dataKey="count" fill="#FF4C4C" radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent sessions */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Recent Parking Sessions (Completed)</h3>
          <span className="text-xs text-white/30">{recentSessions.length} sessions</span>
        </div>
        {recentSessions.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-white/30 text-sm">
            No data available in the selected period
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['License Plate', 'Vehicle Type', 'Building', 'Entry Time', 'Exit Time', 'Duration', 'Fee Collected'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-white/40 px-4 py-3 first:pl-6">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentSessions.map(s => (
                  <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                    <td className="px-6 py-3"><span className="font-mono font-semibold text-sm text-white">{s.licensePlate}</span></td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-[#FF4C4C]/10 text-[#FF4C4C] px-2 py-0.5 rounded-full">{s.vehicleTypeName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-white/60">{s.buildingName}</p>
                      <p className="text-[10px] text-white/30">{s.floorName} · {s.slotNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-white/60">
                        <Clock size={11} className="text-white/30" />
                        {new Date(s.entryTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.exitTime ? (
                        <div className="flex items-center gap-1.5 text-xs text-white/60">
                          <CheckCircle2 size={11} className="text-[#FF4C4C]" />
                          {new Date(s.exitTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      ) : <span className="text-white/30 text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3"><span className="text-xs text-white/60">{s.duration || '—'}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm font-semibold text-[#FF4C4C]">
                        <ArrowUpRight size={13} />{vnd(s.totalFee)}đ
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
