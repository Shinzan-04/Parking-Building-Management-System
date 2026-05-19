import { useState, useMemo } from 'react';
import { Car, Bike, Clock, Search, Filter, CalendarDays, TrendingUp, CheckCircle2 } from 'lucide-react';

type VehicleStatus = 'parked' | 'exited';
type VehicleType   = 'car' | 'motorbike';

interface Vehicle {
  id: number;
  plate: string;
  owner: string;
  type: VehicleType;
  lot: string;
  entry: string;
  exit: string | null;
  duration: string;
  fee: number | null;
  status: VehicleStatus;
}

const mockVehicles: Vehicle[] = [
  { id: 1,  plate: '51G-123.45', owner: 'Nguyễn Văn An',    type: 'car',       lot: 'Khu A', entry: '06:15', exit: '09:30', duration: '3h 15m', fee: 32500,  status: 'exited' },
  { id: 2,  plate: '30A-456.78', owner: 'Trần Thị Bình',   type: 'motorbike', lot: 'Khu B', entry: '07:00', exit: null,    duration: '5h 05m', fee: null,   status: 'parked' },
  { id: 3,  plate: '43C-789.01', owner: 'Lê Minh Cường',   type: 'car',       lot: 'Khu A', entry: '07:45', exit: '11:20', duration: '3h 35m', fee: 35500,  status: 'exited' },
  { id: 4,  plate: '92B-234.56', owner: 'Phạm Thu Dung',   type: 'car',       lot: 'Khu D', entry: '08:10', exit: null,    duration: '3h 55m', fee: null,   status: 'parked' },
  { id: 5,  plate: '60H-567.89', owner: 'Hoàng Văn Em',    type: 'motorbike', lot: 'Khu B', entry: '08:30', exit: '10:00', duration: '1h 30m', fee: 15000,  status: 'exited' },
  { id: 6,  plate: '15A-890.12', owner: 'Vũ Thị Phương',   type: 'car',       lot: 'Khu A', entry: '09:00', exit: null,    duration: '3h 05m', fee: null,   status: 'parked' },
  { id: 7,  plate: '74D-321.65', owner: 'Đặng Quốc Hùng',  type: 'motorbike', lot: 'Khu F', entry: '09:15', exit: '11:45', duration: '2h 30m', fee: 25000,  status: 'exited' },
  { id: 8,  plate: '29B-678.90', owner: 'Bùi Thị Lan',     type: 'car',       lot: 'Khu D', entry: '09:30', exit: null,    duration: '2h 35m', fee: null,   status: 'parked' },
  { id: 9,  plate: '51F-111.22', owner: 'Ngô Thanh Mai',   type: 'car',       lot: 'Khu A', entry: '10:00', exit: '13:30', duration: '3h 30m', fee: 35000,  status: 'exited' },
  { id: 10, plate: '30K-333.44', owner: 'Trịnh Văn Nam',   type: 'motorbike', lot: 'Khu B', entry: '10:20', exit: null,    duration: '1h 45m', fee: null,   status: 'parked' },
  { id: 11, plate: '43P-555.66', owner: 'Đinh Thị Oanh',   type: 'car',       lot: 'Khu D', entry: '10:45', exit: '14:00', duration: '3h 15m', fee: 32500,  status: 'exited' },
  { id: 12, plate: '92L-777.88', owner: 'Lý Hoàng Phúc',   type: 'motorbike', lot: 'Khu F', entry: '11:00', exit: null,    duration: '1h 05m', fee: null,   status: 'parked' },
  { id: 13, plate: '60G-999.00', owner: 'Mai Thị Quyên',   type: 'car',       lot: 'Khu A', entry: '11:15', exit: '15:00', duration: '3h 45m', fee: 37500,  status: 'exited' },
  { id: 14, plate: '15B-246.80', owner: 'Cao Minh Sơn',    type: 'car',       lot: 'Khu B', entry: '11:30', exit: null,    duration: '0h 35m', fee: null,   status: 'parked' },
  { id: 15, plate: '74A-135.79', owner: 'Dương Thị Thu',   type: 'motorbike', lot: 'Khu F', entry: '12:00', exit: '13:30', duration: '1h 30m', fee: 15000,  status: 'exited' },
];

