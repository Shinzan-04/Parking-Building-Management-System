import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  Search,
  ShieldCheck,
  ArrowRight,
  BookOpen,
  LogOut,
  Activity,
  ChevronDown,
  Ticket,
  LayoutDashboard,
  User,
  Car,
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Redirect admin/manager/staff về dashboard, trừ khi họ chủ động vào trang chủ
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Đăng xuất
  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const initials = user?.fullName?.slice(0, 2)?.toUpperCase() ?? 'PD';

  return (
    <div className="min-h-screen bg-[#F3F3F5] text-stone-900 font-sans antialiased selection:bg-[#FF4C4C]/20 selection:text-[#FF4C4C]">
      
      {/* Navigation Bar - Light Premium Blur */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FF4C4C] flex items-center justify-center text-white font-extrabold text-sm shadow-sm shadow-[#FF4C4C]/25">
                P
              </div>
              <span className="text-lg font-extrabold tracking-tight text-stone-900">
                Parking<span className="text-[#FF4C4C]">.</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-10">
              <span className="text-sm font-semibold text-stone-600 hover:text-[#FF4C4C] transition-colors cursor-pointer">
                Find Parking
              </span>
              <span onClick={() => navigate('/booking')} className="text-sm font-semibold text-stone-600 hover:text-[#FF4C4C] transition-colors cursor-pointer">
                Book a Slot
              </span>
              <span className="text-sm font-semibold text-stone-600 hover:text-[#FF4C4C] transition-colors cursor-pointer">
                Support
              </span>
            </div>

            <div className="flex items-center gap-3">
              {token && user ? (
                <div className="relative" ref={dropdownRef}>
                  {/* Profile info badge */}
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2.5 bg-gray-100 border border-gray-200/50 rounded-full py-1.5 pl-2 pr-4 hover:bg-gray-200 transition-all focus:outline-none"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#FF4C4C] flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm shadow-[#FF4C4C]/25">
                      {initials}
                    </div>
                    <span className="text-sm text-stone-800 font-semibold hidden sm:block">
                      {user.fullName}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-stone-500 transition-transform duration-200 ${
                        isDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                      {getDashboardPath(user.role) && (
                        <>
                          <button
                            type="button"
                            onClick={() => { setIsDropdownOpen(false); navigate(getDashboardPath(user.role)!); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:text-[#FF4C4C] hover:bg-red-50 transition-colors text-left"
                          >
                            <LayoutDashboard size={16} />
                            <span>Trang quản lý</span>
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/profile'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:text-[#FF4C4C] hover:bg-red-50 transition-colors text-left"
                      >
                        <User size={16} />
                        <span>Profile</span>
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/my-vehicles'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:text-[#FF4C4C] hover:bg-red-50 transition-colors text-left"
                      >
                        <Car size={16} />
                        <span>My Vehicles</span>
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/myticket'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:text-[#FF4C4C] hover:bg-red-50 transition-colors text-left"
                      >
                        <Ticket size={16} />
                        <span>My Tickets</span>
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:text-[#FF4C4C] hover:bg-red-50 transition-colors text-left"
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
                  className="bg-stone-900 hover:bg-stone-800 text-white font-bold px-6 py-2.5 rounded-full text-sm transition-all shadow-sm"
                >
                  Login / Register
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Keeps original layout with dark image, but transitions to light mode background */}
      <section id="home" className="relative pt-20 pb-28 min-h-[90vh] flex flex-col justify-end overflow-hidden bg-[#F3F3F5]">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1542282088-fe8426682b8f?auto=format&fit=crop&w=1600&q=80"
            alt="Parking Building overhead"
            className="w-full h-full object-cover brightness-[0.7] contrast-[1.02]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=1600&q=80";
            }}
          />
          {/* Lớp phủ gradient chuyển tiếp tối dần lên trên, phía dưới nhạt dần ra màu nền trang sáng */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#F3F3F5] via-[#F3F3F5]/40 to-black/50" />
        </div>

        {/* Định vị các nhãn chỗ đỗ xe ảo trên ảnh nền - Cập nhật giao diện tinh tế sáng màu */}
        <div className="absolute inset-0 z-10 pointer-events-none hidden md:block">
          <div className="absolute top-1/4 left-1/4 animate-pulse">
            <span className="bg-white/95 backdrop-blur-md border border-emerald-500/20 text-emerald-600 font-mono text-[10px] font-bold px-2.5 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              ID-402 Available
            </span>
          </div>
          <div className="absolute top-[35%] right-1/3 opacity-75">
            <span className="bg-white/95 backdrop-blur-md border border-gray-200 text-stone-500 font-mono text-[10px] font-bold px-2.5 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
              ID-602 Reserved
            </span>
          </div>
        </div>

        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-end">
            <div>
              <h1 className="text-6xl md:text-8xl font-black text-stone-900 leading-[0.95] tracking-tighter">
                Parking <br />
                <span className="text-[#FF4C4C] italic font-black">Redefined</span>
              </h1>
            </div>

            <div className="lg:max-w-md space-y-6 lg:justify-self-end text-left lg:text-right">
              <p className="text-sm md:text-base text-stone-600 font-medium leading-relaxed">
                We provide an unrivaled standard of parking convenience, securing and protecting your automotive investment with absolute precision.
              </p>
              <div>
                <button
                  onClick={() => navigate('/booking')}
                  className="border-2 border-stone-900 hover:border-[#FF4C4C] hover:text-white hover:bg-[#FF4C4C] text-stone-900 font-bold px-7 py-3 rounded-full text-xs tracking-wider uppercase transition-all duration-200 shadow-sm"
                >
                  Get a Spot
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seamless Experience Section - Bento Grid Style */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h2 className="text-4xl font-extrabold text-stone-900 tracking-tight">
                Seamless <span className="text-[#FF4C4C] font-extrabold">Experience.</span>
              </h2>
              <p className="text-sm text-stone-500 mt-2">
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
            {/* Card 1 */}
            <div className="bg-white border border-gray-200/60 rounded-[2rem] p-8 hover:border-[#FF4C4C]/30 hover:shadow-lg hover:shadow-gray-200/20 transition-all duration-300">
              <div className="p-3 bg-[#FF4C4C]/10 text-[#FF4C4C] rounded-2xl w-fit mb-6 shadow-sm">
                <Search size={20} />
              </div>
              <h4 className="text-lg font-bold text-stone-900 mb-3">Smart Search</h4>
              <p className="text-sm text-stone-550 leading-relaxed font-medium">
                Find and secure the perfect parking slot in seconds with our real-time availability maps.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white border border-gray-200/60 rounded-[2rem] p-8 hover:border-[#FF4C4C]/30 hover:shadow-lg hover:shadow-gray-200/20 transition-all duration-300">
              <div className="p-3 bg-[#FF4C4C]/10 text-[#FF4C4C] rounded-2xl w-fit mb-6 shadow-sm">
                <BookOpen size={20} />
              </div>
              <h4 className="text-lg font-bold text-stone-900 mb-3">Instant Booking</h4>
              <p className="text-sm text-stone-550 leading-relaxed font-medium">
                Reserve your slot instantly with contactless payment and encrypted transaction protocols.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white border border-gray-200/60 rounded-[2rem] p-8 hover:border-[#FF4C4C]/30 hover:shadow-lg hover:shadow-gray-200/20 transition-all duration-300">
              <div className="p-3 bg-[#FF4C4C]/10 text-[#FF4C4C] rounded-2xl w-fit mb-6 shadow-sm">
                <ShieldCheck size={20} />
              </div>
              <h4 className="text-lg font-bold text-stone-900 mb-3">Secure Facilities</h4>
              <p className="text-sm text-stone-550 leading-relaxed font-medium">
                24/7 camera surveillance and automated entry systems ensure maximum protection.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Upgrade Parking Services Section */}
      <section className="py-24 bg-[#F3F3F5] border-t border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-10">
              <h2 className="text-5xl font-black text-stone-900 leading-tight">
                Upgrade parking <br />
                <span className="text-[#FF4C4C] font-bold text-5xl">services.</span>
              </h2>

              <div className="space-y-6">
                <div className="border-l-3 border-[#FF4C4C] pl-6 space-y-1">
                  <h4 className="text-base font-bold text-stone-900">Advance Slot Reservation</h4>
                  <p className="text-xs text-stone-500">Secure prime locations up to 30 days prior to arrival.</p>
                </div>
                <div className="border-l-3 border-[#FF4C4C] pl-6 space-y-1">
                  <h4 className="text-base font-bold text-stone-900">AI-Powered Slot Allocation</h4>
                  <p className="text-xs text-stone-500">Dynamic routing to the most efficient parking bay based on vehicle dimensions.</p>
                </div>
                <div className="border-l-3 border-[#FF4C4C] pl-6 space-y-1">
                  <h4 className="text-base font-bold text-stone-900">Exception & Support Center</h4>
                  <p className="text-xs text-stone-500">Rapid resolution for unexpected access or billing discrepancies.</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="bg-white border border-gray-200/60 rounded-[2.5rem] overflow-hidden shadow-sm hover:border-[#FF4C4C]/25 transition-all duration-300 p-4">
                <div className="h-64 overflow-hidden relative rounded-[2rem] border border-gray-200/40">
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
                  <h4 className="text-lg font-bold text-stone-900">ParkSmart Building</h4>
                  <div className="flex justify-between items-center text-xs text-stone-500 pt-4 border-t border-gray-150">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Activity size={14} className="text-[#FF4C4C]" />
                      B1 LV Ready
                    </span>
                    <span className="flex items-center gap-1.5 font-bold">
                      <ShieldCheck size={14} className="text-[#FF4C4C]" />
                      Monitored
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Section - Light Minimal Contrast */}
      <section className="py-28 bg-white border-t border-b border-gray-200/60 flex flex-col items-center justify-center text-center">
        <div className="max-w-2xl px-4 space-y-6">
          <h2 className="text-4xl md:text-5xl font-extrabold text-stone-900 tracking-tight">
            Ready to park with confidence?
          </h2>
          <p className="text-sm md:text-base text-stone-500 leading-relaxed max-w-lg mx-auto">
            Initiate your seamless parking experience today. Secure, rapid, and precise.
          </p>
          <div className="pt-4">
            <button
              onClick={() => navigate('/booking')}
              className="bg-stone-900 hover:bg-[#FF4C4C] text-white font-bold px-8 py-4 rounded-full text-xs uppercase tracking-widest shadow-md hover:shadow-[#FF4C4C]/25 transition-all duration-300"
            >
              Find Your Spot Now
            </button>
          </div>
        </div>
      </section>

      {/* Footer - Light Minimal Footer */}
      <footer className="bg-[#F8F8FA] text-stone-500 py-16 border-t border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#FF4C4C] flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-[#FF4C4C]/20">
                  P
                </div>
                <span className="text-base font-extrabold tracking-tight text-stone-900">
                  Parking<span className="text-[#FF4C4C]">.</span>
                </span>
              </div>
              <p className="text-stone-400 text-xs leading-relaxed max-w-xs font-medium">
                Modern parking management system for smart cities
              </p>
            </div>

            <div>
              <h3 className="font-extrabold text-[10px] mb-4 text-stone-800 uppercase tracking-widest font-mono">Services</h3>
              <ul className="space-y-2.5 text-xs">
                <li><span onClick={() => navigate('/booking')} className="hover:text-[#FF4C4C] transition-colors cursor-pointer font-bold">Find Parking</span></li>
                <li><span onClick={() => navigate('/booking')} className="hover:text-[#FF4C4C] transition-colors cursor-pointer font-bold">Reserve a Slot</span></li>
                <li><span className="hover:text-[#FF4C4C] transition-colors cursor-pointer font-bold font-semibold">Support & Feedback</span></li>
              </ul>
            </div>

            <div>
              <h3 className="font-extrabold text-[10px] mb-4 text-stone-800 uppercase tracking-widest font-mono">Legal</h3>
              <ul className="space-y-2.5 text-xs">
                <li><span className="cursor-not-allowed">Privacy Policy</span></li>
                <li><span className="cursor-not-allowed">Terms of Service</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200/60 flex flex-col sm:flex-row justify-between items-center gap-4 text-2xs text-stone-400 font-bold">
            <span>© 2026 PARKING BUILDING. Precise Facility Management.</span>
            <span>All rights reserved.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
