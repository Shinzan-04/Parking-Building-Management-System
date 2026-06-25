import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car, MapPin, Clock, CreditCard, AlertTriangle,
  ChevronLeft, Navigation, Flag, FastForward, RotateCcw
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getMyActiveSession, devFastForwardTime, devResetTime } from '../../services/sessionsService';
import type { MyActiveSessionResponse } from '../../services/sessionsService';
import DevPanel from '../../components/dev/DevPanel';

export default function LiveSessionPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [session, setSession] = useState<MyActiveSessionResponse | null>(null);
  const [elapsedString, setElapsedString] = useState('00:00:00');
  const [dynamicFee, setDynamicFee] = useState(0);

  const fetchSession = async () => {
    if (!token) return;
    try {
      const data = await getMyActiveSession(token);
      if (data) {
        setSession(data);
        setDynamicFee(data.currentFee);
      } else {
        navigate(-1);
      }
    } catch (err) {
      console.error('Failed to load active session', err);
    }
  };

  useEffect(() => {
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

  const entryDateStr = entryDate.toLocaleDateString('vi-VN');
  const entryTimeStr = entryDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  let bookedArrivalDateStr = '';
  let bookedArrivalTimeStr = '';
  let bookedExitDateStr = '';
  let bookedExitTimeStr = '';
  let checkInAllowedStr = '';

  if (session.isPrepaid && session.prepaidStartTime && session.prepaidEndTime) {
    const pStart = new Date(session.prepaidStartTime);
    bookedArrivalDateStr = pStart.toLocaleDateString('vi-VN');
    bookedArrivalTimeStr = pStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const pEnd = new Date(session.prepaidEndTime);
    bookedExitDateStr = pEnd.toLocaleDateString('vi-VN');
    bookedExitTimeStr = pEnd.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const allowedCheckIn = new Date(pStart.getTime() - 15 * 60000);
    checkInAllowedStr = allowedCheckIn.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="min-h-full bg-[#F4F7F9] text-slate-800 font-sans pb-10 relative">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center shadow-sm sticky top-0 z-50 lg:px-8">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-8 lg:pr-0 lg:text-left lg:ml-4">Phiên đỗ xe hiện tại</h1>
      </div>

      {/* Main Grid Container for Desktop */}
      <div className="max-w-6xl mx-auto px-4 mt-6 lg:mt-8 lg:grid lg:grid-cols-12 lg:gap-4 lg:items-stretch">

        {/* LEFT COLUMN: The "E-Ticket" (4 columns out of 12) */}
        <div className="lg:col-span-4 bg-gradient-to-br from-[#1A36A8] to-[#2B52FF] rounded-3xl p-5 shadow-2xl text-white relative overflow-hidden flex flex-col mb-6 lg:mb-0">
          {/* Glassmorphism Background Shapes */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

          <div className="relative z-10 flex flex-col items-center flex-1 w-full">
            <div className="w-full flex flex-col items-center justify-center pt-2">
              {/* QR Code Container */}
              <div className="bg-white p-3 rounded-3xl shadow-inner mb-4">
                {session.sessionQrCodeBase64 ? (
                  <img src={`data:image/png;base64,${session.sessionQrCodeBase64}`} alt="QR Code" className="w-44 h-44 object-contain" />
                ) : (
                  <div className="relative grid grid-cols-5 grid-rows-5 gap-1 p-2 w-44 h-44">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div key={i} className={`bg-slate-900 rounded-sm ${Math.random() > 0.5 ? 'opacity-100' : 'opacity-0'}`}></div>
                    ))}
                    <div className="absolute inset-0 m-auto w-12 h-12 bg-white border-4 border-slate-900 flex items-center justify-center">
                      <div className="w-4 h-4 bg-[#2B52FF]"></div>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-white/80 font-bold text-center uppercase tracking-widest mb-4 bg-white/10 py-1.5 px-3 rounded-full mt-2">
                Mã quét tại cổng ra
              </p>
            </div>

            <div className="w-full border-t border-white/20 pt-4 flex flex-col gap-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 w-full">
                <div className="text-[9px] uppercase font-bold text-white/60 tracking-wider text-center mb-1">LICENSE PLATE</div>
                <div className="text-2xl font-black text-white text-center tracking-wider mb-1">{session.licensePlate}</div>
                <div className="text-[10px] text-[#2B52FF] font-bold text-center capitalize">{session.vehicleTypeName}</div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3 w-full">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-[9px] text-white/60 uppercase font-bold mb-1 tracking-wider">ENTRY DATE</div>
                    <div className="text-xs text-white font-bold">{entryDateStr}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-white/60 uppercase font-bold mb-1 tracking-wider">ENTRY TIME</div>
                    <div className="text-xs text-white font-bold">{entryTimeStr}</div>
                  </div>
                </div>
              </div>

              {session.isPrepaid && session.prepaidStartTime && session.prepaidEndTime && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 w-full">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-[9px] text-yellow-500 uppercase font-bold mb-1 tracking-wider">BOOKED ARRIVAL</div>
                      <div className="text-[10px] text-white font-bold mb-0.5">{bookedArrivalDateStr}</div>
                      <div className="text-base text-white font-black">{bookedArrivalTimeStr}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-yellow-500 uppercase font-bold mb-1 tracking-wider">BOOKED EXIT</div>
                      <div className="text-[10px] text-white font-bold mb-0.5">{bookedExitDateStr}</div>
                      <div className="text-base text-white font-black">{bookedExitTimeStr}</div>
                    </div>
                  </div>
                  <div className="text-[8px] text-white/50 tracking-wide">
                    (Check-in allowed from {checkInAllowedStr})
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Info & Actions (8 columns out of 12) */}
        <div className="lg:col-span-8 space-y-4">

          {/* Top Level Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Time Card */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col justify-center transition-all hover:shadow-md">
              <div className="flex items-center gap-2 text-[#2B52FF] mb-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Clock size={16} />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest">Thời gian đỗ</span>
              </div>
              <div className="text-4xl lg:text-5xl font-black font-mono tracking-wider text-slate-800">{elapsedString}</div>
              <div className="text-[9px] text-slate-400 mt-2 uppercase font-bold tracking-widest">Giờ : Phút : Giây</div>
            </div>

            {/* Fee Card */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col justify-center transition-all hover:shadow-md">
              <div className="flex items-center gap-2 text-emerald-500 mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CreditCard size={16} />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest">Phí hiện tại</span>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-4xl lg:text-5xl font-black text-slate-800">{dynamicFee.toLocaleString('vi-VN')}</div>
                <div className="text-lg font-bold text-slate-400">đ</div>
              </div>
              <div className="text-[9px] text-slate-400 mt-2 font-medium">Cập nhật liên tục</div>
            </div>
          </div>

          {/* Merged Location & Details Card */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col mb-4 transition-all hover:shadow-md">
            <div className="flex items-start gap-4 border-b border-slate-100 pb-4 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0">
                <MapPin size={20} className="text-orange-500" />
              </div>
              <div>
                <div className="text-[9px] text-orange-500 font-bold uppercase tracking-widest mb-1">Parking Spot</div>
                <div className="text-xl sm:text-2xl font-black text-slate-800 capitalize">{session.floorName} — Ô {session.slotNumber}</div>
              </div>
            </div>

            <div>
              <div className="text-[9px] text-[#2B52FF] font-bold uppercase tracking-widest mb-2">Parking Lot</div>
              <div className="text-base font-bold text-slate-800 mb-3">{session.buildingName}</div>

              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-xs font-bold text-slate-500">Vehicle Type</span>
                <span className="text-xs font-bold text-[#2B52FF] capitalize">{session.vehicleTypeName}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-xs font-bold text-slate-500">Check-in Method</span>
                <span className="text-xs font-bold text-[#2B52FF]">
                  {session.isPrepaid ? 'Khách Đặt Trước' : 'Khách Vãng Lai'}
                </span>
              </div>
            </div>
          </div>

          {/* Surcharge Logs */}
          {session.isPrepaid && dynamicFee > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col mb-4 transition-all hover:shadow-md">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Clock size={16} className="text-[#2B52FF]" />
                Surcharge Logs
              </h3>

              <div className="space-y-4 max-h-[120px] overflow-y-auto pr-2">
                {session.surchargeLogs && session.surchargeLogs.length > 0 ? (
                  session.surchargeLogs.map((log, index) => (
                    <div key={index} className="flex justify-between items-start pb-3 border-b border-slate-50 border-dashed">
                      <div>
                        <div className="text-xs font-bold text-red-500 mb-1">{log.name}</div>
                        <div className="text-[9px] text-slate-400 font-medium">
                          {new Date(log.timestamp).toLocaleDateString('vi-VN')} {new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="text-xs font-black text-slate-800">
                        + {log.amount.toLocaleString('vi-VN')} đ
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between items-start pb-3 border-b border-slate-50 border-dashed">
                    <div>
                      <div className="text-xs font-bold text-red-500 mb-1">Late Departure Surcharge</div>
                      <div className="text-[9px] text-slate-400 font-medium">
                        {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-xs font-black text-slate-800">
                      + {dynamicFee.toLocaleString('vi-VN')} đ
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fee Policy & Notice */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col mb-4 transition-all hover:shadow-md">
            <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-500" />
              Fee Policy & Notice
            </h3>
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-600 leading-relaxed">
                <span className="font-bold text-orange-600">Early Arrival:</span> Check-in is allowed up to 15 mins before booked time. Arriving earlier incurs surcharges.
              </p>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                <span className="font-bold text-orange-600">Late Departure:</span> Surcharges apply immediately if parked past the booked exit time.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-1 flex flex-col sm:flex-row items-center gap-3">
            {(!session.isPrepaid || dynamicFee > 0) && (
              <button
                onClick={handlePayment}
                className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-emerald-600/20 transition-all hover:-translate-y-1 flex justify-center items-center gap-2 text-base border border-transparent"
              >
                <CreditCard size={18} />
                Pay Surcharge: {dynamicFee.toLocaleString('vi-VN')} đ
              </button>
            )}
            <button
              onClick={handleReport}
              className="w-full sm:flex-1 bg-white border-2 border-slate-100 hover:bg-slate-50 hover:border-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all flex justify-center items-center gap-2 text-sm"
            >
              <Flag size={18} />
              Báo Cáo Sự Cố
            </button>
          </div>
        </div>
      </div>

      <DevPanel onActionSuccess={fetchSession} />
    </div>
  );
}
