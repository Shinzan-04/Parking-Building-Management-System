/**
 * Staff/StaffDashboard.tsx
 * Nhánh: Feature/StaffDashboard
 * Dashboard ca trực cho nhân viên
 *
 * Tính năng:
 *  - KPI: xe đang đỗ, xe vào hôm nay, xe ra hôm nay, doanh thu ca
 *  - Đồng hồ ca trực (thời gian thực)
 *  - Quick action buttons: vào cổng vào / cổng ra
 *  - Danh sách phiên đang active (có thể xử lý)
 *  - Cảnh báo xe quá giờ
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Car, ArrowRightCircle, ArrowLeftCircle,
  Banknote, AlertTriangle, Clock, RefreshCw,
  Loader2, DoorOpen, CheckCircle2, Eye, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getActiveSessions, searchSessions } from '../../services/sessionsService';
import type { SessionDto } from '../../services/sessionsService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const vnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n);

function fmtDuration(entryISO: string) {
  const diff = Date.now() - new Date(entryISO).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}g ${m}p`;
}

function Clock24() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-center">
      <p className="text-5xl font-bold font-mono text-white tracking-widest">
        {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
      </p>
      <p className="text-sm text-white/40 mt-1">
        {now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
      </p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function StaffDashboard() {
  const { token } = useAuth();
  const navigate  = useNavigate();

  const [summary, setSummary]         = useState({ totalActive: 0, totalOverdue: 0, totalCompletedToday: 0, totalRevenueToday: 0 });
  const [activeSessions, setActiveSessions] = useState<SessionDto[]>([]);
  const [loading,    setLoading]       = useState(true);
  const [refreshing, setRefreshing]    = useState(false);
  const [apiError,   setApiError]      = useState('');

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setApiError('');

    try {
      const [kpiRes, sessRes] = await Promise.all([
        getActiveSessions({ pageSize: 1 }, token),
        searchSessions({ status: 'Active', pageSize: 20 }, token),
      ]);
      setSummary(kpiRes.summary);
      setActiveSessions(sessRes.items);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Không thể tải dữ liệu ca trực.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh mỗi 60 giây
  useEffect(() => {
    const id = setInterval(() => loadData(true), 60_000);
    return () => clearInterval(id);
  }, [loadData]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="text-emerald-400 animate-spin" />
        <p className="text-sm text-white/40">Đang tải ca trực...</p>
      </div>
    );
  }

  const overdueSessions = activeSessions.filter(s => s.status === 'Overdue');

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard ca trực</h2>
          <p className="text-sm text-white/40 mt-0.5">Tổng quan tình hình bãi đỗ theo thời gian thực</p>
        </div>
        <button onClick={() => loadData(true)} disabled={refreshing}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white">
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{apiError}</p>
        </div>
      )}

      {/* Clock + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Clock */}
        <div className="lg:col-span-1 glass-card p-6 rounded-2xl flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-400/15 flex items-center justify-center">
            <Clock size={22} className="text-emerald-400" />
          </div>
          <Clock24 />
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-400/10 border border-emerald-400/20 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Ca trực đang hoạt động</span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/gate-control')}
            className="group glass-card p-6 rounded-2xl flex flex-col items-start gap-4 hover:border-emerald-400/30 hover:bg-emerald-400/5 transition-all cursor-pointer text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-400/15 flex items-center justify-center group-hover:bg-emerald-400/25 transition-colors">
              <ArrowRightCircle size={22} className="text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-white text-base">Cổng vào</p>
              <p className="text-xs text-white/40 mt-0.5">Check-in xe + OCR biển số</p>
            </div>
            <div className="w-full flex items-center justify-between mt-auto">
              <span className="text-xs text-white/30">Nhấn để mở</span>
              <DoorOpen size={16} className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>

          <button
            onClick={() => navigate('/gate-control')}
            className="group glass-card p-6 rounded-2xl flex flex-col items-start gap-4 hover:border-[#00C2FF]/30 hover:bg-[#00C2FF]/5 transition-all cursor-pointer text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#00C2FF]/15 flex items-center justify-center group-hover:bg-[#00C2FF]/25 transition-colors">
              <ArrowLeftCircle size={22} className="text-[#00C2FF]" />
            </div>
            <div>
              <p className="font-semibold text-white text-base">Cổng ra</p>
              <p className="text-xs text-white/40 mt-0.5">Check-out xe + tính phí</p>
            </div>
            <div className="w-full flex items-center justify-between mt-auto">
              <span className="text-xs text-white/30">Nhấn để mở</span>
              <DoorOpen size={16} className="text-[#00C2FF] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Car,           label: 'Đang đỗ',        value: summary.totalActive,         color: '#3BFFA4', dot: false },
          { icon: AlertTriangle, label: 'Quá giờ',        value: summary.totalOverdue,         color: '#F87171', dot: summary.totalOverdue > 0 },
          { icon: CheckCircle2,  label: 'Đã ra hôm nay',  value: summary.totalCompletedToday,  color: '#00C2FF', dot: false },
          { icon: Banknote,      label: 'Doanh thu ca',   value: null,                          color: '#F59E0B', dot: false },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className={`glass-card px-4 py-3.5 rounded-2xl flex items-center gap-3 ${kpi.dot ? 'border-red-400/25' : ''}`}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${kpi.color}18` }}>
                <Icon size={17} style={{ color: kpi.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-white">
                  {kpi.value !== null ? kpi.value.toLocaleString('vi-VN') : `${vnd(summary.totalRevenueToday)}đ`}
                </p>
                <p className="text-xs text-white/40">{kpi.label}</p>
              </div>
              {kpi.dot && <span className="ml-auto w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Overdue alert */}
      {overdueSessions.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden border-red-400/20">
          <div className="px-5 py-3.5 border-b border-red-400/20 flex items-center gap-2.5 bg-red-400/5">
            <AlertTriangle size={15} className="text-red-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-red-400">
              {overdueSessions.length} xe quá giờ đỗ — cần xử lý
            </h3>
          </div>
          <div className="divide-y divide-white/5">
            {overdueSessions.map(s => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-400/10 flex items-center justify-center shrink-0">
                    <Car size={14} className="text-red-400" />
                  </div>
                  <div>
                    <p className="font-mono font-bold text-sm text-white">{s.licensePlate}</p>
                    <p className="text-xs text-white/40">{s.buildingName} · {s.floorName} · {s.slotNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-red-400 font-medium">{fmtDuration(s.entryTime)}</p>
                    <p className="text-[10px] text-white/30">~{vnd(s.estimatedFee)}đ</p>
                  </div>
                  <button onClick={() => navigate('/gate-control')}
                    className="p-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all">
                    <Eye size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active sessions list */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <TrendingUp size={15} className="text-emerald-400" />
            <h3 className="text-base font-semibold text-white">Xe đang đỗ</h3>
            <span className="px-2 py-0.5 text-xs font-bold bg-emerald-400/15 text-emerald-400 rounded-full">
              {activeSessions.length}
            </span>
          </div>
          <button onClick={() => navigate('/gate-control')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 transition-all">
            <Zap size={12} />
            Kiểm soát cổng
          </button>
        </div>

        {activeSessions.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-white/30 text-sm gap-2">
            <Car size={18} />
            <span>Bãi đỗ trống</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Biển số', 'Loại xe', 'Vị trí', 'Giờ vào', 'Thời gian', 'Phí ước tính', ''].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-white/40 px-4 py-3 first:pl-6">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeSessions.map(s => {
                  const isOverdue = s.status === 'Overdue';
                  return (
                    <tr key={s.id} className={`border-b border-white/5 last:border-0 transition-colors ${isOverdue ? 'bg-red-400/5 hover:bg-red-400/8' : 'hover:bg-white/[0.02]'}`}>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          {isOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />}
                          <span className="font-mono font-bold text-sm text-white">{s.licensePlate}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isOverdue ? 'bg-red-400/10 text-red-400' : 'bg-emerald-400/10 text-emerald-400'}`}>
                          {s.vehicleTypeName}
                        </span>
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
                        <span className={`text-xs font-medium ${isOverdue ? 'text-red-400' : 'text-white/60'}`}>
                          {fmtDuration(s.entryTime)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-emerald-400">{vnd(s.estimatedFee)}đ</span>
                      </td>
                      <td className="pr-5 py-3">
                        <button onClick={() => navigate('/gate-control')}
                          className="p-2 rounded-xl text-white/30 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all"
                          title="Xử lý checkout">
                          <ArrowLeftCircle size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
