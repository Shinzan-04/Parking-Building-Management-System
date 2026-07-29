import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Navigation, ChevronRight, ChevronLeft, Car } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import * as signalR from '@microsoft/signalr';
import { getMyActiveSession } from '../services/sessionsService';
import type { MyActiveSessionResponse } from '../services/sessionsService';

export type MyActiveSession = MyActiveSessionResponse;

export default function FloatingSessionBanner() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [activeSessions, setActiveSessions] = useState<MyActiveSession[]>([]);
  const [now, setNow] = useState(new Date().getTime());
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!user || !token) return;

    const fetchActiveSessions = async () => {
      try {
        const data = await getMyActiveSession();
        if (data && data.length > 0) {
          setActiveSessions(data);
          if (data.length > 1) setIsCollapsed(true);
        } else {
          setActiveSessions([]);
        }
      } catch (err) {
        console.error('Failed to fetch active sessions', err);
      }
    };

    fetchActiveSessions();
    const intervalId = setInterval(fetchActiveSessions, 60000);

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_URL || 'http://localhost:5237'}/parking-hub`, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on("ReceiveNotification", (message: string) => {
      if (message === "SESSION_STARTED" || message === "SESSION_COMPLETED") {
        fetchActiveSessions();
        if (message === "SESSION_STARTED") {
          setIsCollapsed(false);
        }
      }
    });

    connection.on("ReceiveCheckoutSuccess", (sessionId: string) => {
      navigate(`/checkout-success?sessionId=${sessionId}`);
    });

    connection.start().catch(() => { /* ignore */ });

    return () => {
      clearInterval(intervalId);
      connection.stop();
    };
  }, [user, token, navigate]);

  // Update timer once per second for all banners
  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date().getTime()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  if (activeSessions.length === 0) return null;

  return (
    <div className="fixed top-24 right-0 z-[100] flex flex-col gap-4 items-end">
      
      {/* Master Collapsed Button (for multiple sessions) */}
      <button 
        onClick={() => setIsCollapsed(false)}
        className={`absolute right-0 top-0 bg-[#2B52FF] text-white py-3 pl-3 pr-4 rounded-l-full shadow-xl shadow-[#2B52FF]/20 flex items-center gap-3 hover:bg-blue-700 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-30 ${
          isCollapsed && activeSessions.length > 1 ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0 pointer-events-none'
        }`}
      >
        <ChevronLeft size={16} />
        <div className="flex -space-x-2">
           <div className="w-7 h-7 rounded-full bg-white/20 border-2 border-[#2B52FF] flex items-center justify-center">
              <Car size={12} className="text-white" />
           </div>
           <div className="w-7 h-7 rounded-full bg-white border-2 border-[#2B52FF] flex items-center justify-center text-[#2B52FF] font-bold text-[10px]">
              {activeSessions.length}
           </div>
        </div>
        <span className="font-bold text-sm tracking-wide mr-1 uppercase">Sessions</span>
      </button>

      <div className={`flex flex-col gap-4 transition-all duration-500 ${isCollapsed && activeSessions.length > 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {activeSessions.map((session, index) => {
          const entryTime = new Date(session.entryTime).getTime();
          const diffMs = Math.max(0, now - entryTime);
          const totalSeconds = Math.floor(diffMs / 1000);
          const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
          const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
          const s = (totalSeconds % 60).toString().padStart(2, '0');
          const elapsedString = `${h}:${m}:${s}`;

          const showIndividualCollapsedButton = activeSessions.length === 1;

          return (
            <div key={session.id} className="relative flex items-center justify-end min-h-[72px] w-full group overflow-visible">
              {/* The Collapsed Button (for single session) */}
              {showIndividualCollapsedButton && (
                <button 
                  onClick={() => setIsCollapsed(false)} 
                  className={`absolute right-0 bg-[#2B52FF] text-white py-3 pl-3 pr-4 rounded-l-full shadow-xl shadow-[#2B52FF]/20 flex items-center gap-2 hover:bg-blue-700 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-20 ${
                    isCollapsed ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0 pointer-events-none'
                  }`}
                >
                  <ChevronLeft size={16} />
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                    <Clock size={12} className="text-white" />
                  </div>
                  <span className="font-mono font-bold text-sm tracking-widest">{elapsedString}</span>
                </button>
              )}

              {/* The Full Banner */}
              <div 
                className={`relative mr-6 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-10 ${
                  isCollapsed ? 'translate-x-[120%] opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'
                }`}
              >
                {/* Only show collapse button on the first item to collapse all */}
                {index === 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsCollapsed(true); }}
                    className="absolute -left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center text-slate-500 hover:text-[#2B52FF] border border-slate-100 z-10 transition-transform hover:scale-110"
                  >
                    <ChevronRight size={16} />
                  </button>
                )}

                <div 
                  onClick={() => navigate(`/live-session?sessionId=${session.id}`)}
                  className="bg-[#2B52FF] text-white rounded-2xl p-4 shadow-xl shadow-[#2B52FF]/30 cursor-pointer hover:scale-[1.02] transition-transform flex items-center justify-between min-w-[260px] gap-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                      <Clock size={20} className="text-white" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-white/80 uppercase tracking-wider mb-0.5">
                        Currently Parked
                      </div>
                      <div className="font-bold font-mono tracking-widest text-sm">
                        {elapsedString}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <div className="text-xs font-medium text-white/90 mb-1">
                      {session.licensePlate}
                    </div>
                    <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider bg-white/15 px-2 py-0.5 rounded-lg">
                      <Navigation size={10} className="text-[#FFD700]" />
                      {session.floorName}-{session.slotNumber}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
