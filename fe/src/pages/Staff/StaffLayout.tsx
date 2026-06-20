import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Car, MapPin, LogOut, Sun, Moon, DoorOpen, CalendarCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import NotificationBell from '../../components/NotificationBell';

const navItems = [
  { to: '/staff',               label: 'Dashboard',         icon: LayoutDashboard, end: true  },
  { to: '/staff/reservations',  label: 'Danh sách Đặt chỗ', icon: CalendarCheck,   end: false },
  { to: '/staff/slots',         label: 'Danh sách Slot',    icon: MapPin,          end: false },
  { to: '/gate-control',        label: 'Kiểm soát cổng',    icon: DoorOpen,        end: false },
];

export default function StaffLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => { logout(); navigate('/auth'); };
  const initials = user?.fullName?.charAt(0)?.toUpperCase() ?? 'S';

  return (
    <div
      className="admin-portal flex min-h-screen"
      style={{ backgroundColor: 'var(--admin-bg-base)', color: 'var(--admin-text-primary)' }}
    >
      {/* Sidebar */}
      <aside
        className="fixed top-0 left-0 h-screen w-64 flex flex-col z-30 border-r"
        style={{ backgroundColor: 'var(--admin-bg-surface)', borderColor: 'var(--admin-border)' }}
      >
        <div
          className="px-4 py-4 border-b flex items-center gap-3"
          style={{ borderColor: 'var(--admin-border)', minHeight: 64 }}
        >
          <div className="w-9 h-9 rounded-xl bg-[#FF4C4C] flex items-center justify-center shadow-lg shadow-[#FF4C4C]/30 shrink-0">
            <Car size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: 'var(--admin-text-primary)' }}>
              PARKING<span className="text-[#FF4C4C]">.</span>
            </p>
            <p className="text-xs" style={{ color: 'var(--admin-text-faint)' }}>Staff Panel</p>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
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
                  <Icon size={17} className="shrink-0" />
                  <span className="truncate">{label}</span>
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FF4C4C] shrink-0" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-3 border-t space-y-1" style={{ borderColor: 'var(--admin-border)' }}>
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
            style={{ backgroundColor: 'var(--admin-bg-card)' }}
          >
            <div className="w-8 h-8 rounded-full bg-[#FF4C4C] flex items-center justify-center text-white font-bold text-sm shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--admin-text-primary)' }}>
                {user?.fullName ?? 'Staff'}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--admin-text-faint)' }}>Staff</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:text-red-500 hover:bg-red-400/10 transition-all"
            style={{ color: 'var(--admin-text-muted)' }}
          >
            <LogOut size={17} className="shrink-0" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-h-screen ml-64">
        <header
          className="sticky top-0 z-20 backdrop-blur-md border-b px-8 py-4 flex items-center justify-between overflow-visible"
          style={{
            backgroundColor: `color-mix(in srgb, var(--admin-bg-base) 85%, transparent)`,
            borderColor: 'var(--admin-border)',
          }}
        >
          <div>
            <h1 className="text-base font-semibold" style={{ color: 'var(--admin-text-primary)' }}>
              Bảng điều khiển Staff
            </h1>
            <p className="text-xs" style={{ color: 'var(--admin-text-faint)' }}>
              Hệ thống quản lý bãi đỗ xe
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-colors"
              style={{ backgroundColor: 'var(--admin-bg-card)', color: 'var(--admin-text-muted)' }}
              title={theme === 'dark' ? 'Chuyển Light mode' : 'Chuyển Dark mode'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <NotificationBell token={user?.accessToken ?? null} />
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