type FilterTab = 'all' | 'parked' | 'exited';

const tabs: { key: FilterTab; label: string }[] = [
  { key: 'all',    label: 'Tất cả' },
  { key: 'parked', label: 'Đang đỗ' },
  { key: 'exited', label: 'Đã ra' },
];

export default function Vehicles() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const parkedCount = mockVehicles.filter(v => v.status === 'parked').length;
  const exitedCount = mockVehicles.filter(v => v.status === 'exited').length;
  const carCount    = mockVehicles.filter(v => v.type === 'car').length;

  const stats = [
    { label: 'Tổng xe hôm nay', value: mockVehicles.length, unit: 'xe',   icon: TrendingUp,    color: '#00C2FF', bg: 'from-[#00C2FF]/20 to-[#00C2FF]/5' },
    { label: 'Đang đỗ',         value: parkedCount,          unit: 'xe',   icon: Car,           color: '#3BFFA4', bg: 'from-[#3BFFA4]/20 to-[#3BFFA4]/5' },
    { label: 'Đã ra về',        value: exitedCount,          unit: 'xe',   icon: CheckCircle2,  color: '#A78BFA', bg: 'from-violet-400/20 to-violet-400/5' },
    { label: 'Ô tô / Xe máy',   value: `${carCount}/${mockVehicles.length - carCount}`, unit: '', icon: CalendarDays, color: '#F59E0B', bg: 'from-amber-400/20 to-amber-400/5' },
  ];

  const filtered = useMemo(() => {
    return mockVehicles.filter(v => {
      const matchSearch =
        v.plate.toLowerCase().includes(search.toLowerCase()) ||
        v.owner.toLowerCase().includes(search.toLowerCase()) ||
        v.lot.toLowerCase().includes(search.toLowerCase());
      const matchTab =
        activeTab === 'all' ? true :
        activeTab === 'parked' ? v.status === 'parked' :
        v.status === 'exited';
      return matchSearch && matchTab;
    });
  }, [search, activeTab]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Quản lý phương tiện</h2>
        <p className="text-sm text-white/40 mt-0.5">
          Theo dõi xe vào / ra · Hôm nay {new Date().toLocaleDateString('vi-VN')}
        </p>
      </div>

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
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Tìm biển số, chủ xe, khu đỗ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00C2FF]/50 transition-colors"
          />
        </div>

        {/* Filter tabs */}
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
              <span className={`ml-1.5 text-xs ${activeTab === t.key ? 'text-[#00C2FF]' : 'text-white/20'}`}>
                {t.key === 'all' ? mockVehicles.length : t.key === 'parked' ? parkedCount : exitedCount}
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
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Khu đỗ</th>
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
                filtered.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-6 py-3.5">
                      <span className="text-sm font-mono font-semibold text-white">{v.plate}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-white/80">{v.owner}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {v.type === 'car' ? (
                          <Car size={13} className="text-[#00C2FF]" />
                        ) : (
                          <Bike size={13} className="text-[#3BFFA4]" />
                        )}
                        <span className="text-sm text-white/60">
                          {v.type === 'car' ? 'Ô tô' : 'Xe máy'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-white/60">{v.lot}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm text-white/70">
                        <Clock size={12} className="text-white/30" />
                        {v.entry}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-white/60">{v.exit ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-white/60">{v.duration}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-medium text-white">
                        {v.fee != null ? new Intl.NumberFormat('vi-VN').format(v.fee) + 'đ' : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {v.status === 'parked' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#3BFFA4]/10 text-[#3BFFA4]">
                          <span className="w-1.5 h-1.5 bg-[#3BFFA4] rounded-full animate-pulse" />
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-white/30">
              Hiển thị {filtered.length} / {mockVehicles.length} phương tiện
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
