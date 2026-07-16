import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Navigation, ArrowRight } from 'lucide-react';

export default function CheckoutSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId') || '';

  // Optionally auto redirect after some seconds, or just let user click
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/');
    }, 10000); // 10 seconds auto return to home
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0A0A0C] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background flare */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
        <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(16,185,129,0.3)] border border-emerald-500/30 relative">
          <div className="absolute inset-0 bg-emerald-400/20 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
          <CheckCircle2 className="w-12 h-12 text-emerald-400 relative z-10" />
        </div>
        
        <h1 className="text-3xl font-extrabold text-white text-center mb-3">
          Checkout Successful!
        </h1>
        <p className="text-stone-400 text-center text-sm mb-8 leading-relaxed max-w-[280px]">
          Your payment has been confirmed and the barrier is now open. Thank you for parking with us!
        </p>

        {sessionId && (
          <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center mb-8 backdrop-blur-sm">
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mb-1">Session ID</span>
            <span className="text-sm font-mono font-bold text-stone-300">{sessionId.slice(0, 8).toUpperCase()}</span>
          </div>
        )}

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-full h-12 rounded-xl bg-white text-black font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
          >
            <Navigation className="w-4 h-4" />
            Return to Home
          </button>
          <button
            onClick={() => navigate('/my-tickets')}
            className="w-full h-12 rounded-xl bg-transparent text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-colors border border-white/10"
          >
            View Parking History
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
