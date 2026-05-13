import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  MapPin,
  CreditCard,
  BarChart3,
  TrendingUp,
  Shield,
  Leaf,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronRight,
  Radio,
  Zap,
} from 'lucide-react';

// ─── Data ────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#benefits', label: 'Benefits' },
  { href: '#testimonials', label: 'Testimonials' },
] as const;

const HERO_STATS = [
  { value: '99.9%', label: 'Accuracy' },
  { value: '2s', label: 'Avg. Entry Time' },
  { value: '500+', label: 'Installations' },
  { value: '24/7', label: 'Support' },
] as const;

const FEATURES = [
  {
    icon: Camera,
    title: 'AI License Plate Recognition',
    description: 'Instant vehicle identification with 99.9% accuracy using advanced computer vision.',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    icon: MapPin,
    title: 'Real-time Availability Map',
    description: 'Live occupancy tracking across all floors and zones with predictive analytics.',
    gradient: 'from-green-400 to-emerald-500',
  },
  {
    icon: CreditCard,
    title: 'Automated Payments & Billing',
    description: 'Seamless contactless payments with automatic barrier opening and receipt generation.',
    gradient: 'from-blue-500 to-purple-500',
  },
  {
    icon: BarChart3,
    title: 'Smart Analytics Dashboard',
    description: 'Comprehensive insights on revenue, occupancy patterns, and operational efficiency.',
    gradient: 'from-orange-500 to-red-500',
  },
] as const;

const JOURNEY_STEPS = [
  { icon: Camera,       title: 'Arrival',   description: 'Camera scans license plate' },
  { icon: Zap,          title: 'Scanning',  description: 'AI processes in real-time' },
  { icon: MapPin,       title: 'Parking',   description: 'Optimal slot assigned' },
  { icon: CreditCard,   title: 'Payment',   description: 'Automatic billing' },
  { icon: CheckCircle2, title: 'Departure', description: 'Barrier opens instantly' },
] as const;

const BENEFITS = [
  {
    icon: TrendingUp,
    title: 'Increase Revenue',
    value: '+40%',
    description: 'Average revenue boost through optimized pricing and reduced manual errors.',
    color: 'text-green-400',
  },
  {
    icon: Radio,
    title: 'Reduce Congestion',
    value: '-60%',
    description: 'Faster entry/exit times with automated gate systems and smart routing.',
    color: 'text-cyan-400',
  },
  {
    icon: Shield,
    title: 'Enhanced Security',
    value: '24/7',
    description: 'Continuous monitoring with AI-powered threat detection and access control.',
    color: 'text-blue-400',
  },
  {
    icon: Leaf,
    title: 'Eco-friendly Solutions',
    value: '-35%',
    description: 'Reduced carbon emissions through optimized traffic flow and EV support.',
    color: 'text-emerald-400',
  },
] as const;

const TESTIMONIALS = [
  {
    quote: 'SmartPark transformed our parking operations. Revenue increased by 45% in just 3 months.',
    author: 'Sarah Chen',
    role: 'Operations Director',
    company: 'MegaMall Group',
    avatar: 'SC',
  },
  {
    quote: 'The AI-powered analytics gave us insights we never had before. Game changer for our business.',
    author: 'James Rodriguez',
    role: 'Facility Manager',
    company: 'Downtown Plaza',
    avatar: 'JR',
  },
  {
    quote: 'Implementation was seamless. Our customers love the automated payment system.',
    author: 'Emily Tran',
    role: 'CEO',
    company: 'ParkTech Solutions',
    avatar: 'ET',
  },
] as const;

const PARTNERS = ['Viettel', 'VNPAY', 'Momo', 'VinGroup', 'FPT', 'Samsung'] as const;

