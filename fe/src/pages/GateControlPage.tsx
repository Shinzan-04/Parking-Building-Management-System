import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  DoorOpen,
  LogOut,
  TicketX,
  Zap,
  QrCode,
  CheckCircle2,
  Car,
  Bike,
  Ticket,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import CameraCapture from '../components/CameraCapture';
import { smartCheckIn } from '../services/checkInService';
import type { CheckInResult, SmartCheckInRequest } from '../services/checkInService';
import type { ScanPlateResponse } from '../services/ocrService';
import { getAllSlots } from '../services/parkingService';
import type { ParkingSlotDetail } from '../services/parkingService';
import { searchCheckOut, confirmCheckOut, ocrCheckOut } from '../services/checkOutService';
import type { CheckOutSearchResult } from '../services/checkOutService';
import { MapPin, X } from 'lucide-react';
type VehicleType = 'car' | 'motorbike' | 'ev';


type ExceptionAction = 'manual-open' | 'incident' | 'lost-ticket';

const VEHICLE_TYPES: { type: VehicleType; label: string; key: string }[] = [
  { type: 'car', label: 'Car', key: '1' },
  { type: 'motorbike', label: 'Motorbike', key: '2' },
  { type: 'ev', label: 'EV', key: '3' },
];

const EXCEPTION_COPY: Record<
  ExceptionAction,
  { title: string; description: string; confirmLabel: string; tone: string }
> = {
  'manual-open': {
    title: 'Manual Gate Open',
    description: 'Use this when the barrier must be opened manually after operator verification.',
    confirmLabel: 'Open Gate',
    tone: 'border-amber-300 bg-amber-50 text-amber-700',
  },
  incident: {
    title: 'Report Incident',
    description: 'Capture an incident log for vehicle disputes, equipment faults, or safety issues.',
    confirmLabel: 'Log Incident',
    tone: 'border-red-300 bg-red-50 text-red-700',
  },
  'lost-ticket': {
    title: 'Lost Ticket Handling',
    description: 'Use the override flow to process vehicles that cannot present a valid ticket.',
    confirmLabel: 'Apply Override',
    tone: 'border-stone-300 bg-stone-50 text-stone-700',
  },
};

