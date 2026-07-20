import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import FloatingSessionBanner from '../../components/FloatingSessionBanner';
import { getAllPolicies as getPricingPolicies } from '../../services/pricingService';
import { getAllPolicies as getMonthlyPolicies } from '../../services/subscriptionService';
import {
  ChevronDown,
  Radio,
  Zap,
  BadgeDollarSign,
  Ticket,
  Sun,
  Moon,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

/* ─── helper ──────────────────────────────────────────────── */
function getDashboardPath(role: string | number): string | null {
  if (role === 'Admin' || role === 0) return '/admin';
  if (role === 'Manager' || role === 1) return '/manager';
  if (role === 'Staff' || role === 2) return '/staff';
  return null;
}

/* ─── Data ─────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Radio,
    title: 'Real-time Tracking',
    desc: 'System continuously updates the status of each parking slot (Available / Occupied). Know the availability before you arrive.',
    gradient: 'from-emerald-500/20 to-teal-500/10',
    accent: '#10B981',
  },
  {
    icon: Zap,
    title: 'Lightning-fast Check-in/out',
    desc: 'Smart license plate recognition automatically opens gates, creates parking sessions, and checks out without stopping.',
    gradient: 'from-amber-500/20 to-orange-500/10',
    accent: '#F59E0B',
  },
  {
    icon: BadgeDollarSign,
    title: 'Automated & Transparent Billing',
    desc: 'Costs are accurately calculated based on actual block usage. Track estimated costs via Live Session.',
    gradient: 'from-blue-500/20 to-indigo-500/10',
    accent: '#3B82F6',
  },
  {
    icon: Ticket,
    title: 'Convenient Monthly Pass',
    desc: 'Register and renew monthly passes directly on the app. Automatic VIP recognition, open gates without stopping.',
    gradient: 'from-purple-500/20 to-pink-500/10',
    accent: '#A855F7',
  },
];

const HOURLY_PLANS = [
  {
    label: 'Motorbike',
    emoji: '🛵',
    dayRate: '2,000',
    nightRate: '3,000',
    unit: 'block',
    popular: false,
  },
  {
    label: 'Car',
    emoji: '🚗',
    dayRate: '10,000',
    nightRate: '15,000',
    unit: 'block',
    popular: true,
  },
];

const MONTHLY_PLANS = [
  { label: 'Motorbike', emoji: '🛵', price: '150,000', unit: 'month' },
  { label: 'Car', emoji: '🚗', price: '1,500,000', unit: 'month' },
];

const PRICING_RULES = [
  {
    icon: Clock,
    color: '#3B82F6',
    title: '1 Block = 4 hours',
    desc: 'Park for 3 hrs → charged 1 block. Park for 5 hrs → charged 2 blocks. Time is rounded up per block.',
  },
  {
    icon: Sun,
    color: '#F59E0B',
    title: 'Day Hours (06:00 – 22:00)',
    desc: 'Applies day block rate. Blocks starting within these hours are charged day rates.',
  },
  {
    icon: Moon,
    color: '#8B5CF6',
    title: 'Night Hours (22:00 – 06:00)',
    desc: 'Applies higher night block rate. Blocks starting after 22:00 or before 06:00 are charged night rates.',
  },
  {
    icon: AlertTriangle,
    color: '#EF4444',
    title: 'Overdue Fee',
    desc: 'Parking beyond the reserved time incurs a 1.5x penalty multiplier on the standard block rate.',
  },
];

/* ─── Sub-components ────────────────────────────────────────── */

/** Dot navigation on the right */
function DotNav({ active, total, onDot }: { active: number; total: number; onDot: (i: number) => void }) {
  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 hidden md:flex">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onDot(i)}
          className="w-2 h-2 rounded-full transition-all duration-300 border"
          style={{
            backgroundColor: active === i ? '#FF4C4C' : 'transparent',
            borderColor: active === i ? '#FF4C4C' : 'rgba(255,255,255,0.3)',
            transform: active === i ? 'scale(1.4)' : 'scale(1)',
          }}
          title={`Section ${i + 1}`}
        />
      ))}
    </div>
  );
}

