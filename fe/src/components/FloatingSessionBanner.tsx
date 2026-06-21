import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Navigation, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getMyActiveSession } from '../services/sessionsService';
import type { MyActiveSessionResponse } from '../services/sessionsService';

export type MyActiveSession = MyActiveSessionResponse;

export default function FloatingSessionBanner() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState<MyActiveSession | null>(null);
  const [elapsedString, setElapsedString] = useState('00:00:00');
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!user || !token) return;

    // Simulate an API call to the backend contract /api/UserSessions/my-active
    // Once the backend implements the API, replace this with a real fetch
    const fetchActiveSession = async () => {
      try {
        const data = await getMyActiveSession(token);
        if (data) {
          setActiveSession(data);
        } else {
          setActiveSession(null);
        }
      } catch (err) {
        console.error('Failed to fetch active session', err);
      }
    };

    fetchActiveSession();
    const intervalId = setInterval(fetchActiveSession, 60000);
    return () => clearInterval(intervalId);
  }, [user, token]);

  // Timer effect to update elapsed time every second
  useEffect(() => {
    if (!activeSession) return;

    const entryTime = new Date(activeSession.entryTime).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diffMs = Math.max(0, now - entryTime);

      const totalSeconds = Math.floor(diffMs / 1000);
      const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
      const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
      const s = (totalSeconds % 60).toString().padStart(2, '0');

      setElapsedString(`${h}:${m}:${s}`);
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);
  }, [activeSession]);

  if (!activeSession) return null;

  return (
    <div className="fixed top-24 right-0 z-[100] transition-all duration-300 flex items-center">
      {isCollapsed ? (
        <button 
          onClick={() => setIsCollapsed(false)} 
          className="bg-[#2B52FF] text-white py-3 pl-3 pr-4 rounded-l-full shadow-xl shadow-[#2B52FF]/20 flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <ChevronLeft size={16} />
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <Clock size={12} className="text-white" />
          </div>
          <span className="font-mono font-bold text-sm tracking-widest">{elapsedString}</span>
        </button>
      ) : (
        <div className="relative mr-6">
          <button
            onClick={(e) => { e.stopPropagation(); setIsCollapsed(true); }}
            className="absolute -left-3 -top-3 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center text-slate-500 hover:text-[#2B52FF] border border-slate-100 z-10 transition-colors"
          >
            <ChevronRight size={16} />
          </button>

          <div 
            onClick={() => navigate('/live-session')}
            className="bg-[#2B52FF] text-white rounded-2xl p-4 shadow-xl shadow-[#2B52FF]/30 cursor-pointer hover:scale-[1.02] transition-transform flex items-center justify-between min-w-[260px] gap-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                <Clock size={20} className="text-white" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-white/80 uppercase tracking-wider mb-0.5">
                  Đang đỗ xe
                </div>
                <div className="font-bold font-mono tracking-widest text-sm">
                  {elapsedString}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <div className="text-xs font-medium text-white/90 mb-1">
                {activeSession.licensePlate}
              </div>
              <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider bg-white/15 px-2 py-0.5 rounded-lg">
                <Navigation size={10} className="text-[#FFD700]" />
                {activeSession.floorName}-{activeSession.slotNumber}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