function GateStatusBanner({
  kind,
  message,
}: {
  kind: 'success' | 'error' | 'info';
  message: string;
}) {
  const tone =
    kind === 'success'
      ? 'border-emerald-250 bg-emerald-50 text-emerald-700'
      : kind === 'error'
        ? 'border-red-250 bg-red-50 text-red-700'
        : 'border-blue-250 bg-blue-50 text-blue-700';

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${tone}`}>
      {message}
    </div>
  );
}

function ExceptionHandlingModal({
  open,
  action,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  action: ExceptionAction | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setNote('');
    }
  }, [open, action]);

  if (!open || !action) {
    return null;
  }

  const copy = EXCEPTION_COPY[action];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl text-stone-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-2xs font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border w-fit ${copy.tone}`}>
              Exception flow
            </p>
            <h3 className="mt-3 text-xl font-bold text-stone-900">{copy.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-stone-500 transition-colors hover:bg-gray-50 hover:text-stone-900"
          >
            Close
          </button>
        </div>

        <p className="mt-4 text-xs font-semibold leading-relaxed text-stone-500">{copy.description}</p>

        <label className="mt-6 block text-xs font-bold text-stone-700 uppercase tracking-wider">Operator note</label>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Enter a short note for the audit trail..."
          rows={4}
          className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-stone-800 outline-none transition-colors placeholder:text-stone-300 focus:border-[#FF4C4C]"
        />

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-stone-500 transition-colors hover:bg-gray-50 hover:text-stone-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(note)}
            className="rounded-xl bg-stone-900 hover:bg-stone-850 px-4 py-2 text-xs font-bold text-white transition-opacity"
          >
            {copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GateControlPage() {
  const [activeTab, setActiveTab] = useState<'entry' | 'exit'>('entry');
  const [entryLicensePlate, setEntryLicensePlate] = useState('');
  const [entryVehicleType, setEntryVehicleType] = useState<VehicleType>('car');
  const [entryImageBase64, setEntryImageBase64] = useState<string | null>(null);
  const [exitLicensePlate, setExitLicensePlate] = useState('');
  const [exitSessionData, setExitSessionData] = useState<CheckOutSearchResult | null>(null);
  const [exitLoading, setExitLoading] = useState(false);
  const [notification, setNotification] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
  const [exceptionAction, setExceptionAction] = useState<ExceptionAction | null>(null);
  const [vehicleTypeMap, setVehicleTypeMap] = useState<Record<string, string>>({});
  
  const [slots, setSlots] = useState<ParkingSlotDetail[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedSlotNumber, setSelectedSlotNumber] = useState<string | null>(null);
  const [checkInResultData, setCheckInResultData] = useState<CheckInResult | null>(null);

  const { token, logout, user } = useAuth();

  const entryInputRef = useRef<HTMLInputElement>(null);
  const exitInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.assignedBuildingId && token) {
      setLoadingSlots(true);
      getAllSlots(user.assignedBuildingId)
        .then(res => setSlots(res.filter(s => s.status === 'Available' || (s.status as unknown as number) === 0)))
        .catch(() => {})
        .finally(() => setLoadingSlots(false));
    }
  }, [user?.assignedBuildingId, token]);

  useEffect(() => {
    entryInputRef.current?.focus();
  }, []);

  // Load vehicle types from API to map name -> id for scan-and-checkin
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:5237'}/api/VehicleTypes`);
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        const map: Record<string, string> = {};
        data.forEach((t: any) => {
          if (t.name) map[t.name.toLowerCase()] = t.id;
        });
        setVehicleTypeMap(map);
      } catch {
        // ignore
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!notification) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotification(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [notification]);

  const showNotification = (kind: 'success' | 'error' | 'info', message: string) => {
    setNotification({ kind, message });
  };

  const handleConfirmEntry = async () => {
    if (!entryLicensePlate.trim()) {
      showNotification('error', 'Vui lòng nhập biển số xe.');
      return;
    }
    if (!token) {
      showNotification('error', 'Bạn cần đăng nhập để thực hiện check-in.');
      return;
    }

    const vtId = vehicleTypeMap[entryVehicleType.toLowerCase()];
    if (!vtId) {
      showNotification('error', `Không tìm thấy loại xe "${entryVehicleType}" trong hệ thống.`);
      return;
    }

    try {
      const result = await smartCheckIn({
        licensePlate: entryLicensePlate.trim(),
        vehicleTypeId: vtId,
        entryImageBase64: entryImageBase64 || undefined,
        slotId: selectedSlotId || undefined,
      }, token);

      showNotification('success',
        `✓ Check-in thành công: ${result.licensePlate} → Tòa ${result.buildingName}, Tầng ${result.floorName}, Ô ${result.slotNumber}`
      );
      setCheckInResultData(result);
      setEntryLicensePlate('');
      setEntryVehicleType('car');
      setEntryImageBase64(null);
      setSelectedSlotId(null);
      setSelectedSlotNumber(null);
      if (user?.assignedBuildingId) {
        getAllSlots(user.assignedBuildingId).then(res => setSlots(res.filter(s => s.status === 'Available' || (s.status as unknown as number) === 0))).catch(() => {});
      }
      entryInputRef.current?.focus();
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Check-in thất bại.');
    }
  };

  const handleSearchExit = async () => {
    if (!exitLicensePlate.trim()) {
      showNotification('error', 'Please enter a license plate for exit lookup.');
      return;
    }
    if (!token) return;

    setExitLoading(true);
    try {
      const result = await searchCheckOut(exitLicensePlate, token, user?.assignedBuildingId);
      setExitSessionData(result);
      showNotification('success', `Đã tìm thấy phiên đỗ xe của biển số: ${result.licensePlate}`);
    } catch (err: any) {
      showNotification('error', err.message || 'Không tìm thấy phiên gửi xe hợp lệ.');
      setExitSessionData(null);
    } finally {
      setExitLoading(false);
    }
  };

  const handleCollectAndOpen = async () => {
    if (!exitSessionData) {
      showNotification('error', 'No active session found for this vehicle.');
      return;
    }
    if (!token || !user) {
      showNotification('error', 'Bạn cần đăng nhập để thực hiện.');
      return;
    }

    try {
      const result = await confirmCheckOut({
        sessionId: exitSessionData.sessionId,
        staffId: user.userId,
        paymentMethod: 0, // Cash
        paymentAmount: exitSessionData.estimatedFee,
      }, token);

      showNotification('success', `Thanh toán thành công: ${result.totalFee.toLocaleString('vi-VN')} đ. Mở Barrier!`);
      setExitLicensePlate('');
      setExitSessionData(null);
      exitInputRef.current?.focus();

      if (user.assignedBuildingId) {
        getAllSlots(user.assignedBuildingId).then(res => setSlots(res.filter(s => s.status === 'Available' || (s.status as unknown as number) === 0))).catch(() => {});
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Lỗi khi xác nhận thanh toán.');
    }
  };

  const openExceptionModal = (action: ExceptionAction) => {
    setExceptionAction(action);
    setExceptionModalOpen(true);
  };

  const handleEntryCameraResult = async (result: ScanPlateResponse, imageBase64: string) => {
    // Camera chỉ scan biển số → điền vào input → Staff xác nhận rồi bấm CHECK-IN
    setEntryLicensePlate(result.licensePlate);
    setEntryImageBase64(imageBase64);
    showNotification(
      'info',
      `Nhận diện: ${result.licensePlate} (Độ tin cậy: ${(result.confidence * 100).toFixed(1)}%) — Xác nhận và bấm CHECK-IN`
    );
    entryInputRef.current?.focus();
  };

  const handleExitCameraResult = async (result: ScanPlateResponse, imageBase64: string) => {
    setExitLicensePlate(result.licensePlate);
    if (!token) return;

    setExitLoading(true);
    try {
      const ocrResult = await ocrCheckOut({ imageBase64, staffId: user?.userId || '', buildingId: user?.assignedBuildingId }, token);
      
      const mappedData: CheckOutSearchResult = {
        sessionId: ocrResult.sessionId,
        licensePlate: ocrResult.entryLicensePlate,
        slotNumber: ocrResult.slotNumber,
        floorName: ocrResult.floorName,
        entryTime: ocrResult.entryTime,
        estimatedExitTime: ocrResult.estimatedExitTime,
        totalHours: ocrResult.totalHours,
        vehicleTypeName: ocrResult.vehicleTypeName,
        hourlyRate: ocrResult.hourlyRate,
        estimatedFee: ocrResult.estimatedFee,
        pricingModel: ocrResult.pricingModel,
        dayPassPrice: ocrResult.dayPassPrice,
        nightPassPrice: ocrResult.nightPassPrice,
        dailyMaxPrice: ocrResult.dailyMaxPrice,
        feeBreakdown: ocrResult.feeBreakdown,
        message: ocrResult.message
      };

      setExitSessionData(mappedData);
      
      if (ocrResult.isMatch) {
        showNotification('success', `Biển số khớp: ${result.licensePlate} (${(result.confidence * 100).toFixed(1)}%)`);
      } else {
        showNotification('error', `Cảnh báo: OCR (${ocrResult.exitLicensePlate}) khác DB (${ocrResult.entryLicensePlate})`);
      }
      exitInputRef.current?.focus();
    } catch (err: any) {
      showNotification('error', err.message || 'Không tìm thấy phiên gửi xe cho biển số này.');
      setExitSessionData(null);
    } finally {
      setExitLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {

      if (event.key === 'F1') {
        event.preventDefault();
        void handleConfirmEntry();
        return;
      }

      if (event.key === 'F2') {
        event.preventDefault();
        exitInputRef.current?.focus();
        return;
      }

      const activeElement = document.activeElement;
      if (event.key === 'Enter' && activeElement === exitInputRef.current && exitSessionData) {
        event.preventDefault();
        handleCollectAndOpen();
        return;
      }

      if (activeElement === entryInputRef.current && ['1', '2', '3'].includes(event.key)) {
        const selectedVehicle = VEHICLE_TYPES.find((vehicle) => vehicle.key === event.key);
        if (selectedVehicle) {
          setEntryVehicleType(selectedVehicle.type);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [entryLicensePlate, entryVehicleType, exitSessionData]);

  const initials = user?.fullName?.slice(0, 2)?.toUpperCase() ?? 'ST';

  return (
    <div className="flex h-screen bg-[#F3F3F5] text-stone-900 font-sans antialiased selection:bg-[#FF4C4C]/25 selection:text-[#FF4C4C] overflow-hidden">
      
      {/* ===== SIDEBAR TRANG STAFF ===== */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200/60 flex flex-col justify-between py-6">
        <div>
          {/* Logo */}
          <div className="px-6 pb-6 border-b border-gray-100 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FF4C4C] flex items-center justify-center text-white font-extrabold text-sm shadow-sm shadow-[#FF4C4C]/25">
              P
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-stone-900 block leading-tight">
                Gate Station<span className="text-[#FF4C4C]">.</span>
              </span>
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Operator Panel</span>
            </div>
          </div>

          {/* User info card */}
          {user && (
            <div className="mx-4 my-6 bg-gray-50 border border-gray-200/40 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FF4C4C] flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm shadow-[#FF4C4C]/20">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-stone-800 truncate leading-snug">{user.fullName}</p>
                <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">{user.role}</p>
              </div>
            </div>
          )}

          {/* Sidebar Menu Tabs */}
          <div className="px-3 space-y-1">
            <button
              onClick={() => setActiveTab('entry')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl border transition-all ${
                activeTab === 'entry'
                  ? 'bg-[#FF4C4C]/5 border-[#FF4C4C]/10 text-[#FF4C4C]'
                  : 'bg-transparent border-transparent text-stone-500 hover:bg-gray-50 hover:text-stone-900'
              }`}
            >
              <Car size={16} />
              Cổng Vào (Check-in)
            </button>
            <button
              onClick={() => setActiveTab('exit')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl border transition-all ${
                activeTab === 'exit'
                  ? 'bg-blue-600/5 border-blue-600/10 text-blue-600'
                  : 'bg-transparent border-transparent text-stone-500 hover:bg-gray-50 hover:text-stone-900'
              }`}
            >
              <DoorOpen size={16} />
              Cổng Ra (Check-out)
            </button>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="px-3 space-y-2">
          {user && (
            <Link
              to={
                user.role === 'Admin'    || user.role === 0 ? '/admin'   :
                user.role === 'Manager'  || user.role === 1 ? '/manager' :
                user.role === 'Staff'    || user.role === 2 ? '/staff'   : '/'
              }
              className="w-full flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-stone-600 hover:text-stone-900 font-bold py-2.5 rounded-xl text-xs transition-colors"
            >
              <ArrowLeft size={14} />
              Quay lại Portal
            </Link>
          )}
          <button
            onClick={() => {
              logout();
              window.location.replace('/auth');
            }}
            className="w-full flex items-center justify-center gap-2 border border-red-100 hover:bg-red-50 text-red-500 font-bold py-2.5 rounded-xl text-xs transition-all"
          >
            <LogOut size={14} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#F3F3F5]">
        
        {/* Sub Header */}
        <header className="bg-white border-b border-gray-200/60 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900">
              Gate Station
            </h2>
            <p className="text-2xs text-stone-400 font-bold uppercase tracking-wider mt-0.5">Live barrier and security check</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-2xs font-extrabold text-stone-400 uppercase tracking-widest">Active online</span>
          </div>
        </header>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Notification banner */}
          {notification && (
            <GateStatusBanner kind={notification.kind} message={notification.message} />
          )}

          {/* ── CHẾ ĐỘ CHECK-IN DUY NHẤT (BIỂN SỐ LÀ TRUNG TÂM) ── */}
            <div className="space-y-6">
              
              <div className="flex justify-center w-full mb-6">
                <div className="w-full max-w-3xl">
                
                {activeTab === 'entry' && (
                <section className="bg-white border border-gray-200/80 rounded-[2.5rem] p-6 shadow-sm flex flex-col justify-between min-h-[580px]">
                  {/* Cổng Vào (Walk-In) */}
                  <div>
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-stone-900">Entry Gate</h3>
                        <p className="text-xs text-stone-400 font-medium">Vehicle check-in and slot recommendation</p>
                      </div>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                        Live OCR
                      </span>
                    </div>

                    {/* Camera scan block */}
                    <div className="relative mb-6 overflow-hidden rounded-3xl border border-gray-200/60 bg-gray-150">
                      <CameraCapture
                        onSuccess={handleEntryCameraResult}
                        onCancel={() => {}}
                        token={token}
                        inline
                        className="w-full"
                      />
                      <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        Ready to scan
                      </div>
                      <div className="absolute top-4 right-4 rounded-full bg-stone-900/80 px-3 py-1 text-[10px] text-stone-300 font-medium font-mono shadow-sm">
                        CAM-ENTRY-01
                      </div>
                    </div>

                    {/* Input biển số */}
                    <label className="mb-2 block text-xs font-bold text-stone-500 uppercase tracking-wider">License plate</label>
                    <input
                      ref={entryInputRef}
                      type="text"
                      value={entryLicensePlate}
                      onChange={(event) => setEntryLicensePlate(event.target.value.toUpperCase())}
                      placeholder="ABC-1234"
                      className="h-16 w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 text-center text-2xl font-black tracking-[0.35em] text-stone-850 outline-none transition-colors placeholder:text-stone-300 focus:border-[#FF4C4C]"
                    />

                    {/* Vehicle Type Selection */}
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">Vehicle type</label>
                        <span className="text-[10px] text-stone-400 font-bold">Keyboard: 1 / 2 / 3</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {VEHICLE_TYPES.map((vehicle) => {
                          const selected = entryVehicleType === vehicle.type;
                          return (
                            <button
                              key={vehicle.type}
                              type="button"
                              onClick={() => setEntryVehicleType(vehicle.type)}
                              className={`relative rounded-2xl border-2 px-4 py-4 text-xs font-bold transition-all ${
                                selected
                                  ? 'border-[#FF4C4C] bg-[#FF4C4C]/5 text-stone-850 shadow-sm'
                                  : 'border-gray-200 bg-white text-stone-600 hover:border-gray-300 hover:text-stone-900'
                              }`}
                            >
                              <span className="absolute right-2 top-2 rounded bg-gray-100 px-1 py-0.5 font-mono text-[9px] text-stone-500 font-bold leading-none">
                                {vehicle.key}
                              </span>
                              {vehicle.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Slot Assignment */}
                    <div className="mt-5 rounded-2xl bg-stone-50 border border-stone-200 p-4">
                      <div className="flex items-center justify-between gap-1.5 text-xs font-bold text-stone-700">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-stone-500" aria-hidden="true" />
                          Assigned Slot
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowMap(true)}
                          className="text-[#FF4C4C] hover:underline"
                        >
                          Chọn vị trí thủ công
                        </button>
                      </div>
                      <div className="mt-2 text-xl font-black text-stone-800">
                        {selectedSlotId ? `Ô ${selectedSlotNumber}` : 'Tự động (AI Suggest)'}
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500 font-medium">
                        {selectedSlotId ? 'Staff chọn thủ công' : 'AI sẽ tự động chọn ô tốt nhất để tiết kiệm thời gian'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={handleConfirmEntry}
                      className="inline-flex h-16 w-full items-center justify-center rounded-2xl bg-[#FF4C4C] text-lg font-bold text-white transition-colors hover:bg-[#E13B3B] shadow-sm shadow-[#FF4C4C]/25"
                    >
                      CONFIRM ENTRY
                    </button>
                    <p className="mt-2 text-center text-[10px] text-stone-400 font-bold tracking-widest uppercase">Shortcut: F1</p>
                  </div>
                </section>
                )}

                {activeTab === 'exit' && (
                <section className="bg-white border border-gray-200/80 rounded-[2.5rem] p-6 shadow-sm flex flex-col justify-between min-h-[580px]">
                  {/* Cổng Ra (Check-Out) */}
                  <div>
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-stone-900">Exit Gate</h3>
                        <p className="text-xs text-stone-400 font-medium">Vehicle check-out and payment collection</p>
                      </div>
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                        Payment ready
                      </span>
                    </div>

                    {/* Exit Camera capture */}
                    <div className="relative mb-6 overflow-hidden rounded-3xl border border-gray-200/60 bg-gray-150">
                      <CameraCapture
                        onSuccess={handleExitCameraResult}
                        onCancel={() => {}}
                        token={token}
                        inline
                        className="w-full"
                      />
                      <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        Ready to scan
                      </div>
                      <div className="absolute top-4 right-4 rounded-full bg-stone-900/80 px-3 py-1 text-[10px] text-stone-300 font-medium font-mono shadow-sm">
                        CAM-EXIT-01
                      </div>
                    </div>

                    {/* Biển số cổng ra */}
                    <label className="mb-2 block text-xs font-bold text-stone-500 uppercase tracking-wider">License plate</label>
                    <div className="flex gap-3">
                      <input
                        ref={exitInputRef}
                        type="text"
                        value={exitLicensePlate}
                        onChange={(event) => setExitLicensePlate(event.target.value.toUpperCase())}
                        placeholder="ABC-1234"
                        className="h-16 min-w-0 flex-1 rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 text-center text-2xl font-black tracking-[0.35em] text-stone-850 outline-none transition-colors placeholder:text-stone-300 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleSearchExit}
                        className="h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 px-6 text-sm font-bold text-white transition-colors"
                      >
                        Search
                      </button>
                    </div>
                    <p className="mt-2 text-center text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                      Press <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-stone-600 border border-gray-200/50">F2</span> to focus
                    </p>

                    {/* Session data display */}
                    <div className="mt-5 rounded-2xl bg-gray-50 border border-gray-200/50 p-5 min-h-[140px] flex flex-col justify-center">
                      {exitLoading ? (
                        <div className="text-center text-xs text-stone-400 font-semibold leading-relaxed">
                          Đang tải dữ liệu...
                        </div>
                      ) : exitSessionData ? (
                        <div className="space-y-3">
                          <div className="flex justify-between border-b border-gray-100 pb-2">
                            <span className="text-xs text-stone-400 font-bold">Giờ vào</span>
                            <span className="text-xs font-bold text-stone-800">{new Date(exitSessionData.entryTime).toLocaleString('vi-VN')}</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-2">
                            <span className="text-xs text-stone-400 font-bold">Phương tiện</span>
                            <span className="text-xs font-bold text-stone-800 capitalize">{exitSessionData.vehicleTypeName}</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-2">
                            <span className="text-xs text-stone-400 font-bold">Vị trí đỗ</span>
                            <span className="text-xs font-bold text-stone-800 capitalize">{exitSessionData.floorName} - Ô {exitSessionData.slotNumber}</span>
                          </div>
                          <div className="flex justify-between pt-1">
                            <span className="text-xs text-stone-400 font-bold">Thời gian gửi</span>
                            <span className="text-sm font-bold text-stone-800">
                              {Math.floor(exitSessionData.totalHours)}h {Math.round((exitSessionData.totalHours % 1) * 60)}m
                            </span>
                          </div>

                          {/* Surcharge Logs / Block Breakdown */}
                          {exitSessionData.feeBreakdown && (
                            <div className="border-t border-gray-100 pt-3 mt-3">
                              <span className="text-xs text-stone-400 font-bold mb-3 flex items-center gap-2">
                                Surcharge Logs (Quá giờ)
                              </span>
                              <div className="space-y-3 max-h-[120px] overflow-y-auto pr-2">
                                {exitSessionData.feeBreakdown.dayPassCount > 0 && (
                                  <div className="flex justify-between items-start pb-2 border-b border-gray-50 border-dashed">
                                    <div>
                                      <div className="text-xs font-bold text-red-500 mb-0.5">
                                        Late Departure (Ngày)
                                      </div>
                                      <div className="text-[10px] text-stone-400 font-medium">
                                        Số lượng: {exitSessionData.feeBreakdown.dayPassCount} block
                                      </div>
                                    </div>
                                    <div className="text-xs font-black text-stone-800">
                                      + {exitSessionData.feeBreakdown.dayPassTotal.toLocaleString('vi-VN')} đ
                                    </div>
                                  </div>
                                )}
                                {exitSessionData.feeBreakdown.nightPassCount > 0 && (
                                  <div className="flex justify-between items-start pb-2 border-b border-gray-50 border-dashed">
                                    <div>
                                      <div className="text-xs font-bold text-red-500 mb-0.5">
                                        Late Departure (Đêm)
                                      </div>
                                      <div className="text-[10px] text-stone-400 font-medium">
                                        Số lượng: {exitSessionData.feeBreakdown.nightPassCount} block
                                      </div>
                                    </div>
                                    <div className="text-xs font-black text-stone-800">
                                      + {exitSessionData.feeBreakdown.nightPassTotal.toLocaleString('vi-VN')} đ
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="border-t border-gray-200/80 pt-3 mt-1 flex items-center justify-between">
                            <span className="text-xs text-stone-400 font-bold">Total fee</span>
                            <span className="text-3xl font-black text-emerald-600">{exitSessionData.estimatedFee.toLocaleString('vi-VN')} đ</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-xs text-stone-400 font-semibold leading-relaxed">
                          Enter a license plate or trigger camera detection to view payment details.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={handleCollectAndOpen}
                      disabled={!exitSessionData}
                      className="inline-flex h-16 w-full items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-150 disabled:text-stone-400"
                    >
                      COLLECT & OPEN BARRIER
                    </button>
                    <p className="mt-2 text-center text-[10px] text-stone-400 font-bold tracking-widest uppercase">Shortcut: Enter in input</p>
                  </div>
                </section>
                )}
                
                </div>
              </div>

              {/* Exception Action Block */}
              <section className="bg-white border border-gray-200/80 rounded-[2.5rem] p-6 shadow-sm">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Gate Exception Override Tools</h4>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => openExceptionModal('manual-open')}
                    className="inline-flex items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 hover:bg-amber-100 px-5 py-3 text-xs font-bold text-amber-700 transition-colors"
                  >
                    <DoorOpen className="mr-2 h-4 w-4" aria-hidden="true" />
                    Manual Gate Open
                  </button>
                  <button
                    type="button"
                    onClick={() => openExceptionModal('incident')}
                    className="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-red-50 hover:bg-red-100 px-5 py-3 text-xs font-bold text-red-700 transition-colors"
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />
                    Report Incident
                  </button>
                  <button
                    type="button"
                    onClick={() => openExceptionModal('lost-ticket')}
                    className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 hover:bg-gray-100 px-5 py-3 text-xs font-bold text-stone-600 transition-colors"
                  >
                    <TicketX className="mr-2 h-4 w-4" aria-hidden="true" />
                    Lost Ticket handling
                  </button>
                </div>
              </section>

            </div>

        </div>
      </main>


      {/* Exception Modal */}
      <ExceptionHandlingModal
        open={exceptionModalOpen}
        action={exceptionAction}
        onOpenChange={setExceptionModalOpen}
        onConfirm={(note) => {
          const actionLabel = exceptionAction ? EXCEPTION_COPY[exceptionAction].title : 'Exception';
          showNotification('success', `${actionLabel} completed${note.trim() ? ` with note: ${note.trim()}` : ''}.`);
          setExceptionModalOpen(false);
          setExceptionAction(null);
        }}
      />

        {/* Map Modal */}
        {showMap && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-stone-900">Bản đồ vị trí trống</h3>
                  <p className="text-xs text-stone-500 mt-1">Chọn vị trí thủ công cho phương tiện (chỉ hiện ô còn trống)</p>
                </div>
                <button
                  onClick={() => setShowMap(false)}
                  className="rounded-xl p-2 hover:bg-stone-100 transition-colors"
                >
                  <X size={20} className="text-stone-500" />
                </button>
              </div>

              {loadingSlots ? (
                <div className="py-12 text-center text-sm font-bold text-stone-400">Đang tải bản đồ...</div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {slots.map(s => {
                    const isSelected = s.id === selectedSlotId;
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSlotId(null);
                            setSelectedSlotNumber(null);
                          } else {
                            setSelectedSlotId(s.id);
                            setSelectedSlotNumber(s.slotNumber);
                            setShowMap(false);
                          }
                        }}
                        className={`h-12 flex flex-col items-center justify-center rounded-xl border text-[10px] font-bold transition-all ${
                          isSelected
                            ? 'bg-[#FF4C4C] border-[#FF4C4C] text-white shadow-md'
                            : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-[#FF4C4C] hover:text-[#FF4C4C]'
                        }`}
                      >
                        <Car size={12} className="mb-0.5" />
                        {s.slotNumber}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
      )}

      {/* Check-in Result Modal (Ticket / QR) */}
      {checkInResultData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-sm text-center border border-gray-100">
            <h3 className="text-xl font-bold text-stone-900 mb-1">Vé Gửi Xe Điện Tử</h3>
            <p className="text-xs text-stone-500 font-medium mb-6">Mã phiên: <span className="font-mono text-[#FF4C4C] font-bold">{checkInResultData.sessionCode}</span></p>

            {checkInResultData.sessionQrCodeBase64 && (
              <div className="bg-gray-50 rounded-2xl p-4 inline-block border border-gray-200 mb-6 shadow-inner">
                <img
                  src={`data:image/png;base64,${checkInResultData.sessionQrCodeBase64}`}
                  alt="Session QR"
                  className="w-48 h-48 mx-auto object-contain"
                />
              </div>
            )}

            <div className="space-y-2 text-left bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <p className="text-sm flex justify-between"><span className="text-stone-500">Biển số:</span> <span className="font-bold text-stone-900 font-mono text-lg">{checkInResultData.licensePlate}</span></p>
              <p className="text-sm flex justify-between"><span className="text-stone-500">Loại xe:</span> <span className="font-bold text-stone-900">{checkInResultData.vehicleTypeName}</span></p>
              <p className="text-sm flex justify-between"><span className="text-stone-500">Vị trí:</span> <span className="font-bold text-[#FF4C4C]">Tầng {checkInResultData.floorName}, Ô {checkInResultData.slotNumber}</span></p>
              <p className="text-sm flex justify-between"><span className="text-stone-500">Tòa nhà:</span> <span className="font-bold text-stone-900">{checkInResultData.buildingName}</span></p>
            </div>

            <button
              onClick={() => setCheckInResultData(null)}
              className="mt-6 w-full py-3 bg-[#FF4C4C] text-white rounded-xl font-bold hover:bg-[#E13B3B] transition-colors"
            >
              In vé & Đóng
            </button>
          </div>
        </div>
      )}

    </div>
  );
}