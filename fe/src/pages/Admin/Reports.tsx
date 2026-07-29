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

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { useTheme } from '../../hooks/useTheme';
import { getBuildings } from '../../services/buildingsService';
import { searchSessions } from '../../services/sessionsService';
import type { SessionDto } from '../../services/sessionsService';
import { getUsers } from '../../services/usersService';
import { getTransactions } from '../../services/paymentService';
import type { TransactionHistoryResult, PaymentListItem } from '../../services/paymentService';

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
    const weekday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    return { label: `${weekday} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, date: toLocalDateStr(d) };
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
  const { theme } = useTheme();
  const axisTickColor = theme === 'dark' ? '#ffffff66' : '#0A0A0C99';
  const gridStroke = theme === 'dark' ? '#ffffff0d' : '#0000000d';
  const cursorFill = theme === 'dark' ? '#ffffff05' : '#00000005';

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
  const [txResult,       setTxResult]       = useState<TransactionHistoryResult | null>(null);
  const [activeTab,      setActiveTab]      = useState<'Parking' | 'Booking' | 'Subscription' | 'TopUp'>('Parking');
  const [txPage,         setTxPage]         = useState(1);
  const TX_PAGE_SIZE = 10;

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError,   setApiError]   = useState('');

  const today   = toLocalDateStr(new Date());
  const weekAgo = toLocalDateStr(new Date(Date.now() - 6 * 86400_000));
  const [fromDate, setFromDate] = useState(today);
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

      // Run in parallel: page 1 sessions + buildings + users + transactions
      const [firstPage, buildings, users, txRes] = await Promise.all([
        searchSessions({ ...sessionParams, page: 1 }),
        getBuildings(),
        getUsers(),
        getTransactions({
          fromDate: `${fromDate}T00:00:00Z`,
          toDate:   `${toDate}T23:59:59Z`,
          pageSize: 1000
        })
      ]);

      // If there are multiple pages, fetch the remaining pages in parallel
      const allItems = [...firstPage.items];
      if (firstPage.totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: firstPage.totalPages - 1 }, (_, i) =>
            searchSessions({ ...sessionParams, page: i + 2 })
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
      setTodayRevenue(txRes.totalAmount); // Use totalAmount from Transactions instead
      setTodayCompleted(summary.totalCompletedToday);
      setTxResult(txRes);

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

  const isFirstLoad = useRef(true);
  useEffect(() => { 
    loadData(!isFirstLoad.current);
    isFirstLoad.current = false;
  }, [loadData]);

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
            <input type="date" value={fromDate} max={toDate}
              onChange={e => setFromDate(e.target.value)}
              className="bg-transparent text-xs text-white/70 focus:outline-none [color-scheme:dark]"
            />
            <span className="text-white/30 text-xs">—</span>
            <input type="date" value={toDate} min={fromDate} max={today}
              onChange={e => setToDate(e.target.value)}
              className="bg-transparent text-xs text-white/70 focus:outline-none [color-scheme:dark]"
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
          { label: "Total Revenue (In Period)",  value: vnd(todayRevenue),                      unit: txResult ? `${txResult.totalCount} transactions` : '', icon: Banknote, color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5' },
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

      {/* Revenue Breakdown */}
      {txResult && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'Walk-in Revenue', value: vnd(txResult.parkingRevenue), color: '#34d399' },
            { label: 'Booking Revenue', value: vnd(txResult.bookingRevenue), color: '#fbbf24' },
            { label: 'Subscription Rev',value: vnd(txResult.subscriptionRevenue), color: '#f472b6' },
            { label: 'Top-Up Revenue',  value: vnd(txResult.topUpRevenue),   color: '#60a5fa' },
          ].map(stat => (
            <div key={stat.label} className="glass-card p-4 rounded-xl border-l-4" style={{ borderLeftColor: stat.color }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-1">{stat.label}</p>
              <p className="text-lg font-bold" style={{ color: stat.color }}>{stat.value} đ</p>
            </div>
          ))}
        </div>
      )}

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
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: axisTickColor, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip content={<ChartTooltip color="#FF4C4C" formatter={v => `${vnd(v)}đ`} />}
                cursor={{ fill: cursorFill }} />
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
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis type="number" tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: theme === 'dark' ? '#ffffff88' : '#0A0A0Ccc', fontSize: 12 }}
                  axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<ChartTooltip color="#FF4C4C" formatter={v => `${v} sessions`} />}
                  cursor={{ fill: cursorFill }} />
                <Bar dataKey="count" fill="#FF4C4C" radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>



      {/* Transactions History */}
      {txResult && (
        <div className="glass-card rounded-2xl overflow-hidden mt-6">
          <div className="flex items-center overflow-x-auto border-b border-white/10">
            <button 
              onClick={() => { setActiveTab('Parking'); setTxPage(1); }}
              className={`px-6 py-4 text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 ${activeTab === 'Parking' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              Walk-in (Checkout)
            </button>
            <button 
              onClick={() => { setActiveTab('Booking'); setTxPage(1); }}
              className={`px-6 py-4 text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 ${activeTab === 'Booking' ? 'border-amber-500 text-amber-400' : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              Booking
            </button>
            <button 
              onClick={() => { setActiveTab('Subscription'); setTxPage(1); }}
              className={`px-6 py-4 text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 ${activeTab === 'Subscription' ? 'border-pink-500 text-pink-400' : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              Monthly Pass
            </button>
            <button 
              onClick={() => { setActiveTab('TopUp'); setTxPage(1); }}
              className={`px-6 py-4 text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 ${activeTab === 'TopUp' ? 'border-blue-500 text-blue-400' : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              Wallet Top-Up
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-white/50">
                <tr>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">ID</th>
                  <th className="py-3 px-4 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Method</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold w-1/3">Description</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filteredItems = txResult.items.filter(x => x.transactionType === activeTab);
                  const totalTxPages = Math.ceil(filteredItems.length / TX_PAGE_SIZE);
                  const paginatedItems = filteredItems.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE);
                  
                  if (filteredItems.length === 0) {
                    return (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-white/50">
                          No transactions found for this type.
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <>
                      {paginatedItems.map(tx => (
                        <tr key={tx.paymentId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs text-white/60">{tx.paymentId.substring(0,8)}...</td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-white">{tx.userFullName || 'Guest'}</div>
                            <div className="text-xs text-white/40">{tx.userEmail || ''}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded-md text-xs font-mono font-bold border border-blue-500/20">{tx.paymentMethod}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-white/90">{vnd(tx.amount)} đ</td>
                          <td className="py-3 px-4 text-white/70 text-xs leading-relaxed">{tx.description}</td>
                          <td className="py-3 px-4 text-white/60 text-xs">{new Date(tx.paymentDate).toLocaleString('en-GB')}</td>
                          <td className="py-3 px-4 flex justify-center">
                            {tx.status === 'Success' && <span className="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 w-max"><CheckCircle2 size={12}/> Success</span>}
                            {tx.status === 'Pending' && <span className="bg-amber-500/10 text-amber-500 px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 w-max"><Clock size={12}/> Pending</span>}
                            {tx.status !== 'Success' && tx.status !== 'Pending' && <span className="bg-red-500/10 text-red-500 px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 w-max"><AlertTriangle size={12}/> {tx.status}</span>}
                          </td>
                        </tr>
                      ))}
                      {totalTxPages > 1 && (
                        <tr>
                          <td colSpan={7} className="py-4 px-6 border-t border-white/10">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-white/40">
                                Showing {((txPage - 1) * TX_PAGE_SIZE) + 1} to {Math.min(txPage * TX_PAGE_SIZE, filteredItems.length)} of {filteredItems.length} entries
                              </span>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => setTxPage(p => Math.max(1, p - 1))}
                                  disabled={txPage === 1}
                                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-white/70 transition-colors"
                                >
                                  Previous
                                </button>
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: totalTxPages }, (_, i) => i + 1).map(page => (
                                    <button
                                      key={page}
                                      onClick={() => setTxPage(page)}
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${txPage === page ? 'bg-[#FF4C4C] text-white' : 'bg-transparent text-white/50 hover:bg-white/5 hover:text-white'}`}
                                    >
                                      {page}
                                    </button>
                                  ))}
                                </div>
                                <button 
                                  onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))}
                                  disabled={txPage === totalTxPages}
                                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-white/70 transition-colors"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
