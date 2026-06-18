import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Car, Users, BarChart3, Settings,
  LogOut, MapPin, Bell, Sun, Moon, Home,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

const navItems = [
  { to: '/admin',              label: 'Dashboard',    icon: LayoutDashboard, end: true  },
  { to: '/admin/parking-lots', label: 'Bãi đỗ xe',    icon: MapPin,          end: false },
  { to: '/admin/vehicles',     label: 'Phương tiện',  icon: Car,             end: false },
  { to: '/admin/users',        label: 'Người dùng',   icon: Users,           end: false },
  { to: '/admin/reports',      label: 'Báo cáo',      icon: BarChart3,       end: false },
  { to: '/admin/settings',     label: 'Cài đặt',      icon: Settings,        end: false },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [driving,   setDriving]   = useState(false);

  const handleLogout = () => { logout(); navigate('/auth'); };
  const initials = user?.fullName?.charAt(0)?.toUpperCase() ?? 'A';

  const handleLogoClick = () => {
    setDriving(true);
    setTimeout(() => { setDriving(false); setCollapsed(c => !c); }, 550);
  };

  const W = collapsed ? 'w-[68px]' : 'w-64';
  const ML = collapsed ? 'ml-[68px]' : 'ml-64';

  return (
    <div
      className="admin-portal flex min-h-screen"
      style={{ backgroundColor: 'var(--admin-bg-base)', color: 'var(--admin-text-primary)' }}
    >
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen flex flex-col z-30 border-r transition-all duration-300 ${W}`}
        style={{ backgroundColor: 'var(--admin-bg-surface)', borderColor: 'var(--admin-border)' }}
      >
        {/* Logo — click to toggle */}
        <div
          className="px-3 py-4 border-b flex items-center cursor-pointer select-none"
          style={{ borderColor: 'var(--admin-border)', minHeight: 64 }}
          onClick={handleLogoClick}
          title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          <div className="w-9 h-9 rounded-xl bg-[#FF4C4C] flex items-center justify-center shadow-lg shadow-[#FF4C4C]/30 shrink-0 overflow-hidden hover:scale-105 transition-transform duration-200">
            <Car size={18} className={`text-white ${driving ? 'animate-car-drive' : ''}`} />
          </div>
          {!collapsed && (
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-bold leading-tight whitespace-nowrap" style={{ color: 'var(--admin-text-primary)' }}>
                PARKING<span className="text-[#FF4C4C]">.</span>
              </p>
              <p className="text-xs whitespace-nowrap" style={{ color: 'var(--admin-text-faint)' }}>Admin Panel</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  collapsed ? 'justify-center' : ''
                } ${
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
                  {!collapsed && (
                    <>
                      <span className="truncate">{label}</span>
                      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FF4C4C] shrink-0" />}
                    </>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: user + actions */}
        <div className="px-2 py-3 border-t space-y-1" style={{ borderColor: 'var(--admin-border)' }}>
          {/* User info — hide when collapsed */}
          {!collapsed && (
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
              style={{ backgroundColor: 'var(--admin-bg-card)' }}
            >
              <div className="w-8 h-8 rounded-full bg-[#FF4C4C] flex items-center justify-center text-white font-bold text-sm shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--admin-text-primary)' }}>
                  {user?.fullName ?? 'Admin'}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--admin-text-faint)' }}>Administrator</p>
              </div>
            </div>
          )}

          {/* Trang chủ */}
          <button
            onClick={() => navigate('/', { state: { fromDashboard: true } })}
            title={collapsed ? 'Trang chủ' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-[var(--admin-bg-card)] transition-all ${collapsed ? 'justify-center' : ''}`}
            style={{ color: 'var(--admin-text-muted)' }}
          >
            <Home size={17} className="shrink-0" />
            {!collapsed && 'Trang chủ'}
          </button>

          {/* Đăng xuất */}
          <button
            onClick={handleLogout}
            title={collapsed ? 'Đăng xuất' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:text-red-500 hover:bg-red-400/10 transition-all ${collapsed ? 'justify-center' : ''}`}
            style={{ color: 'var(--admin-text-muted)' }}
          >
            <LogOut size={17} className="shrink-0" />
            {!collapsed && 'Đăng xuất'}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${ML}`}>
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
              Bảng điều khiển Admin
            </h1>
            <p className="text-xs" style={{ color: 'var(--admin-text-faint)' }}>
              Hệ thống quản lý bãi đỗ xe thông minh
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
