import { useState, useMemo, useEffect, useCallback } from 'react';
import { Car, Bike, Clock, Search, Filter, TrendingUp, CheckCircle2, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { searchSessions, getActiveSessions } from '../../services/sessionsService';
import type { SessionDto } from '../../services/sessionsService';

type FilterTab = 'all' | 'parked' | 'exited';

const tabs: { key: FilterTab; label: string }[] = [
  { key: 'all',    label: 'Tất cả' },
  { key: 'parked', label: 'Đang đỗ' },
  { key: 'exited', label: 'Đã ra' },
];

function isMotorbike(vehicleTypeName: string) {
  const n = vehicleTypeName.toLowerCase();
  return n.includes('máy') || n.includes('motorbike') || n.includes('motor') || n.includes('scooter');
}

export default function Vehicles() {
  const { token } = useAuth();

  const [activeSessions,    setActiveSessions]    = useState<SessionDto[]>([]);
  const [completedSessions, setCompletedSessions] = useState<SessionDto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError,   setApiError]   = useState('');
  const [search,     setSearch]     = useState('');
  const [activeTab,  setActiveTab]  = useState<FilterTab>('all');

  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setApiError('');

    try {
      const today = new Date().toISOString().split('T')[0];

      const [activePage, completedPage] = await Promise.all([
        getActiveSessions({ pageSize: 200 }, token),
        searchSessions({
          status: 'Completed',
          fromDate: `${today}T00:00:00Z`,
          toDate:   `${today}T23:59:59Z`,
          pageSize: 200,
        }, token),
      ]);

      let activeAll = [...activePage.items];
      if (activePage.totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: activePage.totalPages - 1 }, (_, i) =>
            getActiveSessions({ pageSize: 200, page: i + 2 }, token)
          )
        );
        rest.forEach(r => activeAll.push(...r.items));
      }

      let completedAll = [...completedPage.items];
      if (completedPage.totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: completedPage.totalPages - 1 }, (_, i) =>
            searchSessions({
              status: 'Completed',
              fromDate: `${today}T00:00:00Z`,
              toDate:   `${today}T23:59:59Z`,
              pageSize: 200,
              page: i + 2,
            }, token)
          )
        );
        rest.forEach(r => completedAll.push(...r.items));
      }

      setActiveSessions(activeAll);
      setCompletedSessions(completedAll);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Không thể tải dữ liệu phương tiện.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const allSessions = useMemo(() => {
    const active    = activeSessions.map(s => ({ ...s, _tab: 'parked' as FilterTab }));
    const completed = completedSessions.map(s => ({ ...s, _tab: 'exited' as FilterTab }));
    return [...active, ...completed].sort((a, b) =>
      new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime()
    );
  }, [activeSessions, completedSessions]);

  const totalToday  = allSessions.length;
  const parkedCount = activeSessions.length;
  const exitedCount = completedSessions.length;
  const totalRevToday = completedSessions.reduce((s, x) => s + x.totalFee, 0);

  const vnd = (n: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n);

  const stats = [
    { label: 'Tổng xe hôm nay',   value: totalToday,             unit: 'xe',  icon: TrendingUp,  color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5' },
    { label: 'Đang đỗ',            value: parkedCount,            unit: 'xe',  icon: Car,         color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5' },
    { label: 'Đã ra về hôm nay',   value: exitedCount,            unit: 'xe',  icon: CheckCircle2,color: '#A78BFA', bg: 'from-violet-400/20 to-violet-400/5' },
    { label: 'Doanh thu hôm nay',  value: `${vnd(totalRevToday)}đ`, unit: '',  icon: TrendingUp,  color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5' },
  ];

  const filtered = useMemo(() => {
    return allSessions.filter(v => {
      const matchSearch =
        v.licensePlate.toLowerCase().includes(search.toLowerCase()) ||
        (v.driverName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        v.buildingName.toLowerCase().includes(search.toLowerCase()) ||
        v.vehicleTypeName.toLowerCase().includes(search.toLowerCase());
      const matchTab =
        activeTab === 'all'    ? true :
        activeTab === 'parked' ? v._tab === 'parked' :
        v._tab === 'exited';
      return matchSearch && matchTab;
    });
  }, [allSessions, search, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Quản lý phương tiện</h2>
          <p className="text-sm text-white/40 mt-0.5">
            Theo dõi xe vào / ra · Hôm nay {new Date().toLocaleDateString('vi-VN')}
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

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="glass-card p-5 rounded-2xl">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.bg} flex items-center justify-center mb-3`}>
                <Icon size={19} style={{ color: s.color }} />
              </div>
              <p className="text-2xl font-bold text-white">
                {s.value}
                {s.unit && <span className="text-sm font-normal text-white/40 ml-1">{s.unit}</span>}
              </p>
              <p className="text-sm text-white/50 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Tìm biển số, chủ xe, tòa nhà..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.key
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs ${activeTab === t.key ? 'text-[#FF4C4C]' : 'text-white/20'}`}>
                {t.key === 'all' ? totalToday : t.key === 'parked' ? parkedCount : exitedCount}
              </span>
            </button>
          ))}
          <button className="ml-1 p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
            <Filter size={14} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-medium text-white/40 px-6 py-3.5">Biển số</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Chủ xe</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Loại xe</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Tòa nhà / Khu</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Giờ vào</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Giờ ra</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Thời gian</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Phí</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-white/30 text-sm">
                    Không tìm thấy phương tiện nào
                  </td>
                </tr>
              ) : (
                filtered.map((v) => {
                  const moto = isMotorbike(v.vehicleTypeName);
                  return (
                    <tr
                      key={v.id}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-6 py-3.5">
                        <span className="text-sm font-mono font-semibold text-white">{v.licensePlate}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-white/80">{v.driverName ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {moto
                            ? <Bike size={13} className="text-[#FF4C4C]" />
                            : <Car  size={13} className="text-[#FF4C4C]" />}
                          <span className="text-sm text-white/60">{v.vehicleTypeName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm text-white/70">{v.buildingName}</p>
                        <p className="text-xs text-white/30">{v.floorName} · {v.slotNumber}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-sm text-white/70">
                          <Clock size={12} className="text-white/30" />
                          {new Date(v.entryTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-white/60">
                          {v.exitTime
                            ? new Date(v.exitTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-white/60">{v.duration || '—'}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm font-medium text-white">
                          {v.totalFee > 0 ? `${vnd(v.totalFee)}đ` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {v._tab === 'parked' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FF4C4C]/10 text-[#FF4C4C]">
                            <span className="w-1.5 h-1.5 bg-[#FF4C4C] rounded-full animate-pulse" />
                            Đang đỗ
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-white/50">
                            <CheckCircle2 size={11} />
                            Đã ra
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-white/30">
              Hiển thị {filtered.length} / {totalToday} phương tiện
            </p>
            <p className="text-xs text-white/30">
              {parkedCount} đang đỗ · {exitedCount} đã ra
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
