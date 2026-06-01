import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Car, Clock, CheckCircle2, QrCode, CalendarClock, Banknote, History } from 'lucide-react';

const mockHistory = [
  { id: 1, plate: '51G-123.45', building: 'Tòa nhà A', slot: 'A-05', entry: '2026-05-25 08:23', exit: '2026-05-25 11:45', fee: 33000 },
  { id: 2, plate: '51G-123.45', building: 'Tòa nhà A', slot: 'B-12', entry: '2026-05-22 09:10', exit: '2026-05-22 14:30', fee: 54000 },
  { id: 3, plate: '51G-123.45', building: 'Tòa nhà B', slot: 'C-03', entry: '2026-05-20 07:45', exit: '2026-05-20 10:00', fee: 22500 },
  { id: 4, plate: '51G-123.45', building: 'Tòa nhà A', slot: 'A-08', entry: '2026-05-18 13:00', exit: '2026-05-18 17:30', fee: 45000 },
];

const mockReservation = {
  bookingCode: 'BK-20260525-001',
  building: 'Tòa nhà A',
  slot: 'A-05',
  startTime: '2026-05-27 09:00',
  endTime: '2026-05-27 12:00',
  status: 'Confirmed',
};

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const initials = user?.fullName?.charAt(0)?.toUpperCase() ?? 'U';
  const totalSpent = mockHistory.reduce((sum, s) => sum + s.fee, 0);

  return (
    <div className="min-h-screen bg-[#101A31] text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0B1120]/90 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4] flex items-center justify-center">
            <Car size={18} className="text-[#101A31]" />
          </div>
          <span className="text-sm font-bold">ParkingSystem</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4] flex items-center justify-center text-[#101A31] font-bold text-xs">
              {initials}
            </div>
            <span className="text-sm text-white/80 font-medium hidden sm:block">{user?.fullName ?? 'User'}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut size={16} />
            <span className="hidden sm:block">Đăng xuất</span>
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Welcome + QR */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Welcome */}
          <div className="md:col-span-2 glass-card p-6 rounded-2xl">
            <p className="text-sm text-white/50 mb-1">Xin chào,</p>
            <h2 className="text-2xl font-bold text-white mb-1">{user?.fullName ?? 'Người dùng'}</h2>
            <p className="text-sm text-white/40">Chào mừng trở lại SmartPark</p>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xl font-bold text-[#00C2FF]">{mockHistory.length}</p>
                <p className="text-xs text-white/40 mt-0.5">Lần đỗ xe</p>
              </div>
              <div className="text-center border-x border-white/10">
                <p className="text-xl font-bold text-[#3BFFA4]">
                  {new Intl.NumberFormat('vi-VN').format(totalSpent)}đ
                </p>
                <p className="text-xs text-white/40 mt-0.5">Tổng chi tiêu</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-amber-400">1</p>
                <p className="text-xs text-white/40 mt-0.5">Đặt chỗ</p>
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div className="glass-card p-6 rounded-2xl flex flex-col items-center justify-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/5">
              <QrCode size={20} className="text-[#00C2FF]" />
            </div>
            <p className="text-sm font-medium text-white">Mã QR của bạn</p>
            {user?.qrCodeImageBase64 ? (
              <img
                src={`data:image/png;base64,${user.qrCodeImageBase64}`}
                alt="QR Code"
                className="w-24 h-24 rounded-xl"
              />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <QrCode size={40} className="text-white/20" />
              </div>
            )}
            <p className="text-xs text-white/30 font-mono">{user?.qrCode ?? '—'}</p>
          </div>
        </div>

        {/* Active reservation */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock size={18} className="text-[#00C2FF]" />
            <h3 className="text-base font-semibold text-white">Đặt chỗ sắp tới</h3>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-[#00C2FF]/20">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#3BFFA4]/10 text-[#3BFFA4]">
                  <span className="w-1.5 h-1.5 bg-[#3BFFA4] rounded-full" />
                  {mockReservation.status}
                </span>
                <span className="text-xs text-white/40 font-mono">{mockReservation.bookingCode}</span>
              </div>
              <p className="text-sm font-medium text-white">{mockReservation.building} — Chỗ {mockReservation.slot}</p>
              <div className="flex items-center gap-1.5 text-xs text-white/50">
                <Clock size={11} />
                {mockReservation.startTime} → {mockReservation.endTime}
              </div>
            </div>
            <button className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-[#00C2FF] to-[#3BFFA4] text-[#101A31] hover:opacity-90 transition-opacity">
              Xem chi tiết
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Tổng lần đỗ',    value: mockHistory.length, unit: 'lần',  color: '#00C2FF', icon: History   },
            { label: 'Tổng chi tiêu',  value: `${(totalSpent / 1000).toFixed(0)}k`, unit: 'đ', color: '#3BFFA4', icon: Banknote },
            { label: 'Đặt chỗ đang có', value: '1', unit: 'chỗ', color: '#F59E0B', icon: CalendarClock },
            { label: 'Phiên đang đỗ',  value: '0', unit: 'xe',   color: '#A78BFA', icon: Car         },
          ].map(({ label, value, unit, color, icon: Icon }) => (
            <div key={label} className="glass-card p-5 rounded-2xl">
              <div className="p-2 rounded-xl w-fit mb-3" style={{ background: `${color}20` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <p className="text-2xl font-bold text-white">
                {value}
                <span className="text-xs font-normal text-white/40 ml-1">{unit}</span>
              </p>
              <p className="text-xs text-white/50 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Parking history */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
            <History size={16} className="text-[#00C2FF]" />
            <h3 className="text-base font-semibold text-white">Lịch sử đỗ xe</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-medium text-white/40 px-6 py-3">Tòa nhà / Chỗ</th>
                  <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Giờ vào</th>
                  <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Giờ ra</th>
                  <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Phí</th>
                  <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {mockHistory.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                    <td className="px-6 py-3.5">
                      <p className="text-sm font-medium text-white">{s.building}</p>
                      <p className="text-xs text-white/40 font-mono mt-0.5">Chỗ {s.slot}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm text-white/70">
                        <Clock size={11} className="text-white/30" />
                        {s.entry.split(' ')[1]}
                      </div>
                      <p className="text-xs text-white/30 mt-0.5">{s.entry.split(' ')[0]}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-sm text-white/70">{s.exit.split(' ')[1]}</div>
                      <p className="text-xs text-white/30 mt-0.5">{s.exit.split(' ')[0]}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-medium text-white">
                        {new Intl.NumberFormat('vi-VN').format(s.fee)}đ
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-white/50">
                        <CheckCircle2 size={11} />
                        Hoàn thành
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
