import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import toast from 'react-hot-toast';
import { LayoutDashboard, Car, MapPin, LogOut, MessageSquare, DoorOpen, CalendarCheck, Sun, Moon, ChevronDown, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import NotificationBell from '../../components/NotificationBell';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

const navItems = [
  { to: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/staff/reservations', label: 'Reservations', icon: CalendarCheck, end: false },
  { to: '/staff/slots', label: 'Parking Slots', icon: MapPin, end: false },
  { to: '/staff/chat', label: 'Live Chat', icon: MessageSquare, end: false },
  { to: '/staff/exceptions', label: 'Exceptions', icon: AlertTriangle, end: false },
  {
    label: 'Gate Control', icon: DoorOpen,
    children: [
      { to: '/staff/gate-control/entry', label: 'Check-in' },
      { to: '/staff/gate-control/exit', label: 'Check-out' }
    ]
  },
];

export default function StaffLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [driving, setDriving] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Gate Control']);
  const [pendingChatCount, setPendingChatCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const buildingId = user?.assignedBuildingId;

  const handleLogout = () => { logout(); navigate('/auth'); };
  const initials = user?.fullName?.charAt(0)?.toUpperCase() ?? 'S';

  const handleLogoClick = () => {
    setDriving(true);
    setTimeout(() => { setDriving(false); setIsCollapsed(c => !c); }, 550);
  };

  const refreshPendingChatCount = useCallback(async () => {
    if (!buildingId) return;
    try {
      const res = await fetch(`${API_URL}/api/Chat/sessions?buildingId=${buildingId}`);
      if (!res.ok) return;
      const sessions = await res.json();
      const escalated = Array.isArray(sessions)
        ? sessions.filter((s: { status: string }) => s.status === 'Escalated').length
        : 0;
      setPendingChatCount(escalated);
    } catch { /* ignore */ }
  }, [buildingId]);

  useEffect(() => { refreshPendingChatCount(); }, [refreshPendingChatCount]);

  // Sync sidebar width CSS variable for global toaster offset
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '68px' : '256px');
    return () => { document.documentElement.style.removeProperty('--sidebar-width'); };
  }, [isCollapsed]);

  // Refresh badge instantly when ChatDashboard takes over/closes a session locally
  useEffect(() => {
    const handler = () => refreshPendingChatCount();
    window.addEventListener('chatSessionUpdated', handler);
    return () => window.removeEventListener('chatSessionUpdated', handler);
  }, [refreshPendingChatCount]);

  // Global connection to /chatHub so escalation alerts (toast + badge) work
  // from any Staff page, not just when ChatDashboard is open.
  const activeChatSessionRef = useRef<string | null>(null);
  activeChatSessionRef.current = location.pathname.startsWith('/staff/chat') ? 'open' : null;

  useEffect(() => {
    if (!buildingId) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/chatHub`, { accessTokenFactory: () => user?.accessToken || '' })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('NewEscalatedSession', () => {
      refreshPendingChatCount();
      // Avoid a redundant toast if the staff member is already on the Live Chat page
      if (!activeChatSessionRef.current) {
        toast('New chat support request', { icon: '💬' });
      }
    });

    connection.on('SessionStatusChanged', () => {
      refreshPendingChatCount();
    });

    connection.start()
      .then(() => connection.invoke('JoinBuildingGroup', buildingId))
      .catch(() => { /* ignore */ });

    return () => { connection.stop(); };
  }, [buildingId, user?.accessToken, refreshPendingChatCount]);

  return (
    <div
      className="admin-portal flex min-h-screen"
      style={{ backgroundColor: 'var(--admin-bg-base)', color: 'var(--admin-text-primary)' }}
    >
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen flex flex-col z-30 border-r transition-all duration-300 ${isCollapsed ? 'w-[68px]' : 'w-64'}`}
        style={{ backgroundColor: 'var(--admin-bg-surface)', borderColor: 'var(--admin-border)' }}
      >
        {/* Logo — click to toggle */}
        <div
          className="px-3 py-4 border-b flex items-center cursor-pointer select-none"
          style={{ borderColor: 'var(--admin-border)', minHeight: 64 }}
          onClick={handleLogoClick}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <div className="w-9 h-9 rounded-xl bg-[#FF4C4C] flex items-center justify-center shadow-lg shadow-[#FF4C4C]/30 shrink-0 overflow-hidden hover:scale-105 transition-transform duration-200">
            <Car size={18} className={`text-white ${driving ? 'animate-car-drive' : ''}`} />
          </div>
          {!isCollapsed && (
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-bold leading-tight whitespace-nowrap" style={{ color: 'var(--admin-text-primary)' }}>
                PARKING<span className="text-[#FF4C4C]">.</span>
              </p>
              <p className="text-xs whitespace-nowrap" style={{ color: 'var(--admin-text-faint)' }}>Staff Panel</p>
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
                  `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
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
                    {item.to === '/staff/chat' && pendingChatCount > 0 && (
                      <span
                        className={`shrink-0 flex items-center justify-center rounded-full bg-[#FF4C4C] text-white text-[10px] font-bold ${isCollapsed ? 'absolute -top-1 -right-1 w-4 h-4' : 'ml-auto min-w-[18px] h-[18px] px-1'}`}
                      >
                        {pendingChatCount > 9 ? '9+' : pendingChatCount}
                      </span>
                    )}
                    {isActive && !isCollapsed && item.to !== '/staff/chat' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FF4C4C] shrink-0" />}
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
            title={isCollapsed ? 'Logout' : undefined}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 rounded-xl text-sm font-medium hover:text-red-500 hover:bg-red-400/10 transition-all`}
            style={{ color: 'var(--admin-text-muted)' }}
          >
            <LogOut size={17} className="shrink-0" />
            {!isCollapsed && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'ml-[68px]' : 'ml-64'}`}>
        <header
          className="sticky top-0 z-20 backdrop-blur-md border-b px-8 py-4 flex items-center justify-between overflow-visible"
          style={{
            backgroundColor: `color-mix(in srgb, var(--admin-bg-base) 85%, transparent)`,
            borderColor: 'var(--admin-border)',
          }}
        >
          <div>
            <h1 className="text-base font-semibold" style={{ color: 'var(--admin-text-primary)' }}>
              Staff Dashboard
            </h1>
            <p className="text-xs" style={{ color: 'var(--admin-text-faint)' }}>
              Parking Management System
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-colors"
              style={{ backgroundColor: 'var(--admin-bg-card)', color: 'var(--admin-text-muted)' }}
              title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
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