/* ─── Easing function ──────────────────────────────────────── */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function UserLandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(0);
  const sectionRefs = useRef<HTMLElement[]>([]);
  const TOTAL = 4;

  const [hourlyPlans, setHourlyPlans] = useState<{ label: string; dayRate: string; nightRate: string; unit: string; popular: boolean }[]>(HOURLY_PLANS);
  const [monthlyPlans, setMonthlyPlans] = useState<{ label: string; price: string; unit: string }[]>(MONTHLY_PLANS);

  // Refs for animation state — không cần re-render
  const currentSectionRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const touchStartYRef = useRef(0);

  /* Fetch dynamic pricing from API */
  useEffect(() => {
    async function fetchPricing() {
      try {
        const [pricingPolicies, monthlyPolicies] = await Promise.all([
          getPricingPolicies(),
          getMonthlyPolicies()
        ]);

        if (pricingPolicies && pricingPolicies.length > 0) {
          const activePricing = pricingPolicies.filter(p => p.isActive !== false);
          const formattedHourly = activePricing.map(p => ({
            label: p.vehicleTypeName,
            dayRate: p.dayBlockRate.toLocaleString(),
            nightRate: p.nightBlockRate.toLocaleString(),
            unit: 'block',
            popular: p.vehicleTypeName.toLowerCase().includes('car')
          }));
          if (formattedHourly.length > 0) {
            setHourlyPlans(formattedHourly);
          }
        }

        if (monthlyPolicies && monthlyPolicies.length > 0) {
          const activeMonthly = monthlyPolicies.filter(p => p.isActive !== false);
          const formattedMonthly = activeMonthly.map(p => ({
            label: p.vehicleTypeName,
            price: p.monthlyPrice.toLocaleString(),
            unit: 'month'
          }));
          if (formattedMonthly.length > 0) {
            setMonthlyPlans(formattedMonthly);
          }
        }
      } catch (error) {
        console.error('Failed to fetch pricing:', error);
      }
    }
    fetchPricing();
  }, []);

  /* Redirect admin/manager/staff to dashboard */
  useEffect(() => {
    if (user && !(location.state as { fromDashboard?: boolean })?.fromDashboard) {
      const path = getDashboardPath(user.role);
      if (path) navigate(path, { replace: true });
    }
  }, [user, navigate, location.state]);

  /**
   * Animate scroll từ vị trí hiện tại đến target section
   * bằng requestAnimationFrame + easeInOutCubic (~700ms)
   */
  const animateTo = useRef((targetIndex: number) => {
    const container = containerRef.current;
    if (!container || isAnimatingRef.current) return;
    if (targetIndex < 0 || targetIndex >= TOTAL) return;
    if (targetIndex === currentSectionRef.current) return;

    isAnimatingRef.current = true;
    const startTop = container.scrollTop;
    const endTop = targetIndex * container.clientHeight;
    const duration = 700; // ms
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);

      container.scrollTop = startTop + (endTop - startTop) * eased;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        container.scrollTop = endTop;
        currentSectionRef.current = targetIndex;
        setActiveSection(targetIndex);
        // Cooldown ngắn sau animation để tránh over-scroll
        setTimeout(() => { isAnimatingRef.current = false; }, 100);
      }
    };

    requestAnimationFrame(step);
  });

  /** Hàm public để DotNav và scroll buttons gọi */
  const scrollTo = (index: number) => animateTo.current(index);

  const setRef = (i: number) => (el: HTMLElement | null) => {
    if (el) sectionRefs.current[i] = el;
  };

  /* Wheel event — chặn native scroll, tự điều khiển */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let wheelDelta = 0;
    let wheelTimer: ReturnType<typeof setTimeout> | null = null;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isAnimatingRef.current) return;

      wheelDelta += e.deltaY;

      // Reset accumulator sau 80ms không có wheel event
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { wheelDelta = 0; }, 80);

      // Chỉ trigger khi đủ ngưỡng (tránh trackpad nhạy)
      if (Math.abs(wheelDelta) < 50) return;

      const direction = wheelDelta > 0 ? 1 : -1;
      wheelDelta = 0;
      animateTo.current(currentSectionRef.current + direction);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  /* Touch swipe — hỗ trợ mobile */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartYRef.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isAnimatingRef.current) return;
      const delta = touchStartYRef.current - e.changedTouches[0].clientY;
      if (Math.abs(delta) < 40) return; // quá nhỏ, bỏ qua
      const direction = delta > 0 ? 1 : -1;
      animateTo.current(currentSectionRef.current + direction);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  /* Keyboard navigation (Arrow keys / PageUp / PageDown) */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['ArrowDown', 'PageDown'].includes(e.key)) {
        e.preventDefault();
        animateTo.current(currentSectionRef.current + 1);
      } else if (['ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        animateTo.current(currentSectionRef.current - 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <>
      {/* Custom Smooth Scroll Container — overflow hidden, scroll controlled by JS */}
      <div
        ref={containerRef}
        className="h-[calc(100vh-80px)] overflow-hidden"
        style={{ position: 'relative' }}
      >
        {/* ─── SECTION 1: HERO ──────────────────────────────────── */}
        <section
          ref={setRef(0)}
          className="relative flex flex-col justify-center items-start overflow-hidden"
          style={{
            height: '100%',
            backgroundColor: 'var(--lp-bg)',
          }}
        >
          {/* Background image */}
          <div className="absolute inset-0 z-0">
            <img
              src="https://images.unsplash.com/photo-1574620608490-716e8f7a4b5c?auto=format&fit=crop&w=1800&q=80"
              alt="Smart parking from above"
              className="w-full h-full object-cover"
              style={{ filter: 'brightness(0.35) contrast(1.05)' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1542282088-fe8426682b8f?auto=format&fit=crop&w=1800&q=80';
              }}
            />
            {/* gradient overlay */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(135deg, rgba(10,10,12,0.95) 0%, rgba(10,10,12,0.5) 50%, rgba(255,76,76,0.08) 100%)',
              }}
            />
          </div>

          {/* Floating slot badges */}
          <div className="absolute inset-0 z-10 pointer-events-none hidden md:block">
            <div className="absolute top-1/3 right-[12%] animate-bounce" style={{ animationDuration: '3s' }}>
              <span
                className="backdrop-blur-md border font-mono text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2"
                style={{ backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.3)', color: '#10B981' }}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                B2-14 · Available
              </span>
            </div>
            <div className="absolute top-[55%] right-[18%] opacity-70">
              <span
                className="backdrop-blur-md border font-mono text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2"
                style={{ backgroundColor: 'rgba(255,76,76,0.12)', borderColor: 'rgba(255,76,76,0.25)', color: '#FF4C4C' }}
              >
                <span className="w-2 h-2 rounded-full bg-red-400" />
                A1-07 · Occupied
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="relative z-20 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase mb-6 px-4 py-2 rounded-full border"
              style={{ borderColor: 'rgba(255,76,76,0.3)', color: '#FF4C4C', backgroundColor: 'rgba(255,76,76,0.08)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4C4C] animate-pulse" />
              System Operational
            </div>

            <h1 className="text-[clamp(3rem,9vw,8rem)] font-black leading-[0.9] tracking-tighter text-white mb-6">
              Parking
              <br />
              <span style={{ color: '#FF4C4C', fontStyle: 'italic' }}>Smart.</span>
            </h1>

            <p className="text-base md:text-lg font-medium max-w-md mb-10" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Touchless parking experience — find a spot, book, and pay in seconds.
            </p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/find-parking')}
                className="flex items-center gap-2 font-bold px-8 py-4 rounded-full text-sm uppercase tracking-widest transition-all duration-300 shadow-lg hover:shadow-[#FF4C4C]/30 hover:scale-105"
                style={{ backgroundColor: '#FF4C4C', color: '#fff' }}
              >
                Find a Spot Now
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate('/monthly-pass')}
                className="font-bold px-8 py-4 rounded-full text-sm uppercase tracking-widest border-2 transition-all duration-300 hover:bg-white/10"
                style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.75)' }}
              >
                Register Monthly Pass
              </button>
            </div>
          </div>

          {/* Scroll hint */}
          <button
            onClick={() => scrollTo(1)}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 opacity-50 hover:opacity-90 transition-opacity"
          >
            <span className="text-xs font-bold tracking-widest uppercase text-white">Scroll Down</span>
            <ChevronDown size={20} color="white" className="animate-bounce" />
          </button>
        </section>

        {/* ─── SECTION 2: FEATURES ──────────────────────────────── */}
        <section
          ref={setRef(1)}
          className="relative flex flex-col justify-center overflow-hidden"
          style={{
            height: '100%',
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
            backgroundColor: 'var(--lp-surface)',
          }}
        >
          <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full py-12">
            {/* Header */}
            <div className="mb-10">
              <span
                className="text-xs font-black tracking-[0.2em] uppercase font-mono"
                style={{ color: '#FF4C4C' }}
              >
                Core Features
              </span>
              <h2
                className="text-3xl md:text-5xl font-black tracking-tight mt-2"
                style={{ color: 'var(--lp-text)' }}
              >
                Everything you need,{' '}
                <span style={{ color: '#FF4C4C' }}>all in one place.</span>
              </h2>
            </div>

            {/* Grid 2×2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
              {FEATURES.map(({ icon: Icon, title, desc, gradient, accent }) => (
                <div
                  key={title}
                  className={`group relative rounded-2xl p-6 lg:p-8 border transition-all duration-300 cursor-default overflow-hidden hover:scale-[1.015]`}
                  style={{
                    backgroundColor: 'var(--lp-card-bg)',
                    borderColor: 'var(--lp-card-border)',
                  }}
                >
                  {/* gradient bg */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                  />
                  <div className="relative z-10">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 shadow-sm"
                      style={{ backgroundColor: `${accent}18`, color: accent }}
                    >
                      <Icon size={22} />
                    </div>
                    <h3
                      className="text-base lg:text-lg font-bold mb-2"
                      style={{ color: 'var(--lp-text)' }}
                    >
                      {title}
                    </h3>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: 'var(--lp-text-muted)' }}
                    >
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scroll hint */}
          <button
            onClick={() => scrollTo(2)}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 opacity-30 hover:opacity-70 transition-opacity"
          >
            <ChevronDown size={20} style={{ color: 'var(--lp-text)' }} className="animate-bounce" />
          </button>
        </section>

        {/* ─── SECTION 3: PRICING ───────────────────────────────── */}
        <section
          ref={setRef(2)}
          className="relative flex flex-col justify-center overflow-hidden"
          style={{
            height: '100%',
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
            backgroundColor: 'var(--lp-bg)',
          }}
        >
          {/* Subtle background glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[120px] pointer-events-none opacity-10"
            style={{ backgroundColor: '#FF4C4C' }}
          />

          <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full py-10">
            {/* Header */}
            <div className="text-center mb-8">
              <span
                className="text-xs font-black tracking-[0.2em] uppercase font-mono"
                style={{ color: '#FF4C4C' }}
              >
                Service Pricing
              </span>
              <h2
                className="text-3xl md:text-4xl font-black tracking-tight mt-2"
                style={{ color: 'var(--lp-text)' }}
              >
                Clear.{' '}
                <span style={{ color: '#FF4C4C' }}>Transparent.</span>
              </h2>
            </div>

            {/* 2 plan sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
              {/* Standard */}
              <div
                className="rounded-2xl border p-6 transition-all duration-300 hover:border-[#FF4C4C]/30"
                style={{
                  backgroundColor: 'var(--lp-surface)',
                  borderColor: 'var(--lp-card-border)',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p
                      className="text-xs font-black tracking-widest uppercase font-mono mb-1"
                      style={{ color: '#FF4C4C' }}
                    >
                      Standard Guest
                    </p>
                    <h3
                      className="text-lg font-extrabold"
                      style={{ color: 'var(--lp-text)' }}
                    >
                      Pay by Time Block
                    </h3>
                  </div>
                  {/* <span className="text-2xl">🅿️</span> */}
                </div>

                <div className="space-y-3">
                  {hourlyPlans.map((p) => (
                    <div
                      key={p.label}
                      className="rounded-xl p-3 border"
                      style={{
                        backgroundColor: 'var(--lp-bg)',
                        borderColor: 'var(--lp-border)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="text-sm font-bold flex items-center gap-2"
                          style={{ color: 'var(--lp-text)' }}
                        >
                          {p.label}
                        </span>
                        <div className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <span
                              className="text-xs font-bold"
                              style={{ color: 'var(--lp-text)' }}
                            >
                              Day
                            </span>
                            <span
                              className="text-base font-black"
                              style={{ color: 'var(--lp-text)' }}
                            >
                              {p.dayRate}
                              <span
                                className="text-xs font-bold ml-1"
                                style={{ color: 'var(--lp-text-muted)' }}
                              >
                                VND/block
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 justify-end mt-1">
                            <span
                              className="text-xs font-bold"
                              style={{ color: 'var(--lp-text)' }}
                            >
                              Night
                            </span>
                            <span
                              className="text-base font-black"
                              style={{ color: 'var(--lp-text)' }}
                            >
                              {p.nightRate}
                              <span
                                className="text-xs font-bold ml-1"
                                style={{ color: 'var(--lp-text-muted)' }}
                              >
                                VND/block
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monthly */}
              <div
                className="rounded-2xl border p-6 flex flex-col justify-between"
                style={{
                  backgroundColor: 'var(--lp-surface)',
                  borderColor: 'var(--lp-border)',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p
                      className="text-xs font-black tracking-widest uppercase font-mono mb-1"
                      style={{ color: '#FF4C4C' }}
                    >
                      Monthly Pass Guest
                    </p>
                    <h3
                      className="text-lg font-extrabold"
                      style={{ color: 'var(--lp-text)' }}
                    >
                      All-inclusive Subscription
                    </h3>
                  </div>
                  {/* <span className="text-2xl">🎫</span> */}
                </div>

                <div className="space-y-3 mb-4">
                  {monthlyPlans.map((p) => (
                    <div
                      key={p.label}
                      className="rounded-xl p-3 border"
                      style={{
                        backgroundColor: 'var(--lp-bg)',
                        borderColor: 'var(--lp-border)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="text-sm font-bold"
                          style={{ color: 'var(--lp-text)' }}
                        >
                          {p.label}
                        </span>
                        <span
                          className="text-base font-black"
                          style={{ color: 'var(--lp-text)' }}
                        >
                          {p.price}
                          <span
                            className="text-xs font-bold ml-1"
                            style={{ color: 'var(--lp-text-muted)' }}
                          >
                            VND/{p.unit}
                          </span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Monthly benefits */}
                <ul className="space-y-1.5">
                  {[
                    'Unlimited entry and exit',
                    'Auto license plate recognition & gate opening',
                    'Pay once, use all month',
                  ].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs" style={{ color: 'var(--lp-text-muted)' }}>
                      <CheckCircle2 size={13} style={{ color: '#FF4C4C', flexShrink: 0 }} />
                      {b}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => navigate('/monthly-pass')}
                  className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all hover:opacity-90 hover:scale-[1.02]"
                  style={{ backgroundColor: '#FF4C4C', color: '#fff' }}
                >
                  Register Now
                </button>
              </div>
            </div>

            {/* Pricing Rules */}
            <div
              className="rounded-2xl border p-4"
              style={{
                backgroundColor: 'var(--lp-surface)',
                borderColor: 'var(--lp-card-border)',
              }}
            >
              <p
                className="text-xs font-black tracking-widest uppercase font-mono mb-3 text-center"
                style={{ color: 'var(--lp-text-muted)' }}
              >
                Pricing Rules
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PRICING_RULES.map(({ icon: Icon, color, title, desc }) => (
                  <div
                    key={title}
                    className="rounded-xl p-3 border"
                    style={{
                      backgroundColor: 'var(--lp-bg)',
                      borderColor: 'var(--lp-border)',
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center mb-2"
                      style={{ backgroundColor: `${color}18`, color }}
                    >
                      <Icon size={14} />
                    </div>
                    <p
                      className="text-xs font-bold mb-1 leading-tight"
                      style={{ color: 'var(--lp-text)' }}
                    >
                      {title}
                    </p>
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{ color: 'var(--lp-text-muted)' }}
                    >
                      {desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scroll hint */}
          <button
            onClick={() => scrollTo(3)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 opacity-30 hover:opacity-70 transition-opacity"
          >
            <ChevronDown size={20} style={{ color: 'var(--lp-text)' }} className="animate-bounce" />
          </button>
        </section>

        {/* ─── SECTION 4: CTA + FOOTER ─────────────────────────── */}
        <section
          ref={setRef(3)}
          className="relative flex flex-col"
          style={{
            height: '100%',
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
            backgroundColor: 'var(--lp-footer-bg)',
          }}
        >
          {/* CTA */}
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
            {/* Background glow */}
            <div
              className="absolute w-[500px] h-[500px] rounded-full blur-[150px] opacity-[0.06] pointer-events-none"
              style={{ backgroundColor: '#FF4C4C' }}
            />

            <div className="relative z-10 max-w-2xl">
              <span
                className="text-xs font-black tracking-[0.2em] uppercase font-mono"
                style={{ color: '#FF4C4C' }}
              >
                Get Started Today
              </span>
              <h2
                className="text-4xl md:text-6xl font-black tracking-tight mt-3 mb-4 leading-tight"
                style={{ color: 'var(--lp-text)' }}
              >
                Ready for a touchless{' '}
                <span style={{ color: '#FF4C4C' }}>parking experience?</span>
              </h2>
              <p
                className="text-sm md:text-base leading-relaxed mb-8 max-w-md mx-auto"
                style={{ color: 'var(--lp-text-muted)' }}
              >
                Join thousands of users enjoying a smart, fast, and transparent parking experience.
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => navigate('/find-parking')}
                  className="flex items-center gap-2 font-bold px-8 py-4 rounded-full text-sm uppercase tracking-widest transition-all duration-300 shadow-lg hover:shadow-[#FF4C4C]/30 hover:scale-105"
                  style={{ backgroundColor: '#FF4C4C', color: '#fff' }}
                >
                  Find Parking Spot
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => navigate('/monthly-pass')}
                  className="font-bold px-8 py-4 rounded-full text-sm uppercase tracking-widest border-2 transition-all duration-300"
                  style={{
                    borderColor: 'var(--lp-border)',
                    color: 'var(--lp-text-muted)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#FF4C4C';
                    (e.currentTarget as HTMLButtonElement).style.color = '#FF4C4C';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--lp-border)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--lp-text-muted)';
                  }}
                >
                  Register Monthly Pass
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer
            className="border-t py-8 px-6"
            style={{ borderColor: 'var(--lp-border)', color: 'var(--lp-text-muted)' }}
          >
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                {/* Brand */}
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                    style={{ backgroundColor: '#FF4C4C' }}
                  >
                    P
                  </div>
                  <span className="font-extrabold tracking-tight" style={{ color: 'var(--lp-text)' }}>
                    Parking<span style={{ color: '#FF4C4C' }}>.</span>
                  </span>
                </div>

                {/* Links */}
                <div className="flex flex-wrap justify-center gap-6 text-xs font-bold">
                  <span
                    onClick={() => navigate('/find-parking')}
                    className="hover:text-[#FF4C4C] transition-colors cursor-pointer"
                  >
                    Find Parking
                  </span>
                  <span
                    onClick={() => navigate('/monthly-pass')}
                    className="hover:text-[#FF4C4C] transition-colors cursor-pointer"
                  >
                    Monthly Pass
                  </span>
                  <span
                    onClick={() => navigate('/my-tickets')}
                    className="hover:text-[#FF4C4C] transition-colors cursor-pointer"
                  >
                    My Tickets
                  </span>
                  <span className="opacity-50 cursor-not-allowed">Privacy Policy</span>
                  <span className="opacity-50 cursor-not-allowed">Terms of Service</span>
                </div>

                {/* Copyright */}
                <p className="text-[11px] font-semibold opacity-50 text-center md:text-right">
                  © 2026 Parking Building. All rights reserved.
                </p>
              </div>
            </div>
          </footer>
        </section>
      </div>

      {/* Dot Navigation */}
      <DotNav active={activeSection} total={TOTAL} onDot={scrollTo} />

      {/* Floating session banner for logged-in users */}
      {token && user && <FloatingSessionBanner />}
    </>
  );
}
