import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Navigation, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export interface MyActiveSession {
  id: string;
  sessionCode: string;
  licensePlate: string;
  vehicleTypeName: string;
  entryTime: string;
  buildingName: string;
  floorName: string;
  slotNumber: string;
  pricePerHour: number;
  currentFee: number;
  sessionQrCodeBase64?: string;
}

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
        /*
        const res = await fetch('http://localhost:5000/api/UserSessions/my-active', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setActiveSession(data);
        }
        */
        
        // --- MOCK DATA cho Frontend Demo ---
        const mockData: MyActiveSession = {
          id: '123',
          sessionCode: 'AB12C',
          licensePlate: '51A-123.45',
          vehicleTypeName: 'Ô tô 4 chỗ',
          entryTime: new Date(Date.now() - 3600000 - 15000).toISOString(), // 1 hour 15 seconds ago
          buildingName: 'ParkSmart Building',
          floorName: 'B1',
          slotNumber: 'A-01',
          pricePerHour: 20000,
          currentFee: 20000
        };
        setActiveSession(mockData);
        // -----------------------------------
      } catch (err) {
        console.error('Failed to fetch active session', err);
      }
    };

    fetchActiveSession();
    // In production, you might want to poll this every 1-5 minutes
    // const intervalId = setInterval(fetchActiveSession, 60000);
    // return () => clearInterval(intervalId);
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