const FOOTER_LINKS = {
  product: [
    { label: 'Features', href: '#' },
    { label: 'Pricing', href: '#' },
    { label: 'Case Studies', href: '#' },
    { label: 'API Docs', href: '#' },
  ],
  company: [
    { label: 'About Us', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Contact', href: '#' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Security', href: '#' },
    { label: 'GDPR', href: '#' },
  ],
} as const;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const journeyRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (journeyRef.current) {
        const rect = journeyRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const elementHeight = rect.height;
        const progress = Math.max(
          0,
          Math.min(1, (viewportHeight - rect.top) / (viewportHeight + elementHeight))
        );
        setScrollProgress(progress);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[#101A31] text-white overflow-x-hidden">

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#101A31]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4] rounded-lg">
                <Sparkles className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <span className="text-xl font-bold gradient-text">SmartPark</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href}
                  className="text-sm text-gray-300 hover:text-[#00C2FF] transition-colors">
                  {link.label}
                </a>
              ))}
              <Link to="/" className="text-sm text-gray-300 hover:text-white px-3 py-1.5 transition-colors">
                Customer Portal
              </Link>
              <Link to="/auth"
                className="px-4 py-2 rounded-lg text-sm font-semibold
                           bg-[#00D1FF]/20 hover:bg-[#00D1FF]/30 text-[#00D1FF]
                           border border-[#00D1FF]/50 hover:border-[#00D1FF]
                           shadow-lg shadow-[#00D1FF]/20 hover:shadow-[#00D1FF]/40
                           transition-all duration-200">
                Login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main id="main-content">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative pt-32 pb-20 overflow-hidden text-center">
          <div className="absolute inset-0 bg-gradient-to-br from-[#00C2FF]/10 via-transparent to-[#3BFFA4]/10 pointer-events-none" />
          <div className="blob top-20 right-10 w-72 h-72 bg-[#00C2FF]/20" />
          <div className="blob bottom-10 left-10 w-96 h-96 bg-[#3BFFA4]/20" />

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-1.5 px-4 py-2 mb-6
                            rounded-full bg-white/10 border border-white/20
                            backdrop-blur-sm text-sm font-medium">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              AI-Powered Parking Management
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6 tracking-tight">
              The Future of
              <span className="block gradient-text">Smart Parking</span>
            </h1>

            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Transform your parking facility with AI-driven automation, real-time analytics,
              and seamless customer experiences.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <button type="button"
                className="flex items-center gap-2 px-8 py-3 rounded-lg font-semibold text-base
                           bg-gradient-to-r from-[#00C2FF] to-[#3BFFA4] text-white hover:opacity-90 transition-opacity">
                Get Started
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </button>
              <button type="button"
                className="px-8 py-3 rounded-lg font-semibold text-base
                           border border-white/20 text-white hover:bg-white/10 transition-colors">
                Watch Demo
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {HERO_STATS.map((stat) => (
                <div key={stat.label}
                  className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
                  <p className="text-3xl font-bold gradient-text">{stat.value}</p>
                  <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <section id="features" className="py-20 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">
                Powerful <span className="gradient-text">Features</span>
              </h2>
              <p className="text-gray-400 text-lg">Built for modern parking operations</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title}
                    className="group relative p-8 rounded-3xl glass-card
                               hover:border-white/30 hover:scale-[1.02] transition-all duration-300">
                    <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${feature.gradient} mb-4`}>
                      <Icon className="w-6 h-6 text-white" aria-hidden="true" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                    <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                    <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100
                                    bg-gradient-to-br from-[#00C2FF]/5 to-[#3BFFA4]/5
                                    transition-opacity duration-300 pointer-events-none" />
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Journey (Scrollytelling) ───────────────────────────────────────── */}
        <section ref={journeyRef} className="py-32 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">
                How It <span className="gradient-text">Works</span>
              </h2>
              <p className="text-gray-400 text-lg">A seamless journey from arrival to departure</p>
            </div>

            <div className="relative">
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/10 hidden md:block -translate-x-1/2" />
              <div
                className="absolute left-1/2 top-0 w-0.5 hidden md:block -translate-x-1/2
                           bg-gradient-to-b from-[#00C2FF] to-[#3BFFA4] transition-all duration-300"
                style={{ height: `${scrollProgress * 100}%` }}
              />

              <ol className="space-y-12">
                {JOURNEY_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const stepProgress = Math.max(0, Math.min(1, scrollProgress * 5 - index));
                  const isEven = index % 2 === 0;

                  return (
                    <li key={step.title}
                      className={`relative flex items-center gap-8 ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'}`}
                      style={{
                        opacity: stepProgress,
                        transform: `translateY(${(1 - stepProgress) * 50}px)`,
                        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
                      }}>
                      <div className={`flex-1 ${isEven ? 'md:text-right' : 'md:text-left'}`}>
                        <div className="inline-block p-6 rounded-3xl glass-card">
                          <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
                          <p className="text-gray-400">{step.description}</p>
                        </div>
                      </div>

                      <div className="relative z-10 flex-shrink-0">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4]
                                        flex items-center justify-center shadow-lg shadow-[#00C2FF]/40">
                          <Icon className="w-8 h-8 text-white" aria-hidden="true" />
                        </div>
                      </div>

                      <div className="flex-1 hidden md:block" />
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>

        {/* ── Benefits ──────────────────────────────────────────────────────── */}
        <section id="benefits" className="py-20 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">
                Why Choose <span className="gradient-text">SmartPark</span>
              </h2>
              <p className="text-gray-400 text-lg">Measurable impact on your business</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {BENEFITS.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <article key={benefit.title}
                    className="p-6 rounded-3xl glass-card hover:border-white/30 hover:scale-105 transition-all duration-300">
                    <Icon className={`w-10 h-10 mb-4 ${benefit.color}`} aria-hidden="true" />
                    <p className={`text-4xl font-bold mb-2 ${benefit.color}`}>{benefit.value}</p>
                    <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{benefit.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Testimonials ──────────────────────────────────────────────────── */}
        <section id="testimonials" className="py-20 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">
                Trusted by <span className="gradient-text">Industry Leaders</span>
              </h2>
              <p className="text-gray-400 text-lg">See what our customers say</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              {TESTIMONIALS.map((t) => (
                <figure key={t.author}
                  className="p-6 rounded-3xl glass-card hover:border-white/30 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4]
                                    flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {t.avatar}
                    </div>
                    <figcaption>
                      <p className="font-bold">{t.author}</p>
                      <p className="text-sm text-gray-400">{t.role}</p>
                    </figcaption>
                  </div>
                  <blockquote className="text-gray-300 mb-3 leading-relaxed">"{t.quote}"</blockquote>
                  <p className="text-sm text-[#00C2FF]">{t.company}</p>
                </figure>
              ))}
            </div>

            <div className="text-center">
              <p className="text-gray-400 text-sm mb-6">Trusted by leading organizations</p>
              <ul className="flex flex-wrap items-center justify-center gap-4">
                {PARTNERS.map((partner) => (
                  <li key={partner}
                    className="px-6 py-3 rounded-xl glass-card text-gray-400 font-semibold text-sm
                               hover:border-[#00C2FF]/40 hover:text-[#00C2FF] transition-all duration-200">
                    {partner}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section className="py-32 relative overflow-hidden text-center">
          <div className="absolute inset-0 bg-gradient-to-br from-[#00C2FF]/20 via-transparent to-[#3BFFA4]/20 pointer-events-none" />
          <div className="blob top-0 right-0 w-96 h-96 bg-[#00C2FF]/25" />
          <div className="blob bottom-0 left-0 w-96 h-96 bg-[#3BFFA4]/25" />

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight tracking-tight">
              Ready to Transform Your
              <span className="block gradient-text">Parking Operations?</span>
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Join 500+ facilities worldwide using SmartPark to increase revenue and customer satisfaction.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button type="button"
                className="flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-lg
                           bg-gradient-to-r from-[#00C2FF] to-[#3BFFA4] text-white hover:opacity-90 transition-opacity">
                Request a Demo
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
              <button type="button"
                className="px-8 py-4 rounded-lg font-semibold text-lg
                           border border-white/20 text-white hover:bg-white/10 transition-colors">
                Talk to Sales
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4] rounded-lg">
                  <Sparkles className="w-5 h-5 text-white" aria-hidden="true" />
                </div>
                <span className="text-xl font-bold">SmartPark</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                The future of intelligent parking management powered by AI.
              </p>
            </div>

            <nav aria-label="Product links">
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                {FOOTER_LINKS.product.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-gray-400 hover:text-[#00C2FF] transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Company links">
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                {FOOTER_LINKS.company.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-gray-400 hover:text-[#00C2FF] transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Legal links">
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                {FOOTER_LINKS.legal.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-gray-400 hover:text-[#00C2FF] transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="pt-8 border-t border-white/10 text-center text-sm text-gray-400">
            © {currentYear} SmartPark. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}
