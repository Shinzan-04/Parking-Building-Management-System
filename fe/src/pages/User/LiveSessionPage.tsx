import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car, MapPin, Clock, CreditCard, AlertTriangle,
  ChevronLeft, Navigation, Flag
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getMyActiveSession } from '../../services/sessionsService';
import type { MyActiveSessionResponse } from '../../services/sessionsService';

export default function LiveSessionPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [session, setSession] = useState<MyActiveSessionResponse | null>(null);
  const [elapsedString, setElapsedString] = useState('00:00:00');
  const [dynamicFee, setDynamicFee] = useState(0);

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

  // Timer & Fee Calculator
  useEffect(() => {
    if (!session) return;

    const entryTime = new Date(session.entryTime).getTime();

    const updateTimeAndFee = () => {
      const now = new Date().getTime();
      const diffMs = Math.max(0, now - entryTime);

      // Time formatting
      const totalSeconds = Math.floor(diffMs / 1000);
      const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
      const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
      const s = (totalSeconds % 60).toString().padStart(2, '0');
      setElapsedString(`${h}:${m}:${s}`);

      // Dynamic fee calculation (simplified: rounded up to nearest hour)
      const hours = Math.ceil(diffMs / (1000 * 60 * 60));
      const newFee = Math.max(1, hours) * session.pricePerHour;
      setDynamicFee(newFee);
    };

    updateTimeAndFee();
    const interval = setInterval(updateTimeAndFee, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const handlePayment = () => {
    alert(`Đang tiến hành thanh toán ${dynamicFee.toLocaleString('vi-VN')} đ`);
    // navigate to payment gateway or handle checkout
  };

  const handleReport = () => {
    alert('Mở form báo cáo sự cố (Sẽ tích hợp sau)');
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
    <div className="min-h-screen bg-[#F4F7F9] text-slate-800 font-sans pb-10">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center shadow-sm sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-8">Phiên đỗ xe</h1>
      </div>

      <div className="max-w-md mx-auto px-4 mt-6 space-y-4">

        {/* QR Code Block */}
        <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-col items-center">
          <div className="w-48 h-48 bg-white border border-slate-200 rounded-xl flex items-center justify-center mb-4">
            {session.sessionQrCodeBase64 ? (
              <img src={`data:image/png;base64,${session.sessionQrCodeBase64}`} alt="QR Code" className="w-full h-full object-contain" />
            ) : (
              <div className="relative grid grid-cols-5 grid-rows-5 gap-1 p-2 w-40 h-40">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div key={i} className={`bg-slate-900 rounded-sm ${Math.random() > 0.5 ? 'opacity-100' : 'opacity-0'}`}></div>
                ))}
                <div className="absolute inset-0 m-auto w-12 h-12 bg-white border-4 border-slate-900 flex items-center justify-center">
                  <div className="w-4 h-4 bg-[#2B52FF]"></div>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium text-center">
            Quét mã tại cổng ra để thanh toán
          </p>
        </div>

        {/* License Plate */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#EEF2FF] flex items-center justify-center text-[#2B52FF]">
            <Car size={24} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 tracking-wider">Biển số xe</div>
            <div className="text-lg font-bold text-slate-800">{session.licensePlate}</div>
            <div className="text-xs text-slate-500 font-medium">{session.vehicleTypeName}</div>
          </div>
        </div>

        {/* Time & Fee Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-[#2B52FF] mb-2">
              <Clock size={16} />
              <span className="text-[10px] uppercase font-bold tracking-wider">Thời gian đỗ</span>
            </div>
            <div className="text-2xl font-black font-mono tracking-wider">{elapsedString}</div>
            <div className="text-[10px] text-slate-400 mt-1 uppercase">HH:MM:SS</div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-emerald-500 mb-2">
              <CreditCard size={16} />
              <span className="text-[10px] uppercase font-bold tracking-wider">Phí hiện tại</span>
            </div>
            <div className="text-2xl font-black">{dynamicFee.toLocaleString('vi-VN')} <span className="text-lg">đ</span></div>
            <div className="text-[10px] text-slate-400 mt-1">{session.pricePerHour.toLocaleString('vi-VN')} đ/giờ</div>
          </div>
        </div>

        {/* Location Block */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
              <MapPin size={20} />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Vị trí đỗ xe</div>
              <div className="text-base font-bold text-slate-800">
                {session.floorName} — Ô {session.slotNumber}
              </div>
            </div>
          </div>
          <button className="w-full py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center gap-2 transition-colors">
            <Navigation size={14} />
            Tìm Xe Của Tôi
          </button>
        </div>

        {/* Session Details */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Chi Tiết Phiên Đỗ</h3>
          </div>
          <div className="p-4 grid grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <div className="text-[10px] uppercase font-bold text-[#2B52FF] mb-1">Giờ vào</div>
              <div className="text-xs font-bold text-slate-800">{formattedEntryDate}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[#2B52FF] mb-1">Khu vực</div>
              <div className="text-xs font-bold text-slate-800">{session.buildingName}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[#2B52FF] mb-1">Loại phương tiện</div>
              <div className="text-xs font-bold text-slate-800">{session.vehicleTypeName}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[#2B52FF] mb-1">Ô đỗ</div>
              <div className="text-xs font-bold text-[#2B52FF]">{session.slotNumber}</div>
            </div>
          </div>
          <div className="p-4 bg-slate-50 flex justify-between items-center border-t border-slate-100">
            <span className="text-xs text-slate-500 font-medium">Đơn giá áp dụng</span>
            <span className="text-sm font-bold text-[#2B52FF]">{session.pricePerHour.toLocaleString('vi-VN')} đ / giờ</span>
          </div>
        </div>

        {/* Important Note */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 flex gap-3">
          <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-1">Lưu Ý Quan Trọng</h4>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Giữ mã QR để xuất trình tại cổng ra. Thời gian đỗ tối đa 24 giờ. Phí được tính theo giờ thực tế với đơn giá <span className="font-bold text-slate-700">{session.pricePerHour.toLocaleString('vi-VN')} đ/giờ</span>.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-3">
          <button
            onClick={handlePayment}
            className="w-full bg-[#2B52FF] hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#2B52FF]/20 transition-colors flex justify-center items-center gap-2"
          >
            <CreditCard size={18} />
            Thanh Toán ({dynamicFee.toLocaleString('vi-VN')} đ)
          </button>
          <button
            onClick={handleReport}
            className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-4 rounded-2xl transition-colors flex justify-center items-center gap-2"
          >
            <Flag size={18} />
            Báo Cáo Sự Cố
          </button>
        </div>

      </div>
    </div>
  );
}
