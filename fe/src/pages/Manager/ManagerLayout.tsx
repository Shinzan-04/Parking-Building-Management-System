import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Car, MapPin, BarChart3, LogOut, Bell,
  DollarSign, ClipboardList, CalendarCheck, Sun, Moon, Home,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

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
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const initials = user?.fullName?.charAt(0)?.toUpperCase() ?? 'M';

  return (
    <div
      className="admin-portal flex min-h-screen"
      style={{ backgroundColor: 'var(--admin-bg-base)', color: 'var(--admin-text-primary)' }}
    >
      {/* Sidebar */}
      <aside
        className="fixed top-0 left-0 h-screen w-64 flex flex-col z-30 border-r"
        style={{
          backgroundColor: 'var(--admin-bg-surface)',
          borderColor: 'var(--admin-border)',
        }}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--admin-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF4C4C] flex items-center justify-center shadow-lg shadow-[#FF4C4C]/30">
              <Car size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight" style={{ color: 'var(--admin-text-primary)' }}>
                PARKING<span className="text-[#FF4C4C]">.</span>
              </p>
              <p className="text-xs" style={{ color: 'var(--admin-text-faint)' }}>Manager Panel</p>
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
                    ? 'bg-[#FF4C4C]/10 text-[#FF4C4C] border border-[#FF4C4C]/20'
                    : 'hover:bg-[var(--admin-bg-card)]'
                }`
              }
              style={({ isActive }) => isActive ? {} : { color: 'var(--admin-text-muted)' }}
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} />
                  {label}
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FF4C4C]" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="px-3 py-4 border-t space-y-1" style={{ borderColor: 'var(--admin-border)' }}>
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ backgroundColor: 'var(--admin-bg-card)' }}
          >
            <div className="w-8 h-8 rounded-full bg-[#FF4C4C] flex items-center justify-center text-white font-bold text-sm shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--admin-text-primary)' }}>
                {user?.fullName ?? 'Manager'}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--admin-text-faint)' }}>Manager</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/', { state: { fromDashboard: true } })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-[var(--admin-bg-card)] transition-all"
            style={{ color: 'var(--admin-text-muted)' }}
          >
            <Home size={17} />
            Trang chủ
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:text-red-500 hover:bg-red-400/10 transition-all"
            style={{ color: 'var(--admin-text-muted)' }}
          >
            <LogOut size={17} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="ml-64 flex-1 flex flex-col min-h-screen">
        {/* Top header */}
        <header
          className="sticky top-0 z-20 backdrop-blur-md border-b px-8 py-4 flex items-center justify-between"
          style={{
            backgroundColor: `color-mix(in srgb, var(--admin-bg-base) 85%, transparent)`,
            borderColor: 'var(--admin-border)',
          }}
        >
          <div>
            <h1 className="text-base font-semibold" style={{ color: 'var(--admin-text-primary)' }}>
              Bảng điều khiển Manager
            </h1>
            <p className="text-xs" style={{ color: 'var(--admin-text-faint)' }}>
              Hệ thống quản lý bãi đỗ xe thông minh
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-colors"
              style={{ backgroundColor: 'var(--admin-bg-card)', color: 'var(--admin-text-muted)' }}
              title={theme === 'dark' ? 'Chuyển Light mode' : 'Chuyển Dark mode'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              className="relative p-2 rounded-xl transition-colors"
              style={{ backgroundColor: 'var(--admin-bg-card)', color: 'var(--admin-text-muted)' }}
            >
              <Bell size={17} />
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF4C4C] rounded-full"
                style={{ boxShadow: '0 0 0 2px var(--admin-bg-base)' }}
              />
            </button>

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
