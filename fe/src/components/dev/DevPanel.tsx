import { useState } from 'react';
import { Zap, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { devFastForwardTime, devResetTime } from '../../services/sessionsService';

interface DevPanelProps {
  onActionSuccess?: () => void;
}

export default function DevPanel({ onActionSuccess }: DevPanelProps = {}) {
  const { token } = useAuth();
  const [isDevMenuOpen, setIsDevMenuOpen] = useState(false);

  const handleDevFastForward = async (minutes: number) => {
    if (!token) return;
    try {
      await devFastForwardTime(minutes, token);
      if (onActionSuccess) onActionSuccess();
      else window.location.reload();
    } catch (err: any) {
      alert('Lỗi tua thời gian: ' + err.message);
    }
  };

  const handleDevReset = async () => {
    if (!token) return;
    try {
      await devResetTime(token);
      if (onActionSuccess) onActionSuccess();
      else window.location.reload();
    } catch (err: any) {
      alert('Lỗi khôi phục thời gian: ' + err.message);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {isDevMenuOpen && (
        <div className="w-[340px] bg-[#171923] rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden font-sans text-white mb-2">
          <div className="flex items-center justify-between px-4 py-3 bg-[#8b5cf6]">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Zap size={16} /> Dev Tools
            </div>
            <div className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded border border-white/30 uppercase tracking-widest">
              Dev Only
            </div>
          </div>
          
          <div className="bg-[#1e293b] border-b border-slate-700/50 flex text-xs font-bold">
            <div className="flex-1 text-center py-2.5 text-[#a78bfa] border-b-2 border-[#a78bfa] flex items-center justify-center gap-1.5 bg-[#8b5cf6]/10">
                ⏱️ Fast Forward
            </div>
          </div>

          <div className="p-5 flex flex-col gap-4">
            <div className="text-slate-400 text-xs text-center leading-relaxed">
                Simulate time passing to test Overtime logic in Session Page.
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button 
                  className="bg-[#fef3c7] text-[#92400e] text-xs font-bold py-2 rounded-lg hover:brightness-95 transition-all active:scale-95"
                  onClick={() => handleDevFastForward(1)}
                >+ 1 Phút</button>
                <button 
                  className="bg-[#f1f5f9] text-[#334155] text-xs font-bold py-2 rounded-lg hover:brightness-95 transition-all active:scale-95"
                  onClick={() => handleDevFastForward(15)}
                >+ 15 Phút</button>
                <button 
                  className="bg-[#e0f2fe] text-[#0369a1] text-xs font-bold py-2 rounded-lg hover:brightness-95 transition-all active:scale-95"
                  onClick={() => handleDevFastForward(60)}
                >+ 1 Giờ</button>
                <button 
                  className="bg-[#fee2e2] text-[#b91c1c] text-xs font-bold py-2 rounded-lg hover:brightness-95 transition-all active:scale-95"
                  onClick={() => handleDevFastForward(240)}
                >+ 4 Giờ</button>
            </div>
            <button 
                className="w-full mt-2 bg-[#f87171] hover:bg-[#ef4444] text-white font-bold py-3 rounded-lg transition-all active:scale-95 shadow-lg shadow-red-500/20"
                onClick={handleDevReset}
            >Reset Time to Now</button>
          </div>

          <div className="bg-[#0f111a] p-2 flex gap-2 border-t border-slate-700/50">
            <button className="flex-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-700/50" onClick={() => window.location.reload()}>
                🔄 Refresh
            </button>
            <button className="flex-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-700/50" onClick={() => { localStorage.clear(); window.location.href = '/login'; }}>
                🗑️ Clear localStorage
            </button>
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsDevMenuOpen(!isDevMenuOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95 ${isDevMenuOpen ? 'bg-red-500 shadow-red-500/30' : 'bg-[#8b5cf6] shadow-[#8b5cf6]/40'}`}
      >
        {isDevMenuOpen ? <X size={24} className="text-white" /> : <Zap size={24} className="text-white" />}
      </button>
    </div>
  );
}
