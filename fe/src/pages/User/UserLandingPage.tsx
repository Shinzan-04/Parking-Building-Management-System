import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  Search,
  ShieldCheck,
  ArrowRight,
  BookOpen,
  LogOut,
  Activity
} from 'lucide-react';

export default function UserLandingPage() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  // Đăng xuất
  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const initials = user?.fullName?.slice(0, 2)?.toUpperCase() ?? 'PD';

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-slate-100 font-sans antialiased selection:bg-amber-500 selection:text-black">
      
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0E0E10]/95 backdrop-blur-md border-b border-white/5 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-wider text-white">
                PARKING <span className="text-amber-500">BUILDING</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-10">
              <span className="text-sm font-semibold text-slate-300 hover:text-amber-500 transition-colors cursor-pointer">
                Find Parking
              </span>
              <span className="text-sm font-semibold text-slate-300 hover:text-amber-500 transition-colors cursor-pointer">
                Book a Slot
              </span>
              <span className="text-sm font-semibold text-slate-300 hover:text-amber-500 transition-colors cursor-pointer">
                Support
              </span>
            </div>

            <div className="flex items-center gap-3">
              {token && user ? (
                <>
                  {/* Profile info & Logout */}
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full py-1.5 pl-2 pr-4">
                    <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold text-xs">
                      {initials}
                    </div>
                    <span className="text-sm text-slate-200 font-bold hidden sm:block">
                      {user.fullName}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-500/10 transition-all border border-white/5"
                    title="Đăng xuất"
                  >
                    <LogOut size={16} />
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-2.5 rounded-full text-sm transition-all"
                >
                  Login / Register
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative pt-20 pb-28 min-h-[90vh] flex flex-col justify-end overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1542282088-fe8426682b8f?auto=format&fit=crop&w=1600&q=80"
            alt="Parking Building overhead"
            className="w-full h-full object-cover brightness-[0.3] contrast-[1.05]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=1600&q=80";
            }}
          />
          {/* Lớp phủ gradient chuyển tiếp tối */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C] via-transparent to-black/60" />
        </div>

        {/* Định vị các nhãn chỗ đỗ xe ảo trên ảnh nền */}
        <div className="absolute inset-0 z-10 pointer-events-none hidden md:block">
          <div className="absolute top-1/4 left-1/4 animate-pulse">
            <span className="bg-black/80 backdrop-blur-md border border-amber-500/50 text-amber-500 font-mono text-[10px] font-bold px-2.5 py-1 rounded-md shadow-lg flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              ID-402 Available
            </span>
          </div>
          <div className="absolute top-[35%] right-1/3 opacity-75">
            <span className="bg-black/80 backdrop-blur-md border border-slate-700 text-slate-400 font-mono text-[10px] px-2.5 py-1 rounded-md shadow-lg flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              ID-602 Reserved
            </span>
          </div>
        </div>

        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-end">
            <div>
              <h1 className="text-6xl md:text-8xl font-black text-white leading-[0.95] tracking-tighter">
                Parking <br />
                <span className="text-amber-500 italic font-black">Redefined</span>
              </h1>
            </div>

            <div className="lg:max-w-md space-y-6 lg:justify-self-end text-left lg:text-right">
              <p className="text-sm md:text-base text-slate-400 leading-relaxed">
                We provide an unrivaled standard of parking convenience, securing and protecting your automotive investment with absolute precision.
              </p>
              <div>
                <button
                  className="border border-white hover:border-amber-500 hover:text-amber-500 text-white font-bold px-7 py-3 rounded-md text-xs tracking-wider uppercase transition-all duration-200"
                >
                  Get a Spot
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seamless Experience Section */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h2 className="text-4xl font-extrabold text-white tracking-tight">
              Seamless <span className="text-amber-500 font-bold">Experience</span>
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Optimized for rapid acquisition and secure tenure of premium facility slots.
            </p>
          </div>
          <button
            className="text-xs font-bold text-amber-500 hover:text-amber-400 uppercase tracking-widest flex items-center gap-2 group self-start md:self-auto"
          >
            Explore All Features
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-[#121214] border border-white/5 rounded-2xl p-8 hover:border-amber-500/20 transition-all duration-300">
            <div className="p-3 bg-white/5 text-amber-500 rounded-xl w-fit mb-6">
              <Search size={20} />
            </div>
            <h4 className="text-lg font-bold text-white mb-3">Smart Search</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Find and secure the perfect parking slot in seconds with our real-time availability maps.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-[#121214] border border-white/5 rounded-2xl p-8 hover:border-amber-500/20 transition-all duration-300">
            <div className="p-3 bg-white/5 text-amber-500 rounded-xl w-fit mb-6">
              <BookOpen size={20} />
            </div>
            <h4 className="text-lg font-bold text-white mb-3">Instant Booking</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Reserve your slot instantly with contactless payment and encrypted transaction protocols.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-[#121214] border border-white/5 rounded-2xl p-8 hover:border-amber-500/20 transition-all duration-300">
            <div className="p-3 bg-white/5 text-amber-500 rounded-xl w-fit mb-6">
              <ShieldCheck size={20} />
            </div>
            <h4 className="text-lg font-bold text-white mb-3">Secure Facilities</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              24/7 camera surveillance and automated entry systems ensure maximum protection.
            </p>
          </div>
        </div>
      </section>

      {/* Upgrade Parking Services Section */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-6 space-y-10">
            <h2 className="text-5xl font-black text-white leading-tight">
              Upgrade parking <br />
              <span className="text-amber-500 font-bold text-5xl">services.</span>
            </h2>

            <div className="space-y-6">
              <div className="border-l-2 border-amber-500 pl-6 space-y-1">
                <h4 className="text-base font-bold text-white">Advance Slot Reservation</h4>
                <p className="text-xs text-slate-400">Secure prime locations up to 30 days prior to arrival.</p>
              </div>
              <div className="border-l-2 border-amber-500 pl-6 space-y-1">
                <h4 className="text-base font-bold text-white">AI-Powered Slot Allocation</h4>
                <p className="text-xs text-slate-400">Dynamic routing to the most efficient parking bay based on vehicle dimensions.</p>
              </div>
              <div className="border-l-2 border-amber-500 pl-6 space-y-1">
                <h4 className="text-base font-bold text-white">Exception & Support Center</h4>
                <p className="text-xs text-slate-400">Rapid resolution for unexpected access or billing discrepancies.</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="bg-[#121214] border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
              <div className="h-64 overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=800&q=80"
                  alt="Tesla black car"
                  className="w-full h-full object-cover brightness-[0.85] contrast-[1.05]"
                />
                <span className="absolute top-4 right-4 bg-amber-500 text-black font-black text-[9px] tracking-widest px-2.5 py-1 rounded uppercase">
                  Smart Parking
                </span>
              </div>
              <div className="p-6 space-y-4">
                <h4 className="text-xl font-bold text-white">ParkSmart Building</h4>
                <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-white/5">
                  <span className="flex items-center gap-1">
                    <Activity size={13} className="text-amber-500" />
                    B1 LV Ready
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck size={13} className="text-amber-500" />
                    Monitored
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* CTA Section - Ready to park with confidence? */}
      <section className="py-28 bg-[#0E0E10] border-t border-b border-white/5 flex flex-col items-center justify-center text-center">
        <div className="max-w-2xl px-4 space-y-6">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Ready to park with confidence?
          </h2>
          <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-lg mx-auto">
            Initiate your seamless parking experience today. Secure, rapid, and precise.
          </p>
          <div className="pt-4">
            <button
              className="bg-white hover:bg-amber-500 hover:text-black text-black font-black px-8 py-3.5 rounded-full text-xs uppercase tracking-widest shadow-lg shadow-white/5 hover:shadow-amber-500/20 transition-all duration-300"
            >
              Find Your Spot Now
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#050507] text-slate-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg font-bold tracking-wider text-white">
                  PARKING <span className="text-amber-500">BUILDING</span>
                </span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                Modern parking management system for smart cities
              </p>
            </div>

            <div>
              <h3 className="font-bold text-xs mb-4 text-white uppercase tracking-widest">Services</h3>
              <ul className="space-y-2.5 text-sm text-slate-500">
                <li><span className="hover:text-amber-500 transition-colors cursor-pointer">Find Parking</span></li>
                <li><span className="hover:text-amber-500 transition-colors cursor-pointer">Reserve a Slot</span></li>
                <li><span className="hover:text-amber-500 transition-colors cursor-pointer">Support & Feedback</span></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-xs mb-4 text-white uppercase tracking-widest">Legal</h3>
              <ul className="space-y-2.5 text-sm text-slate-500">
                <li><span className="cursor-not-allowed">Privacy Policy</span></li>
                <li><span className="cursor-not-allowed">Terms of Service</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
            <span>© 2026 PARKING BUILDING. Precise Facility Management.</span>
            <span>All rights reserved.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
