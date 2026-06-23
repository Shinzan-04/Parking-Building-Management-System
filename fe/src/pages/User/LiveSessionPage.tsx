import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car, MapPin, Clock, CreditCard, AlertTriangle,
  ChevronLeft, Navigation, Flag, FastForward, RotateCcw
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getMyActiveSession, devFastForwardTime, devResetTime } from '../../services/sessionsService';
import type { MyActiveSessionResponse } from '../../services/sessionsService';

export default function LiveSessionPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [session, setSession] = useState<MyActiveSessionResponse | null>(null);
  const [elapsedString, setElapsedString] = useState('00:00:00');
  const [dynamicFee, setDynamicFee] = useState(0);
  const [isDevMenuOpen, setIsDevMenuOpen] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchSession = async () => {
      try {
        const data = await getMyActiveSession(token);
        if (data) {
          setSession(data);
          setDynamicFee(data.currentFee);
        } else {
          // If no active session, redirect back
          navigate(-1);
        }
      } catch (err) {
        console.error('Failed to load active session', err);
      }
    };

    fetchSession();
  }, [token, navigate]);

  // Timer & API Polling
  useEffect(() => {
    if (!session) return;

    const entryTime = new Date(session.entryTime).getTime();

    // Cập nhật đồng hồ mỗi giây
    const updateTime = () => {
      const now = new Date().getTime();
      const diffMs = Math.max(0, now - entryTime);

      const totalSeconds = Math.floor(diffMs / 1000);
      const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
      const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
      const s = (totalSeconds % 60).toString().padStart(2, '0');
      setElapsedString(`${h}:${m}:${s}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    // Poll backend mỗi 60 giây để cập nhật lại fee chính xác từ hệ thống
    const fetchSessionFee = async () => {
      if (!token) return;
      try {
        const data = await getMyActiveSession(token);
        if (data) {
          setDynamicFee(data.currentFee);
        }
      } catch (err) {
        console.error('Lỗi khi lấy fee:', err);
      }
    };
    const feeInterval = setInterval(fetchSessionFee, 60000);

    return () => {
      clearInterval(interval);
      clearInterval(feeInterval);
    };
  }, [session?.entryTime, token]);

  const handlePayment = () => {
    alert(`Đang tiến hành thanh toán ${dynamicFee.toLocaleString('vi-VN')} đ`);
    // navigate to payment gateway or handle checkout
  };

  const handleReport = () => {
    alert('Mở form báo cáo sự cố (Sẽ tích hợp sau)');
  };

  const handleDevFastForward = async (minutes: number) => {
    if (!token || !session) return;
    try {
      await devFastForwardTime(minutes, token);
      const data = await getMyActiveSession(token);
      if (data) {
        setSession(data);
        setDynamicFee(data.currentFee);
      }
      alert(`Đã tua nhanh ${minutes} phút! Giờ vào và Giờ đặt trước đã bị lùi về ${minutes} phút trước. Phí đã được tính toán lại!`);
      setIsDevMenuOpen(false);
    } catch (err: any) {
      alert('Lỗi tua thời gian: ' + err.message);
    }
  };

  const handleDevReset = async () => {
    if (!token || !session) return;
    try {
      await devResetTime(token);
      const data = await getMyActiveSession(token);
      if (data) {
        setSession(data);
        setDynamicFee(data.currentFee);
      }
      alert('Đã khôi phục thời gian về hiện tại!');
      setIsDevMenuOpen(false);
    } catch (err: any) {
      alert('Lỗi khôi phục thời gian: ' + err.message);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#2B52FF] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Format Date for 'Giờ vào'
  const entryDate = new Date(session.entryTime);
  const formattedEntryDate = `${entryDate.toLocaleDateString('vi-VN')} ${entryDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-slate-800 font-sans pb-10 relative">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center shadow-sm sticky top-0 z-50 lg:px-8">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-8 lg:pr-0 lg:text-left lg:ml-4">Phiên đỗ xe hiện tại</h1>
        
        <div className="relative">
          <button 
            onClick={() => setIsDevMenuOpen(!isDevMenuOpen)} 
            className="flex items-center gap-2 bg-indigo-100 text-indigo-700 p-2 rounded-lg text-sm font-bold hover:bg-indigo-200 transition-colors"
            title="Dev Tools"
          >
            <FastForward size={18} />
          </button>
          
          {isDevMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsDevMenuOpen(false)}></div>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden py-2">
                <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 mb-1">DEV TOOLS</div>
                <button 
                  onClick={() => handleDevFastForward(15)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2"
                >
                  <FastForward size={14} className="text-indigo-400" />
                  Tua 15 phút
                </button>
                <button 
                  onClick={() => handleDevFastForward(240)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2"
                >
                  <FastForward size={14} className="text-indigo-400" />
                  Tua 4 tiếng
                </button>
                <div className="my-1 border-t border-slate-100"></div>
                <button 
                  onClick={handleDevReset}
                  className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2"
                >
                  <RotateCcw size={14} />
                  Reset về hiện tại
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Grid Container for Desktop */}
      <div className="max-w-6xl mx-auto px-4 mt-6 lg:mt-10 lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">

        {/* LEFT COLUMN: The "E-Ticket" (4 columns out of 12) */}
        <div className="lg:col-span-4 bg-gradient-to-br from-[#1A36A8] to-[#2B52FF] rounded-3xl p-8 shadow-2xl text-white relative overflow-hidden space-y-8 mb-6 lg:mb-0">
          {/* Glassmorphism Background Shapes */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            {/* QR Code Container */}
            <div className="bg-white p-4 rounded-3xl shadow-inner mb-6">
              {session.sessionQrCodeBase64 ? (
                <img src={`data:image/png;base64,${session.sessionQrCodeBase64}`} alt="QR Code" className="w-56 h-56 object-contain" />
              ) : (
                <div className="relative grid grid-cols-5 grid-rows-5 gap-1 p-2 w-56 h-56">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} className={`bg-slate-900 rounded-sm ${Math.random() > 0.5 ? 'opacity-100' : 'opacity-0'}`}></div>
                  ))}
                  <div className="absolute inset-0 m-auto w-16 h-16 bg-white border-4 border-slate-900 flex items-center justify-center">
                    <div className="w-6 h-6 bg-[#2B52FF]"></div>
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-xs text-white/80 font-bold text-center uppercase tracking-widest mb-8 bg-white/10 py-2 px-4 rounded-full">
              Mã quét tại cổng ra
            </p>

            <div className="w-full border-t border-white/20 pt-8">
              <div className="text-[10px] uppercase font-bold text-white/60 mb-2 tracking-wider text-center">Biển số xe</div>
              <div className="text-4xl font-black text-white text-center tracking-wider mb-3">{session.licensePlate}</div>
              <div className="flex items-center justify-center gap-2 bg-black/20 py-2 rounded-xl w-fit mx-auto px-4">
                <Car size={16} className="text-white/80" />
                <div className="text-sm text-white font-medium">{session.vehicleTypeName}</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Info & Actions (8 columns out of 12) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Top Level Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            {/* Time Card */}
            <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 flex flex-col justify-center transition-all hover:shadow-md">
              <div className="flex items-center gap-2 text-[#2B52FF] mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Clock size={20} />
                </div>
                <span className="text-xs uppercase font-bold tracking-widest">Thời gian đỗ</span>
              </div>
              <div className="text-5xl lg:text-6xl font-black font-mono tracking-wider text-slate-800">{elapsedString}</div>
              <div className="text-[10px] text-slate-400 mt-2 uppercase font-bold tracking-widest">Giờ : Phút : Giây</div>
            </div>

            {/* Fee Card */}
            <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 flex flex-col justify-center transition-all hover:shadow-md">
              <div className="flex items-center gap-2 text-emerald-500 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CreditCard size={20} />
                </div>
                <span className="text-xs uppercase font-bold tracking-widest">
                  {session.isPrepaid ? 'Phí quá hạn' : 'Phí hiện tại'}
                </span>
              </div>
              <div className="text-5xl lg:text-6xl font-black text-slate-800">
                {dynamicFee.toLocaleString('vi-VN')} <span className="text-2xl text-slate-400 font-bold">đ</span>
              </div>
              <div className="text-sm text-slate-400 mt-3 font-medium">
                Đơn giá: <span className="text-slate-600 font-bold">{session.pricePerHour.toLocaleString('vi-VN')} đ/giờ</span>
              </div>
            </div>
          </div>

          {/* Location & Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Location */}
            <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 flex flex-col h-full transition-all hover:shadow-md">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <MapPin size={18} className="text-orange-500" />
                Vị trí đỗ xe
              </h3>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl p-6 flex-1 flex flex-col items-center justify-center text-center border border-orange-100/50">
                <div className="text-sm uppercase font-bold text-orange-400 tracking-wider mb-2">{session.floorName}</div>
                <div className="text-5xl font-black text-orange-600 drop-shadow-sm">Ô {session.slotNumber}</div>
              </div>
            </div>

            {/* Session Details */}
            <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 h-full flex flex-col transition-all hover:shadow-md">
              <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Flag size={18} className="text-indigo-500" />
                Chi tiết phiên đỗ
              </h3>
              <div className="grid grid-cols-2 gap-y-8 gap-x-4 flex-1 content-start">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Giờ vào</div>
                  <div className="text-sm font-bold text-slate-800">{formattedEntryDate}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Khu vực</div>
                  <div className="text-sm font-bold text-slate-800">{session.buildingName}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Loại phương tiện</div>
                  <div className="text-sm font-bold text-slate-800">{session.vehicleTypeName}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Hình thức vào</div>
                  <div className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md inline-block">
                     {session.isPrepaid ? 'Khách Đặt Trước' : 'Khách Vãng Lai'}
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-slate-100 flex items-start gap-3 bg-orange-50/50 p-4 rounded-2xl">
                <AlertTriangle size={18} className="text-orange-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Giữ mã QR để xuất trình tại cổng ra. Phí được tính tự động theo thời gian thực hệ thống.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
            {(!session.isPrepaid || dynamicFee > 0) && (
              <button
                onClick={handlePayment}
                className="w-full sm:flex-1 bg-[#2B52FF] hover:bg-blue-700 text-white font-bold py-5 rounded-2xl shadow-xl shadow-[#2B52FF]/30 transition-all hover:-translate-y-1 flex justify-center items-center gap-3 text-lg border border-transparent"
              >
                <CreditCard size={22} />
                Thanh Toán ({dynamicFee.toLocaleString('vi-VN')} đ)
              </button>
            )}
            <button
              onClick={handleReport}
              className="w-full sm:flex-1 bg-white border-2 border-slate-100 hover:bg-slate-50 hover:border-slate-200 text-slate-600 font-bold py-5 rounded-2xl transition-all flex justify-center items-center gap-2 text-base"
            >
              <Flag size={20} />
              Báo Cáo Sự Cố
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
