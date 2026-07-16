import { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import NotificationBell from '../../components/NotificationBell';
import { getMySubscriptions } from '../../services/subscriptionService';
import {
  ChevronDown, LayoutDashboard, Sun, Moon, User,
  Car, Wallet, LogOut, Ticket
} from 'lucide-react';

function daysLeft(endDate: string): number {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000));
}

function getDashboardPath(role: string | number): string | null {
  if (role === 'Admin'   || role === 0) return '/admin';
  if (role === 'Manager' || role === 1) return '/manager';
  if (role === 'Staff'   || role === 2) return '/staff';
  return null;
}

export default function UserLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activePassDaysLeft, setActivePassDaysLeft] = useState<number | null>(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Kiểm tra ngầm có vé tháng đang hiệu lực không, để hiện badge trên navbar
  // mà không cần user phải vào trang Vé Tháng.
  useEffect(() => {
    if (!token) { setActivePassDaysLeft(null); return; }
    let cancelled = false;
    getMySubscriptions(token)
      .then(subs => {
        if (cancelled) return;
        const active = subs.find(s => s.status === 'Active');
        setActivePassDaysLeft(active ? daysLeft(active.endDate) : null);
      })
      .catch(() => { if (!cancelled) setActivePassDaysLeft(null); });
    return () => { cancelled = true; };
  }, [token, location.pathname]);

  const handleLogout = () => { logout(); navigate('/auth'); };
  const initials = user?.fullName?.slice(0, 2)?.toUpperCase() ?? 'PD';

  return (
    <div
      className="min-h-screen font-sans antialiased selection:bg-[#FF4C4C]/20 selection:text-[#FF4C4C] transition-colors duration-300"
      style={{ backgroundColor: 'var(--lp-bg)', color: 'var(--lp-text)' }}
    >
      {/* Navbar */}
      <nav
        className="fixed top-0 left-0 right-0 z-[9999] backdrop-blur-md border-b shadow-sm transition-colors duration-300"
        style={{ backgroundColor: 'var(--lp-nav-bg)', borderColor: 'var(--lp-nav-border)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FF4C4C] flex items-center justify-center text-white font-extrabold text-sm shadow-sm shadow-[#FF4C4C]/25">
                P
              </div>
              <span className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--lp-text)' }}>
                Parking<span className="text-[#FF4C4C]">.</span>
              </span>
            </Link>

            {/* Nav links */}
            <div className="hidden md:flex items-center gap-10">
              <span
                onClick={() => navigate('/my-tickets')}
                className="text-sm font-semibold hover:text-[#FF4C4C] transition-colors cursor-pointer"
                style={{ color: 'var(--lp-text-muted)' }}
              >
                My Ticket
              </span>
              <span
                onClick={() => navigate('/find-parking')}
                className="text-sm font-semibold hover:text-[#FF4C4C] transition-colors cursor-pointer"
                style={{ color: 'var(--lp-text-muted)' }}
              >
                Find Parking
              </span>
              <span
                onClick={() => navigate('/monthly-pass')}
                className="relative flex items-center gap-1.5 text-sm font-semibold hover:text-[#FF4C4C] transition-colors cursor-pointer"
                style={{ color: 'var(--lp-text-muted)' }}
                title={activePassDaysLeft !== null ? `Vé tháng còn ${activePassDaysLeft} ngày hiệu lực` : undefined}
              >
                Vé Tháng
                {activePassDaysLeft !== null && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </span>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl transition-colors"
                style={{ backgroundColor: 'var(--lp-input-bg)', color: 'var(--lp-text-muted)' }}
                title={isDark ? 'Chuyển Light mode' : 'Chuyển Dark mode'}
              >
                {isDark ? <Sun size={17} /> : <Moon size={17} />}
              </button>

              {token && user && (
                <NotificationBell token={token} accentColor="#FF4C4C" />
              )}

              {token && user ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2.5 rounded-full py-1.5 pl-2 pr-4 transition-all focus:outline-none border"
                    style={{
                      backgroundColor: 'var(--lp-input-bg)',
                      borderColor: 'var(--lp-border)',
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#FF4C4C] flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm shadow-[#FF4C4C]/25">
                      {initials}
                    </div>
                    <span className="text-sm font-semibold hidden sm:block" style={{ color: 'var(--lp-text)' }}>
                      {user.fullName}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--lp-text-faint)' }}
                    />
                  </button>

                  {isDropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-56 rounded-2xl shadow-xl py-2 z-50 border"
                      style={{
                        backgroundColor: 'var(--lp-dropdown-bg)',
                        borderColor: 'var(--lp-border)',
                      }}
                    >
                      {getDashboardPath(user.role) && (
                        <>
                          <button
                            type="button"
                            onClick={() => { setIsDropdownOpen(false); navigate(getDashboardPath(user.role)!); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:text-[#FF4C4C] hover:bg-[#FF4C4C]/5 transition-colors text-left"
                            style={{ color: 'var(--lp-text-muted)' }}
                          >
                            <LayoutDashboard size={16} />
                            <span>Trang quản lý</span>
                          </button>
                          <div className="my-1" style={{ borderTop: '1px solid var(--lp-border)' }} />
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/profile'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:text-[#FF4C4C] hover:bg-[#FF4C4C]/5 transition-colors text-left"
                        style={{ color: 'var(--lp-text-muted)' }}
                      >
                        <User size={16} />
                        <span>Profile</span>
                      </button>
                      <div className="my-1" style={{ borderTop: '1px solid var(--lp-border)' }} />
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/my-vehicles'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:text-[#FF4C4C] hover:bg-[#FF4C4C]/5 transition-colors text-left"
                        style={{ color: 'var(--lp-text-muted)' }}
                      >
                        <Car size={16} />
                        <span>My Vehicles</span>
                      </button>
                      <div className="my-1" style={{ borderTop: '1px solid var(--lp-border)' }} />
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/monthly-pass'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:text-[#FF4C4C] hover:bg-[#FF4C4C]/5 transition-colors text-left"
                        style={{ color: 'var(--lp-text-muted)' }}
                      >
                        <Ticket size={16} />
                        <div className="flex flex-col items-start">
                          <span>Vé Tháng</span>
                          {activePassDaysLeft !== null && (
                            <span className="text-xs text-emerald-500 font-normal">
                              Còn {activePassDaysLeft} ngày hiệu lực
                            </span>
                          )}
                        </div>
                      </button>
                      <div className="my-1" style={{ borderTop: '1px solid var(--lp-border)' }} />
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/wallet'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:text-[#FF4C4C] hover:bg-[#FF4C4C]/5 transition-colors text-left"
                        style={{ color: 'var(--lp-text-muted)' }}
                      >
                        <Wallet size={16} />
                        <span>Ví của tôi</span>
                      </button>
                      <div className="my-1" style={{ borderTop: '1px solid var(--lp-border)' }} />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:text-[#FF4C4C] hover:bg-[#FF4C4C]/5 transition-colors text-left"
                        style={{ color: 'var(--lp-text-muted)' }}
                      >
                        <LogOut size={16} />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/auth"
                  className="font-bold px-6 py-2.5 rounded-full text-sm transition-all shadow-sm hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--lp-btn-primary)',
                    color: 'var(--lp-btn-primary-text)',
                  }}
                >
                  Login / Register
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-20 h-full w-full">
        <Outlet />
      </main>
    </div>
  );
}
