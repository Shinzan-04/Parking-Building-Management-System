import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import NotificationBell from '../../components/NotificationBell';
import FloatingSessionBanner from '../../components/FloatingSessionBanner';
import {
  Search, ShieldCheck, ArrowRight, BookOpen,
  LogOut, Activity, ChevronDown, Ticket,
  LayoutDashboard, Sun, Moon, User,
  Car
} from 'lucide-react';

function getDashboardPath(role: string | number): string | null {
  if (role === 'Admin'   || role === 0) return '/admin';
  if (role === 'Manager' || role === 1) return '/manager';
  if (role === 'Staff'   || role === 2) return '/gate-control';
  return null;
}

export default function UserLandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (user && !(location.state as { fromDashboard?: boolean })?.fromDashboard) {
      const path = getDashboardPath(user.role);
      if (path) navigate(path, { replace: true });
    }
  }, [user, navigate, location.state]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => { logout(); navigate('/auth'); };
  const initials = user?.fullName?.slice(0, 2)?.toUpperCase() ?? 'PD';

  return (
    <div
      className="min-h-screen font-sans antialiased selection:bg-[#FF4C4C]/20 selection:text-[#FF4C4C] transition-colors duration-300"
      style={{ backgroundColor: 'var(--lp-bg)', color: 'var(--lp-text)' }}
    >
      {/* Navbar */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b shadow-sm transition-colors duration-300"
        style={{ backgroundColor: 'var(--lp-nav-bg)', borderColor: 'var(--lp-nav-border)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FF4C4C] flex items-center justify-center text-white font-extrabold text-sm shadow-sm shadow-[#FF4C4C]/25">
                P
              </div>
              <span className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--lp-text)' }}>
                Parking<span className="text-[#FF4C4C]">.</span>
              </span>
            </div>

            {/* Nav links */}
            <div className="hidden md:flex items-center gap-10">
              {['Find Parking', 'Book a Slot', 'Support'].map(label => (
                <span
                  key={label}
                  onClick={label === 'Book a Slot' ? () => navigate('/booking') : undefined}
                  className="text-sm font-semibold hover:text-[#FF4C4C] transition-colors cursor-pointer"
                  style={{ color: 'var(--lp-text-muted)' }}
                >
                  {label}
                </span>
              ))}
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
                        onClick={() => { setIsDropdownOpen(false); navigate('/myticket'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:text-[#FF4C4C] hover:bg-[#FF4C4C]/5 transition-colors text-left"
                        style={{ color: 'var(--lp-text-muted)' }}
                      >
                        <Ticket size={16} />
                        <span>My Tickets</span>
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

      {/* Hero */}
      <section
        className="relative pt-20 pb-28 min-h-[90vh] flex flex-col justify-end overflow-hidden transition-colors duration-300"
        style={{ backgroundColor: 'var(--lp-bg)' }}
      >
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1542282088-fe8426682b8f?auto=format&fit=crop&w=1600&q=80"
            alt="Parking Building overhead"
            className={`w-full h-full object-cover contrast-[1.02] transition-all duration-300 ${isDark ? 'brightness-[0.45]' : 'brightness-[0.7]'}`}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=1600&q=80";
            }}
          />
          <div
            className="absolute inset-0 transition-all duration-300"
            style={{
              background: `linear-gradient(to top, var(--lp-bg) 0%, color-mix(in srgb, var(--lp-bg) 40%, transparent) 50%, rgba(0,0,0,0.4) 100%)`
            }}
          />
        </div>

        {/* Floating slot labels */}
        <div className="absolute inset-0 z-10 pointer-events-none hidden md:block">
          <div className="absolute top-1/4 left-1/4 animate-pulse">
            <span className="backdrop-blur-md border text-emerald-600 font-mono text-[10px] font-bold px-2.5 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--lp-surface)', borderColor: 'rgba(16,185,129,0.2)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              ID-402 Available
            </span>
          </div>
          <div className="absolute top-[35%] right-1/3 opacity-75">
            <span className="backdrop-blur-md border font-mono text-[10px] font-bold px-2.5 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--lp-surface)', borderColor: 'var(--lp-border)', color: 'var(--lp-text-muted)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
              ID-602 Reserved
            </span>
          </div>
        </div>

        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-end">
            <div>
              <h1 className="text-6xl md:text-8xl font-black leading-[0.95] tracking-tighter" style={{ color: 'var(--lp-text)' }}>
                Parking <br />
                <span className="text-[#FF4C4C] italic font-black">Redefined</span>
              </h1>
            </div>
            <div className="lg:max-w-md space-y-6 lg:justify-self-end text-left lg:text-right">
              <p className="text-sm md:text-base font-medium leading-relaxed" style={{ color: 'var(--lp-text-muted)' }}>
                We provide an unrivaled standard of parking convenience, securing and protecting your automotive investment with absolute precision.
              </p>
              <div>
                <button
                  onClick={() => navigate('/booking')}
                  className="border-2 hover:text-white hover:bg-[#FF4C4C] hover:border-[#FF4C4C] font-bold px-7 py-3 rounded-full text-xs tracking-wider uppercase transition-all duration-200 shadow-sm"
                  style={{ borderColor: 'var(--lp-text)', color: 'var(--lp-text)' }}
                >
                  Get a Spot
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seamless Experience */}
      <section className="py-24 transition-colors duration-300" style={{ backgroundColor: 'var(--lp-surface)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--lp-text)' }}>
                Seamless <span className="text-[#FF4C4C] font-extrabold">Experience.</span>
              </h2>
              <p className="text-sm mt-2" style={{ color: 'var(--lp-text-muted)' }}>
                Optimized for rapid acquisition and secure tenure of premium facility slots.
              </p>
            </div>
            <button
              onClick={() => navigate('/booking')}
              className="text-xs font-bold text-[#FF4C4C] hover:text-[#E13B3B] uppercase tracking-widest flex items-center gap-2 group self-start md:self-auto transition-colors"
            >
              Explore All Features
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Search,     title: 'Smart Search',     desc: 'Find and secure the perfect parking slot in seconds with our real-time availability maps.' },
              { icon: BookOpen,   title: 'Instant Booking',  desc: 'Reserve your slot instantly with contactless payment and encrypted transaction protocols.' },
              { icon: ShieldCheck,title: 'Secure Facilities',desc: '24/7 camera surveillance and automated entry systems ensure maximum protection.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-[2rem] p-8 hover:border-[#FF4C4C]/30 transition-all duration-300 border"
                style={{ backgroundColor: 'var(--lp-card-bg)', borderColor: 'var(--lp-card-border)' }}
              >
                <div className="p-3 bg-[#FF4C4C]/10 text-[#FF4C4C] rounded-2xl w-fit mb-6 shadow-sm">
                  <Icon size={20} />
                </div>
                <h4 className="text-lg font-bold mb-3" style={{ color: 'var(--lp-text)' }}>{title}</h4>
                <p className="text-sm leading-relaxed font-medium" style={{ color: 'var(--lp-text-muted)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upgrade Section */}
      <section
        className="py-24 border-t transition-colors duration-300"
        style={{ backgroundColor: 'var(--lp-bg-alt)', borderColor: 'var(--lp-border)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-10">
              <h2 className="text-5xl font-black leading-tight" style={{ color: 'var(--lp-text)' }}>
                Upgrade parking <br />
                <span className="text-[#FF4C4C] font-bold text-5xl">services.</span>
              </h2>
              <div className="space-y-6">
                {[
                  { title: 'Advance Slot Reservation', desc: 'Secure prime locations up to 30 days prior to arrival.' },
                  { title: 'AI-Powered Slot Allocation', desc: 'Dynamic routing to the most efficient parking bay based on vehicle dimensions.' },
                  { title: 'Exception & Support Center', desc: 'Rapid resolution for unexpected access or billing discrepancies.' },
                ].map(({ title, desc }) => (
                  <div key={title} className="border-l-[3px] border-[#FF4C4C] pl-6 space-y-1">
                    <h4 className="text-base font-bold" style={{ color: 'var(--lp-text)' }}>{title}</h4>
                    <p className="text-xs" style={{ color: 'var(--lp-text-muted)' }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6">
              <div
                className="rounded-[2.5rem] overflow-hidden shadow-sm border transition-all duration-300 p-4 hover:border-[#FF4C4C]/25"
                style={{ backgroundColor: 'var(--lp-surface)', borderColor: 'var(--lp-card-border)' }}
              >
                <div className="h-64 overflow-hidden relative rounded-[2rem] border" style={{ borderColor: 'var(--lp-border)' }}>
                  <img
                    src="https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=800&q=80"
                    alt="Tesla black car"
                    className="w-full h-full object-cover brightness-[0.9] contrast-[1.02]"
                  />
                  <span className="absolute top-4 right-4 bg-[#FF4C4C] text-white font-bold text-[10px] tracking-widest px-3.5 py-1.5 rounded-full uppercase shadow-sm">
                    Smart Parking
                  </span>
                </div>
                <div className="p-4 pt-5 space-y-4">
                  <h4 className="text-lg font-bold" style={{ color: 'var(--lp-text)' }}>ParkSmart Building</h4>
                  <div className="flex justify-between items-center text-xs pt-4 border-t" style={{ borderColor: 'var(--lp-border)', color: 'var(--lp-text-muted)' }}>
                    <span className="flex items-center gap-1.5 font-bold">
                      <Activity size={14} className="text-[#FF4C4C]" /> B1 LV Ready
                    </span>
                    <span className="flex items-center gap-1.5 font-bold">
                      <ShieldCheck size={14} className="text-[#FF4C4C]" /> Monitored
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-28 border-t border-b flex flex-col items-center justify-center text-center transition-colors duration-300"
        style={{ backgroundColor: 'var(--lp-surface)', borderColor: 'var(--lp-border)' }}
      >
        <div className="max-w-2xl px-4 space-y-6">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight" style={{ color: 'var(--lp-text)' }}>
            Ready to park with confidence?
          </h2>
          <p className="text-sm md:text-base leading-relaxed max-w-lg mx-auto" style={{ color: 'var(--lp-text-muted)' }}>
            Initiate your seamless parking experience today. Secure, rapid, and precise.
          </p>
          <div className="pt-4">
            <button
              onClick={() => navigate('/booking')}
              className="hover:bg-[#FF4C4C] text-white font-bold px-8 py-4 rounded-full text-xs uppercase tracking-widest shadow-md hover:shadow-[#FF4C4C]/25 transition-all duration-300"
              style={{ backgroundColor: 'var(--lp-btn-primary)', color: 'var(--lp-btn-primary-text)' }}
            >
              Find Your Spot Now
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-16 border-t transition-colors duration-300"
        style={{ backgroundColor: 'var(--lp-footer-bg)', borderColor: 'var(--lp-border)', color: 'var(--lp-text-muted)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#FF4C4C] flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-[#FF4C4C]/20">
                  P
                </div>
                <span className="text-base font-extrabold tracking-tight" style={{ color: 'var(--lp-text)' }}>
                  Parking<span className="text-[#FF4C4C]">.</span>
                </span>
              </div>
              <p className="text-xs leading-relaxed max-w-xs font-medium" style={{ color: 'var(--lp-text-faint)' }}>
                Modern parking management system for smart cities
              </p>
            </div>
            <div>
              <h3 className="font-extrabold text-[10px] mb-4 uppercase tracking-widest font-mono" style={{ color: 'var(--lp-text)' }}>Services</h3>
              <ul className="space-y-2.5 text-xs">
                <li><span onClick={() => navigate('/booking')} className="hover:text-[#FF4C4C] transition-colors cursor-pointer font-bold">Find Parking</span></li>
                <li><span onClick={() => navigate('/booking')} className="hover:text-[#FF4C4C] transition-colors cursor-pointer font-bold">Reserve a Slot</span></li>
                <li><span className="hover:text-[#FF4C4C] transition-colors cursor-pointer font-bold">Support & Feedback</span></li>
              </ul>
            </div>
            <div>
              <h3 className="font-extrabold text-[10px] mb-4 uppercase tracking-widest font-mono" style={{ color: 'var(--lp-text)' }}>Legal</h3>
              <ul className="space-y-2.5 text-xs">
                <li><span className="cursor-not-allowed">Privacy Policy</span></li>
                <li><span className="cursor-not-allowed">Terms of Service</span></li>
              </ul>
            </div>
          </div>
          <div
            className="mt-12 pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] font-bold"
            style={{ borderColor: 'var(--lp-border)', color: 'var(--lp-text-faint)' }}
          >
            <span>© 2026 PARKING BUILDING. Precise Facility Management.</span>
            <span>All rights reserved.</span>
          </div>
        </div>
      </footer>
      <FloatingSessionBanner />
    </div>
  );
}
