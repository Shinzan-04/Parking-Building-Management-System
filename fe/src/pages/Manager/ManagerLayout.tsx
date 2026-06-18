import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Car, MapPin, BarChart3, LogOut, Bell, ChevronDown,
  DollarSign, ClipboardList, CalendarCheck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { to: '/manager',                  label: 'Dashboard',      icon: LayoutDashboard, end: true  },
  { to: '/manager/parking-lots',     label: 'Bãi đỗ xe',      icon: MapPin,          end: false },
  { to: '/manager/vehicles',         label: 'Phương tiện',    icon: Car,             end: false },
  { to: '/manager/pricing',          label: 'Bảng giá',       icon: DollarSign,      end: false },
  { to: '/manager/sessions',         label: 'Phiên đỗ xe',    icon: ClipboardList,   end: false },
  { to: '/manager/reservations',     label: 'Đặt chỗ',        icon: CalendarCheck,   end: false },
  { to: '/manager/reports',          label: 'Báo cáo',        icon: BarChart3,       end: false },
];

export default function ManagerLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const initials = user?.fullName?.charAt(0)?.toUpperCase() ?? 'M';

  return (
    <div className="flex min-h-screen bg-[#0A0A0C]">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-screen w-64 bg-[#0E0E10] border-r border-white/5 flex flex-col z-30">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Car size={18} className="text-black" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">PARKING BUILDING</p>
              <p className="text-xs text-white/40">Manager Panel</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} />
                  {label}
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="px-3 py-4 border-t border-white/5 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-black font-bold text-sm shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.fullName ?? 'Manager'}</p>
              <p className="text-xs text-white/40 truncate">Manager</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut size={17} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="ml-64 flex-1 flex flex-col min-h-screen">
        {/* Top header */}
        <header className="sticky top-0 z-20 bg-[#0A0A0C]/80 backdrop-blur-md border-b border-white/5 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">Bảng điều khiển Manager</h1>
            <p className="text-xs text-white/40">Hệ thống quản lý bãi đỗ xe thông minh</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <Bell size={17} className="text-white/60" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-[#0A0A0C]" />
            </button>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-black font-bold text-xs">
                {initials}
              </div>
              <span className="text-sm text-white/80 font-medium">{user?.fullName ?? 'Manager'}</span>
              <ChevronDown size={14} className="text-white/40" />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
