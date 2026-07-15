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
  Loader,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import CameraCapture from '../components/CameraCapture';
import { smartCheckIn } from '../services/checkInService';
import type { CheckInResult, SmartCheckInRequest } from '../services/checkInService';
import type { ScanPlateResponse } from '../services/ocrService';
import { getAllSlots } from '../services/parkingService';
import type { ParkingSlotDetail } from '../services/parkingService';
import { searchCheckOut, searchCheckOutByQr, confirmCheckOut, ocrCheckOut } from '../services/checkOutService';
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

function GateStatusBanner({ kind, message }: { kind: 'success' | 'error' | 'info'; message: string }) {
  if (!message) return null;
  const tone =
    kind === 'success'
      ? 'border-emerald-100 bg-white text-emerald-700 shadow-emerald-500/10'
      : kind === 'error'
        ? 'border-red-100 bg-white text-red-700 shadow-red-500/10'
        : 'border-blue-100 bg-white text-blue-700 shadow-blue-500/10';

  return (
    <div 
      className="fixed top-8 left-1/2 -translate-x-1/2 z-[100]"
      style={{ animation: 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
    >
      <div className={`rounded-full border px-6 py-3 text-sm font-bold shadow-xl flex items-center gap-2 ${tone}`}>
        {message}
      </div>
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
  const [exitCameraMode, setExitCameraMode] = useState<'lpr' | 'qr'>('lpr');
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
      showNotification('error', 'Please enter a license plate.');
      return;
    }
    if (!token) {
      showNotification('error', 'You must be logged in to check-in.');
      return;
    }

    const vtId = vehicleTypeMap[entryVehicleType.toLowerCase()];
    if (!vtId) {
      showNotification('error', `Vehicle type "${entryVehicleType}" not found in the system.`);
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
        `✓ Check-in successful: ${result.licensePlate} → Bldg ${result.buildingName}, Flr ${result.floorName}, Slot ${result.slotNumber}`
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
      showNotification('error', err instanceof Error ? err.message : 'Check-in failed.');
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
      showNotification('success', `Session found for license plate: ${result.licensePlate}`);
    } catch (err: any) {
      showNotification('error', err.message || 'No valid parking session found.');
      setExitSessionData(null);
    } finally {
      setExitLoading(false);
    }
  };

  const handleQrExitSuccess = async (qrCode: string): Promise<void> => {
    if (!token) return;
    setExitLoading(true);
    try {
      const result = await searchCheckOutByQr(qrCode, token, user?.assignedBuildingId);
      setExitSessionData(result);
      showNotification('success', `Parking session found.`);
    } catch (err: any) {
      showNotification('error', err.message || 'No valid session found for this QR code.');
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
      showNotification('error', 'You must be logged in to perform this action.');
      return;
    }

    try {
      const result = await confirmCheckOut({
        sessionId: exitSessionData.sessionId,
        staffId: user.userId,
        paymentMethod: 0, // Cash
        paymentAmount: exitSessionData.estimatedFee,
      }, token);

      showNotification('success', `Payment successful: ${result.totalFee.toLocaleString('vi-VN')} đ. Barrier opened!`);
      setExitLicensePlate('');
      setExitSessionData(null);
      exitInputRef.current?.focus();

      if (user.assignedBuildingId) {
        getAllSlots(user.assignedBuildingId).then(res => setSlots(res.filter(s => s.status === 'Available' || (s.status as unknown as number) === 0))).catch(() => {});
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error confirming payment.');
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
      `Detected: ${result.licensePlate} (Confidence: ${(result.confidence * 100).toFixed(1)}%) — Confirm and click CHECK-IN`
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
        showNotification('success', `License plate match: ${result.licensePlate} (${(result.confidence * 100).toFixed(1)}%)`);
      } else if (ocrResult.exitLicensePlate && ocrResult.entryLicensePlate) {
        showNotification('error', `Warning: OCR (${ocrResult.exitLicensePlate}) mismatch with DB (${ocrResult.entryLicensePlate})`);
      }
      exitInputRef.current?.focus();
    } catch (err: any) {
      showNotification('error', err.message || 'No parking session found for this license plate.');
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
                <div className="flex flex-col">
                  <span className="font-extrabold text-stone-900 leading-tight">Check-in Gate</span>
                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Entry</span>
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
              Entry (Check-in)
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
              Exit (Check-out)
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
              Back to Portal
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
            Logout
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
              
            {activeTab === 'entry' && (
              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 w-full max-w-6xl mx-auto mb-6 items-start">
                {/* Left Column: Camera Scanner */}
                <div className="bg-white border border-gray-200/80 rounded-[1.5rem] shadow-sm flex flex-col overflow-hidden h-full">
                  <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
                    <Camera className="w-5 h-5 text-stone-700" />
                    <h3 className="text-sm font-bold text-stone-900 uppercase tracking-widest">CAMERA SCANNER (LICENSE PLATE)</h3>
                  </div>
                  
                  <div className="bg-black relative flex-1 flex flex-col items-center justify-center min-h-[450px] overflow-hidden">
                    {/* Decorative scanner frame corners */}
                    <div className="absolute inset-6 border-2 border-transparent pointer-events-none z-20">
                      <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-red-500 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-red-500 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-red-500 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-red-500 rounded-br-lg" />
                    </div>

                    {/* CameraCapture Component inside the frame */}
                    <div className="absolute inset-0 z-10 w-full h-full bg-black">
                      <CameraCapture
                        onSuccess={handleEntryCameraResult}
                        onCancel={() => {}}
                        token={token}
                        inline
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                  <div className="bg-white p-5 text-center border-t border-gray-100">
                    <p className="text-[11px] font-bold text-stone-500 uppercase tracking-[0.2em]">PLEASE ASK CUSTOMER TO ALIGN LICENSE PLATE IN FRAME</p>
                  </div>
                </div>

                {/* Right Column: Manual Entry & Exceptions */}
                <div className="flex flex-col gap-6">
                  {/* Manual Entry Block */}
                  <div className="bg-white border border-gray-200/80 rounded-[1.5rem] p-6 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
                      <span className="font-mono font-bold text-lg text-stone-800">{`>_`}</span>
                      <h3 className="text-sm font-bold text-stone-900 uppercase tracking-widest">MANUAL ENTRY</h3>
                    </div>

                    {/* Info box */}
                    <div className="mb-6 rounded-xl bg-blue-50/50 p-4 border border-blue-100">
                      <p className="text-xs font-medium text-blue-800 leading-relaxed">
                        In case of camera scan failure, manually enter the <br />
                        <span className="font-bold uppercase tracking-wider text-blue-900">LICENSE PLATE</span>.
                      </p>
                    </div>

                    {/* Input license plate */}
                    <label className="mb-2 block text-[10px] font-bold text-stone-500 uppercase tracking-wider">License plate</label>
                    <div className="relative mb-6">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      </div>
                      <input
                        ref={entryInputRef}
                        type="text"
                        value={entryLicensePlate}
                        onChange={(event) => setEntryLicensePlate(event.target.value.toUpperCase())}
                        placeholder="EX: 30A-123.45"
                        className="h-14 w-full rounded-xl border border-gray-200 bg-white pl-12 pr-4 text-lg font-black tracking-widest text-stone-800 outline-none transition-all placeholder:text-stone-300 focus:border-[#FF4C4C] focus:ring-4 focus:ring-[#FF4C4C]/10 shadow-sm"
                      />
                    </div>

                    {/* Vehicle Type */}
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">Vehicle type</label>
                      <span className="text-[10px] text-stone-400 font-bold">Keyboard: 1 / 2 / 3</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {VEHICLE_TYPES.map((vehicle) => {
                        const selected = entryVehicleType === vehicle.type;
                        return (
                          <button
                            key={vehicle.type}
                            type="button"
                            onClick={() => setEntryVehicleType(vehicle.type)}
                            className={`relative rounded-xl border px-3 py-3 text-xs font-bold transition-all ${
                              selected
                                ? 'border-[#FF4C4C] bg-[#FF4C4C]/5 text-stone-850 shadow-sm'
                                : 'border-gray-200 bg-white text-stone-600 hover:border-gray-300 hover:text-stone-900'
                            }`}
                          >
                            {vehicle.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Assigned Slot */}
                    <label className="mb-2 block text-[10px] font-bold text-stone-500 uppercase tracking-wider">Card Assigned Slot</label>
                    <div className="mb-6 rounded-xl bg-stone-50 border border-stone-200 p-4 flex justify-between items-center">
                      <div>
                                        <div className="font-extrabold text-stone-900 mt-1">
                        {selectedSlotId ? `Slot ${selectedSlotNumber}` : 'Auto (AI Suggest)'}
                      </div>
                      <div className="text-xs text-stone-400 mt-1">
                        {selectedSlotId ? 'Staff manual choice' : 'Auto allocated by system'}
                      </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowMap(true)}
                        className="text-[#FF4C4C] hover:text-[#E13B3B] hover:bg-[#FF4C4C]/10 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      >
                        Change
                      </button>
                    </div>

                    {/* Confirm Button */}
                    <button
                      type="button"
                      onClick={handleConfirmEntry}
                      className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-gray-500 text-sm font-bold text-white transition-colors hover:bg-gray-600 shadow-sm"
                    >
                      <Zap className="mr-2 w-4 h-4" />
                      VALIDATE TICKET
                    </button>
                    <p className="mt-3 text-center text-[10px] text-stone-400 font-bold tracking-widest uppercase">Shortcut: F1</p>
                  </div>

                  {/* Exception Block */}
                  <div className="bg-white border border-gray-200/80 rounded-[1.5rem] p-6 shadow-sm">
                    <h4 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest mb-4">Gate Exception Override Tools</h4>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => openExceptionModal('manual-open')}
                        className="inline-flex items-center justify-start rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 px-4 py-3 text-xs font-bold text-amber-700 transition-colors text-left"
                      >
                        <DoorOpen className="mr-3 h-4 w-4" aria-hidden="true" />
                        Manual Gate Open
                      </button>
                      <button
                        type="button"
                        onClick={() => openExceptionModal('incident')}
                        className="inline-flex items-center justify-start rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 px-4 py-3 text-xs font-bold text-red-700 transition-colors text-left"
                      >
                        <AlertTriangle className="mr-3 h-4 w-4" aria-hidden="true" />
                        Report Incident
                      </button>
                      <button
                        type="button"
                        onClick={() => openExceptionModal('lost-ticket')}
                        className="inline-flex items-center justify-start rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 px-4 py-3 text-xs font-bold text-stone-600 transition-colors text-left"
                      >
                        <TicketX className="mr-3 h-4 w-4" aria-hidden="true" />
                        Lost Ticket Handling
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'exit' && (
              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 w-full max-w-6xl mx-auto mb-6 items-start">
                {/* LEFT COLUMN */}
                <div className="flex flex-col gap-6">
                  
                  {/* Manual Input / Search Block */}
                  {exitCameraMode === 'lpr' && (
                    <div className="bg-white border border-gray-200/80 rounded-[1.5rem] p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">LICENSE PLATE SCANNER (EXIT GATE)</h3>
                        <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest bg-gray-100 px-2 py-1 rounded-md">ENABLE MANUAL ENTRY</span>
                      </div>
                      <div className="relative flex gap-3">
                        <input
                          ref={exitInputRef}
                          type="text"
                          value={exitLicensePlate}
                          onChange={(event) => setExitLicensePlate(event.target.value.toUpperCase())}
                          placeholder="ABC-1234"
                          className="h-16 min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-6 text-2xl font-black tracking-[0.2em] text-stone-850 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        />
                        <button
                          type="button"
                          onClick={handleSearchExit}
                          disabled={exitLoading}
                          className="h-16 rounded-xl bg-blue-600 hover:bg-blue-700 px-8 text-sm font-bold text-white transition-colors shadow-sm disabled:opacity-50"
                        >
                          {exitLoading ? <Loader className="w-5 h-5 animate-spin mx-auto" /> : 'Search'}
                        </button>
                      </div>
                      <div className="mt-4 text-[10px] text-stone-400 font-bold flex justify-between px-2">
                        <span>Waiting for vehicle scan...</span>
                        <span className="flex items-center gap-1"><Camera className="w-3 h-3"/> AI SCAN</span>
                      </div>
                    </div>
                  )}

                  {/* Session Details Block */}
                  <div className="bg-white border border-gray-200/80 rounded-[1.5rem] p-6 shadow-sm min-h-[250px]">
                    <h3 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest mb-6">ACTIVE SESSION DETAILS</h3>
                    {exitLoading ? (
                      <div className="text-center text-sm font-bold text-stone-400 py-12">Loading data...</div>
                    ) : exitSessionData ? (
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-4">
                        <div>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">Session ID</p>
                          <p className="text-sm font-bold text-stone-800 font-mono">{exitSessionData.sessionId.slice(0, 8).toUpperCase()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">Session Type</p>
                          <p className="text-sm font-bold text-stone-800 capitalize">{exitSessionData.vehicleTypeName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">License Plate</p>
                          <p className="text-sm font-black text-stone-900 tracking-widest">{exitSessionData.licensePlate}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">Entry Time</p>
                          <p className="text-sm font-bold text-stone-800">{new Date(exitSessionData.entryTime).toLocaleString('vi-VN')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">Duration</p>
                          <p className="text-sm font-bold text-stone-800">{Math.floor(exitSessionData.totalHours)}h {Math.round((exitSessionData.totalHours % 1) * 60)}m</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Location</p>
                        <p className="text-sm font-bold text-stone-800">{exitSessionData.floorName} - Slot {exitSessionData.slotNumber}</p>
                      </div>
                        
                        {/* Status Row */}
                        <div className="col-span-2 lg:col-span-3 border-t border-gray-100 pt-6 flex justify-between items-center">
                          <span className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">PAYMENT STATUS</span>
                          <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg uppercase tracking-wider">Ready for Collection</span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-4 opacity-40">
                        <div>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">Session ID</p>
                          <p className="text-sm font-bold text-stone-300">---</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">Session Type</p>
                          <p className="text-sm font-bold text-stone-300">---</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">License Plate</p>
                          <p className="text-sm font-bold text-stone-300">---</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">Entry Time</p>
                          <p className="text-sm font-bold text-stone-300">--:-- --</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">Duration</p>
                          <p className="text-sm font-bold text-stone-300">--h --m</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">Slot Code</p>
                          <p className="text-sm font-bold text-stone-300">---</p>
                        </div>
                        <div className="col-span-2 lg:col-span-3 border-t border-gray-100 pt-6 flex justify-between items-center">
                          <span className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">PAYMENT STATUS</span>
                          <span className="text-[10px] font-bold text-stone-400">Pending Lookup</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* History Log Block (Mock) */}
                  <div className="bg-white border border-gray-200/80 rounded-[1.5rem] p-6 shadow-sm">
                    <h3 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest mb-4">HISTORY LOG</h3>
                    <div className="border border-gray-100 bg-gray-50/50 rounded-xl py-10 flex items-center justify-center">
                      <span className="text-xs font-medium text-stone-400">No history logs available</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="flex flex-col gap-6 h-full">
                  {/* Camera Block */}
                  <div className="bg-white border border-gray-200/80 rounded-[1.5rem] p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <span 
                        onClick={() => setExitCameraMode('lpr')}
                        className={`text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider shadow-sm cursor-pointer ${
                          exitCameraMode === 'lpr' ? 'bg-[#1A1F2B] text-white' : 'text-stone-400 hover:bg-gray-100'
                        }`}
                      >
                        LPR CAMERA
                      </span>
                      <span 
                        onClick={() => setExitCameraMode('qr')}
                        className={`text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-lg cursor-pointer ${
                          exitCameraMode === 'qr' ? 'bg-[#1A1F2B] text-white' : 'text-stone-400 hover:bg-gray-100'
                        }`}
                      >
                        QR SCANNER
                      </span>
                      <div className="flex-1" />
                      <span className="text-[9px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-3 py-2 rounded-md cursor-pointer hover:bg-red-100 transition-colors">TURN OFF CAM</span>
                    </div>
                    <div className="relative bg-black rounded-xl overflow-hidden min-h-[220px] flex items-center justify-center border-4 border-black shadow-inner">
                      <div className="absolute top-4 left-4 flex items-center gap-2 z-20 bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                        <span className="text-[10px] text-white font-mono font-bold tracking-wider">{exitCameraMode === 'lpr' ? 'LPR-CAM-02' : 'QR-CAM'}</span>
                      </div>
                      <div className="relative z-10 w-full h-full">
                        <CameraCapture
                          onSuccess={handleExitCameraResult}
                          onCancel={() => {}}
                          token={token}
                          inline
                          className="w-full h-full rounded-lg"
                          mode={exitCameraMode}
                          onQrSuccess={handleQrExitSuccess}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Payment Block */}
                  <div className="bg-white border border-gray-200/80 rounded-[1.5rem] p-6 shadow-sm flex flex-col flex-1">
                    <h3 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest mb-6">AMOUNT DUE</h3>
                    
                    <div className="text-5xl font-black text-stone-300 mb-8 tracking-tighter flex items-start gap-1">
                      <span className={exitSessionData ? "text-stone-800" : ""}>
                        {exitSessionData ? exitSessionData.estimatedFee.toLocaleString('vi-VN') : '0'}
                      </span>
                      <span className="text-3xl text-stone-300 mt-1">đ</span>
                    </div>

                    <div className="space-y-4 mb-8">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-stone-500">Base Fee</span>
                        <span className="font-bold text-stone-600">
                          {exitSessionData ? (exitSessionData.estimatedFee - (exitSessionData.feeBreakdown?.dayPassTotal || 0) - (exitSessionData.feeBreakdown?.nightPassTotal || 0)).toLocaleString('vi-VN') : '0'} đ
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-stone-500">Overtime Fee</span>
                        <span className="font-bold text-stone-600">
                          {exitSessionData ? ((exitSessionData.feeBreakdown?.dayPassTotal || 0) + (exitSessionData.feeBreakdown?.nightPassTotal || 0)).toLocaleString('vi-VN') : '0'} đ
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-5 border-t border-gray-100">
                        <span className="font-black text-stone-900 uppercase tracking-widest text-[11px]">BALANCE DUE</span>
                        <span className="font-black text-stone-900 text-lg">
                          {exitSessionData ? exitSessionData.estimatedFee.toLocaleString('vi-VN') : '0'} đ
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto space-y-3">
                      <button
                        type="button"
                        onClick={handleCollectAndOpen}
                        disabled={!exitSessionData}
                        className="w-full flex items-center justify-center gap-2 h-14 rounded-xl bg-gray-500 hover:bg-gray-600 disabled:bg-gray-200 text-sm font-bold text-white transition-colors shadow-sm"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        Process & Release
                      </button>
                      <button
                        type="button"
                        onClick={() => openExceptionModal('manual-open')}
                        className="w-full h-14 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-stone-700 uppercase tracking-widest transition-colors"
                      >
                        MANUAL OVERRIDE
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
          <div className="bg-white rounded-2xl w-[900px] max-w-[90vw] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-stone-100">
            <div className="p-5 border-b flex justify-between items-center bg-stone-50/50">
              <div>
                <h3 className="text-xl font-bold text-stone-900">Available Slots Map</h3>
                <p className="text-xs text-stone-500 mt-1">Manually select a slot (only showing available slots)</p>
              </div>
                <button
                  onClick={() => setShowMap(false)}
                  className="rounded-xl p-2 hover:bg-stone-100 transition-colors"
                >
                  <X size={20} className="text-stone-500" />
                </button>
              </div>
              <div className="p-6 overflow-auto bg-stone-50/30 flex-1">
                {loadingSlots ? (
                  <div className="py-12 text-center text-sm font-bold text-stone-400">Loading map...</div>
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
          </div>
      )}

      {/* Check-in Result Modal (Ticket / QR) */}
      {checkInResultData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-stone-100">
              <div className="p-6 flex flex-col items-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-stone-900 mb-1">E-Ticket</h3>
                <p className="text-xs text-stone-500 font-medium mb-6">Session ID: <span className="font-mono text-[#FF4C4C] font-bold">{checkInResultData.sessionCode}</span></p>
                
                {checkInResultData.sessionQrCodeBase64 && (
                  <div className="bg-white rounded-2xl p-4 inline-block border border-gray-100 mb-6 shadow-sm">
                    <img
                      src={`data:image/png;base64,${checkInResultData.sessionQrCodeBase64}`}
                      alt="Session QR"
                      className="w-48 h-48 mx-auto object-contain"
                    />
                  </div>
                )}
                
                <div className="w-full space-y-3 bg-stone-50 p-4 rounded-xl border border-stone-100">
                  <p className="text-sm flex justify-between"><span className="text-stone-500">License Plate:</span> <span className="font-bold text-stone-900 font-mono text-lg">{checkInResultData.licensePlate}</span></p>
                  <p className="text-sm flex justify-between"><span className="text-stone-500">Vehicle Type:</span> <span className="font-bold text-stone-900">{checkInResultData.vehicleTypeName}</span></p>
                  <p className="text-sm flex justify-between"><span className="text-stone-500">Location:</span> <span className="font-bold text-[#FF4C4C]">Floor {checkInResultData.floorName}, Slot {checkInResultData.slotNumber}</span></p>
                  <p className="text-sm flex justify-between"><span className="text-stone-500">Building:</span> <span className="font-bold text-stone-900">{checkInResultData.buildingName}</span></p>
                </div>
              </div>
            
            <div className="p-4 border-t flex justify-end gap-3 bg-stone-50/50">
              <button
                onClick={() => setCheckInResultData(null)}
                className="h-10 px-6 rounded-xl font-bold text-sm bg-stone-900 text-white hover:bg-stone-800 transition-colors w-full"
              >
                Print & Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}