import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { LayoutDashboard, Car, MapPin, LogOut, MessageSquare, DoorOpen, CalendarCheck, Sun, Moon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import NotificationBell from '../../components/NotificationBell';

const navItems = [
  { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/staff/reservations', label: 'Danh sách Đặt chỗ', icon: CalendarCheck, end: false },
  { to: '/staff/slots', label: 'Danh sách Slot', icon: MapPin, end: false },
  { to: '/staff/chat', label: 'Live Chat', icon: MessageSquare, end: false },
  {
    label: 'Kiểm soát cổng', icon: DoorOpen,
    children: [
      { to: '/staff/gate-control/entry', label: 'Check-in' },
      { to: '/staff/gate-control/exit', label: 'Check-out' }
    ]
  },
];

export default function StaffLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Kiểm soát cổng']);
  const navigate = useNavigate();
  const location = useLocation();
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
        className={`fixed top-0 left-0 h-screen flex flex-col z-30 border-r transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}
        style={{ backgroundColor: 'var(--admin-bg-surface)', borderColor: 'var(--admin-border)' }}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-10 bg-white border border-gray-200 border-l-0 rounded-r-lg flex items-center justify-center text-gray-400 hover:text-stone-900 shadow-sm z-40 transition-colors"
        >
          <div className={`transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
        </button>

        <div
          className={`px-4 py-4 border-b flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} relative`}
          style={{ borderColor: 'var(--admin-border)', minHeight: 64 }}
        >
          <div className="w-9 h-9 rounded-xl bg-[#FF4C4C] flex items-center justify-center shadow-lg shadow-[#FF4C4C]/30 shrink-0">
            <Car size={18} className="text-white" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden whitespace-nowrap transition-opacity duration-300">
              <p className="text-sm font-bold leading-tight" style={{ color: 'var(--admin-text-primary)' }}>
                PARKING<span className="text-[#FF4C4C]">.</span>
              </p>
              <p className="text-xs" style={{ color: 'var(--admin-text-faint)' }}>Staff Panel</p>
            </div>
          )}
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            if (item.children) {
              const isExpanded = expandedMenus.includes(item.label) && !isCollapsed;
              const isActiveParent = item.children.some(child => location.pathname.includes(child.to));

              return (
                <div key={item.label}>
                  <button
                    onClick={() => {
                      if (isCollapsed) setIsCollapsed(false);
                      setExpandedMenus(prev =>
                        prev.includes(item.label) ? prev.filter(l => l !== item.label) : [...prev, item.label]
                      );
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActiveParent && isCollapsed
                      ? 'bg-[#FF4C4C]/10 text-[#FF4C4C] border border-[#FF4C4C]/20'
                      : 'hover:bg-[var(--admin-bg-card)]'
                      }`}
                    style={isActiveParent ? {} : { color: 'var(--admin-text-muted)' }}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <item.icon size={17} className="shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        <ChevronDown size={14} className={`shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </button>

                  {/* Submenu */}
                  {isExpanded && !isCollapsed && (
                    <div className="mt-1 ml-4 pl-4 border-l-2 border-gray-200/40 space-y-1">
                      {item.children.map(child => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className={({ isActive }) =>
                            `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isActive
                              ? 'text-[#FF4C4C] bg-red-50/50 font-bold'
                              : 'text-stone-500 hover:text-stone-800 hover:bg-gray-50'
                            }`
                          }
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to!}
                end={item.end}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                    ? 'bg-[#FF4C4C]/10 text-[#FF4C4C] border border-[#FF4C4C]/20'
                    : 'hover:bg-[var(--admin-bg-card)]'
                  }`
                }
                style={({ isActive }) => isActive ? {} : { color: 'var(--admin-text-muted)' }}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={17} className="shrink-0" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                    {isActive && !isCollapsed && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FF4C4C] shrink-0" />}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-2 py-3 border-t space-y-1" style={{ borderColor: 'var(--admin-border)' }}>
          <div
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 rounded-xl mb-1`}
            style={{ backgroundColor: 'var(--admin-bg-card)' }}
            title={isCollapsed ? user?.fullName ?? 'Staff' : undefined}
          >
            <div className="w-8 h-8 rounded-full bg-[#FF4C4C] flex items-center justify-center text-white font-bold text-sm shrink-0">
              {initials}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--admin-text-primary)' }}>
                  {user?.fullName ?? 'Staff'}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--admin-text-faint)' }}>Staff</p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            title={isCollapsed ? 'Đăng xuất' : undefined}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 rounded-xl text-sm font-medium hover:text-red-500 hover:bg-red-400/10 transition-all`}
            style={{ color: 'var(--admin-text-muted)' }}
          >
            <LogOut size={17} className="shrink-0" />
            {!isCollapsed && 'Đăng xuất'}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
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
