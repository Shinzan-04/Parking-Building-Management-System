import { Car, Banknote, TrendingUp, TrendingDown, ArrowUpRight, Clock, CheckCircle2, MapPin } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const revenueData = [
  { day: 'T2', revenue: 8500 },
  { day: 'T3', revenue: 9200 },
  { day: 'T4', revenue: 7800 },
  { day: 'T5', revenue: 10500 },
  { day: 'T6', revenue: 12000 },
  { day: 'T7', revenue: 14500 },
  { day: 'CN', revenue: 11000 },
];

const occupancyData = [
  { hour: '6h', vehicles: 45 },
  { hour: '8h', vehicles: 156 },
  { hour: '10h', vehicles: 312 },
  { hour: '12h', vehicles: 298 },
  { hour: '14h', vehicles: 310 },
  { hour: '16h', vehicles: 342 },
  { hour: '18h', vehicles: 220 },
];

const recentSessions = [
  { id: 1, plate: '51G-123.45', slot: 'A-01', entry: '08:23', exit: '11:45', fee: 33000, status: 'completed' },
  { id: 2, plate: '30A-456.78', slot: 'B-05', entry: '09:10', exit: null,    fee: null,  status: 'parked'    },
  { id: 3, plate: '43C-789.01', slot: 'A-12', entry: '07:45', exit: '10:30', fee: 27500, status: 'completed' },
  { id: 4, plate: '92B-234.56', slot: 'C-03', entry: '10:15', exit: null,    fee: null,  status: 'parked'    },
  { id: 5, plate: '60H-567.89', slot: 'B-09', entry: '06:30', exit: '09:00', fee: 25000, status: 'completed' },
];

const stats = [
  {
    label: 'Chỗ đang sử dụng',
    value: '342',
    unit: 'chỗ',
    change: '+12 so với hôm qua',
    positive: true,
    icon: Car,
    color: '#3BFFA4',
    bg: 'from-[#3BFFA4]/20 to-[#3BFFA4]/5',
  },
  {
    label: 'Chỗ còn trống',
    value: '158',
    unit: 'chỗ',
    change: '-12 so với hôm qua',
    positive: false,
    icon: MapPin,
    color: '#00C2FF',
    bg: 'from-[#00C2FF]/20 to-[#00C2FF]/5',
  },
  {
    label: 'Doanh thu hôm nay',
    value: '12,450,000',
    unit: 'đ',
    change: '+8.2% so với hôm qua',
    positive: true,
    icon: Banknote,
    color: '#F59E0B',
    bg: 'from-amber-400/20 to-amber-400/5',
  },
  {
    label: 'Tỷ lệ lấp đầy',
    value: '68.4',
    unit: '%',
    change: '-2.1% so với hôm qua',
    positive: false,
    icon: TrendingUp,
    color: '#A78BFA',
    bg: 'from-violet-400/20 to-violet-400/5',
  },
];

function ChartTooltip({ active, payload, label, color, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0B1120] border border-white/10 rounded-xl px-4 py-2.5 text-sm">
      <p className="text-white/60 mb-1">{label}</p>
      <p className="font-semibold" style={{ color }}>{formatter(payload[0].value)}</p>
    </div>
  );
}

export default function ManagerDashboard() {
  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Tổng quan hoạt động</h2>
        <p className="text-sm text-white/40 capitalize mt-0.5">{today}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass-card p-5 rounded-2xl">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.bg}`}>
                  <Icon size={20} style={{ color: stat.color }} />
                </div>
                <span className={`flex items-center gap-1 text-xs font-medium ${stat.positive ? 'text-[#3BFFA4]' : 'text-red-400'}`}>
                  {stat.positive ? <ArrowUpRight size={12} /> : <TrendingDown size={12} />}
                  {stat.change.split(' ')[0]}
                </span>
              </div>
              <p className="text-2xl font-bold text-white">
                {stat.value}
                <span className="text-sm font-normal text-white/40 ml-1">{stat.unit}</span>
              </p>
              <p className="text-sm text-white/50 mt-1">{stat.label}</p>
              <p className="text-xs text-white/30 mt-0.5">{stat.change.split(' ').slice(1).join(' ')}</p>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">Doanh thu 7 ngày qua</h3>
              <p className="text-xs text-white/40 mt-0.5">Đơn vị: nghìn đồng</p>
            </div>
            <span className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full">Tuần này</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#ffffff66', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#ffffff66', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip content={<ChartTooltip color="#3BFFA4" formatter={(v: number) => `${new Intl.NumberFormat('vi-VN').format(v * 1000)}đ`} />} cursor={{ fill: '#ffffff05' }} />
              <Bar dataKey="revenue" fill="#3BFFA4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">Lưu lượng xe hôm nay</h3>
              <p className="text-xs text-white/40 mt-0.5">Số xe theo giờ</p>
            </div>
            <span className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full">Hôm nay</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={occupancyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: '#ffffff66', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#ffffff66', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip color="#00C2FF" formatter={(v: number) => `${v} xe`} />} />
              <Line type="monotone" dataKey="vehicles" stroke="#00C2FF" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#00C2FF', strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent sessions */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Phiên đỗ xe gần đây</h3>
          <button className="text-xs text-[#3BFFA4] hover:text-[#3BFFA4]/80 font-medium transition-colors">
            Xem tất cả →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-medium text-white/40 px-6 py-3">Biển số</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Chỗ</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Giờ vào</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Giờ ra</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Phí</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((s) => (
                <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                  <td className="px-6 py-3.5">
                    <span className="text-sm font-mono font-semibold text-white">{s.plate}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-white/70">{s.slot}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-sm text-white/70">
                      <Clock size={12} className="text-white/30" />{s.entry}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-white/70">{s.exit ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-medium text-white">
                      {s.fee != null ? new Intl.NumberFormat('vi-VN').format(s.fee) + 'đ' : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {s.status === 'parked' ? (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
