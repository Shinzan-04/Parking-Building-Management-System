/**
 * Staff/StaffLayout.tsx
 * Nhánh: Feature/StaffDashboard
 * Layout cho Staff portal — sidebar minimal + main content
 */

import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Zap, LayoutDashboard, DoorOpen, ClipboardList,
  LogOut, Bell, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { to: '/staff',           label: 'Dashboard ca trực', icon: LayoutDashboard, end: true  },
  { to: '/gate-control',    label: 'Kiểm soát cổng',   icon: DoorOpen,        end: false, external: true },
  { to: '/staff/sessions',  label: 'Phiên đang mở',    icon: ClipboardList,   end: false },
];

export default function StaffLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => { logout(); navigate('/auth'); };
  const initials = user?.fullName?.split(' ').slice(-1)[0]?.charAt(0)?.toUpperCase() ?? 'S';

  return (
    <div className="flex min-h-screen bg-[#080F1E]">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-screen w-60 bg-[#050D1A] border-r border-white/10 flex flex-col z-30">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-[#3BFFA4] flex items-center justify-center">
              <Zap size={18} className="text-[#080F1E]" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">Gate Station</p>
              <p className="text-xs text-white/40">Staff Portal</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end, external }) =>
            external ? (
              <a key={to} href={to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all">
                <Icon size={17} />
                {label}
              </a>
            ) : (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive ? 'bg-emerald-400/15 text-emerald-300' : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`
                }>
                {({ isActive }) => (
                  <>
                    <Icon size={17} />
                    {label}
                    {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  </>
                )}
              </NavLink>
            )
          )}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-[#3BFFA4] flex items-center justify-center text-[#080F1E] font-bold text-sm shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.fullName ?? 'Staff'}</p>
              <p className="text-xs text-white/40 truncate">Nhân viên trực cổng</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-all">
            <LogOut size={17} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-60 flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-[#080F1E]/80 backdrop-blur-md border-b border-white/10 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">Staff Portal</h1>
            <p className="text-xs text-white/40">Hệ thống kiểm soát cổng gửi xe</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <Bell size={17} className="text-white/60" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-[#080F1E]" />
            </button>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-[#3BFFA4] flex items-center justify-center text-[#080F1E] font-bold text-xs">
                {initials}
              </div>
              <span className="text-sm text-white/80 font-medium">{user?.fullName ?? 'Staff'}</span>
              <ChevronDown size={14} className="text-white/40" />
            </div>
          </div>
        </header>
        <main className="flex-1 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
