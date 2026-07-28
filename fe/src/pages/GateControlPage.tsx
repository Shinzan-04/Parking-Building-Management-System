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
  Printer,
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
import { createPayOSPayment, verifyPayment } from '../services/paymentService';
import { QRCodeSVG } from 'qrcode.react';
type VehicleType = 'car' | 'motor' | 'ev';


type ExceptionAction = 'manual-open' | 'incident' | 'lost-ticket';

const VEHICLE_TYPES: { type: VehicleType; label: string; key: string }[] = [
  { type: 'car', label: 'Car', key: '1' },
  { type: 'motor', label: 'Motor', key: '2' },
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
    tone: 'border-stone-300 admin-bg-base admin-text',
  },
};

function GateStatusBanner({ kind, message }: { kind: 'success' | 'error' | 'info'; message: string }) {
  if (!message) return null;
  const tone =
    kind === 'success'
      ? 'border-emerald-100 admin-bg-surface text-emerald-700 shadow-emerald-500/10'
      : kind === 'error'
        ? 'border-red-100 admin-bg-surface text-red-700 shadow-red-500/10'
        : 'border-blue-100 admin-bg-surface text-blue-700 shadow-blue-500/10';

  const Icon = kind === 'success' ? CheckCircle2 : kind === 'error' ? AlertTriangle : AlertTriangle;

  return (
    <div
      className="fixed top-8 inset-x-0 flex justify-center z-[100] pointer-events-none"
      style={{ animation: 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
    >
      <div className={`w-80 min-h-[4.5rem] rounded-2xl border p-4 shadow-xl flex items-center gap-3.5 pointer-events-auto ${tone}`}>
        <Icon size={26} className={`shrink-0 ${kind === 'success' ? 'text-emerald-500' : kind === 'error' ? 'text-red-500' : 'text-blue-500'}`} />
        <span className="text-sm font-bold leading-snug text-left">{message}</span>
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
      <div className="w-full max-w-lg rounded-3xl border admin-border admin-bg-surface p-6 shadow-2xl admin-text">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-2xs font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border w-fit ${copy.tone}`}>
              Exception flow
            </p>
            <h3 className="mt-3 text-xl font-bold admin-text">{copy.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border admin-border px-3 py-1.5 text-xs font-semibold admin-text-muted transition-colors hover:admin-bg-base hover:admin-text"
          >
            Close
          </button>
        </div>

        <p className="mt-4 text-xs font-semibold leading-relaxed admin-text-muted">{copy.description}</p>

        <label className="mt-6 block text-xs font-bold admin-text uppercase tracking-wider">Operator note</label>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Enter a short note for the audit trail..."
          rows={4}
          className="mt-2 w-full rounded-2xl border admin-border admin-bg-base px-4 py-3 text-sm admin-text outline-none transition-colors placeholder:admin-text-faint focus:border-[#FF4C4C]"
        />

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border admin-border px-4 py-2 text-xs font-bold admin-text-muted transition-colors hover:admin-bg-base hover:admin-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(note)}
            className="rounded-xl bg-[#FF4C4C] hover:bg-[#E13B3B] px-4 py-2 text-xs font-bold text-white transition-colors"
          >
            {copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GateControlPage({ defaultTab = 'entry' }: { defaultTab?: 'entry' | 'exit' }) {
  const [activeTab, setActiveTab] = useState<'entry' | 'exit'>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const [entryLicensePlate, setEntryLicensePlate] = useState('');
  const [entryVehicleType, setEntryVehicleType] = useState<VehicleType>('car');
  const [entryImageBase64, setEntryImageBase64] = useState<string | null>(null);
  const [exitLicensePlate, setExitLicensePlate] = useState('');
  const [exitQrCode, setExitQrCode] = useState('');

  const [isExitCameraOff, setIsExitCameraOff] = useState(false);
  const [exitSessionData, setExitSessionData] = useState<CheckOutSearchResult | null>(null);
  const [exitLoading, setExitLoading] = useState(false);
  const [notification, setNotification] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
  const [exceptionAction, setExceptionAction] = useState<ExceptionAction | null>(null);
  const [vehicleTypeMap, setVehicleTypeMap] = useState<Record<string, string>>({});

  const [payOsQrCode, setPayOsQrCode] = useState<string | null>(null);
  const [payOsOrderCode, setPayOsOrderCode] = useState<number | null>(null);
  const [payOsLoading, setPayOsLoading] = useState(false);
  const [isPayOsPaid, setIsPayOsPaid] = useState<boolean>(false);
  const [isCashReceived, setIsCashReceived] = useState<boolean>(false);
  const [isLostTicketMode, setIsLostTicketMode] = useState<boolean>(false);

  useEffect(() => {
    setIsCashReceived(false);
    setIsPayOsPaid(false);
    setPayOsQrCode(null);
    setPayOsOrderCode(null);
  }, [exitSessionData?.sessionId]);

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
        .catch(() => { })
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
      });

      showNotification('success',
        `Check-in successful: ${result.licensePlate} — ${result.buildingName}, Floor ${result.floorName}, Slot ${result.slotNumber}`
      );
      setCheckInResultData(result);
      setEntryLicensePlate('');
      setEntryVehicleType('car');
      setEntryImageBase64(null);
      setSelectedSlotId(null);
      setSelectedSlotNumber(null);
      if (user?.assignedBuildingId) {
        getAllSlots(user.assignedBuildingId).then(res => setSlots(res.filter(s => s.status === 'Available' || (s.status as unknown as number) === 0))).catch(() => { });
      }
      entryInputRef.current?.focus();
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Check-in failed.');
    }
  };

  const handleSearchExit = async () => {
    if (!isLostTicketMode && !exitQrCode.trim()) {
      showNotification('error', 'Please scan or enter the QR Code first.');
      return;
    }
    if (!exitLicensePlate.trim()) {
      showNotification('error', 'Please enter a license plate for exit lookup.');
      return;
    }
    if (!token) return;

    setExitLoading(true);
    try {
      const result = await searchCheckOutByQr(exitQrCode, exitLicensePlate, user?.assignedBuildingId, isLostTicketMode);
      setExitSessionData(result);
      if (result.isPlateMismatch) {
        showNotification('error', 'WARNING: Scanned license plate does NOT match the ticket!');
      } else {
        showNotification('success', `Session found for license plate: ${result.licensePlate}`);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'No valid parking session found.');
      setExitSessionData(null);
    } finally {
      setExitLoading(false);
    }
  };

  const handleQrExitSuccess = async (qrCode: string): Promise<void> => {
    setExitQrCode(qrCode);
    showNotification('success', `Scanned QR Code: ${qrCode}`);
  };

  const handleCollectAndOpen = async (method: number = 0) => {
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
        paymentMethod: method, // Default to Cash (0)
        paymentAmount: exitSessionData.amountDue ?? exitSessionData.estimatedFee,
      });

      showNotification('success', `Payment successful: ${result.totalFee.toLocaleString('en-US')} VND. Barrier opened!`);
      setExitLicensePlate('');
      setExitSessionData(null);
      exitInputRef.current?.focus();

      if (user.assignedBuildingId) {
        getAllSlots(user.assignedBuildingId).then(res => setSlots(res.filter(s => s.status === 'Available' || (s.status as unknown as number) === 0))).catch(() => { });
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error confirming payment.');
    }
  };

  const openExceptionModal = (action: ExceptionAction) => {
    setExceptionAction(action);
    setExceptionModalOpen(true);
  };

  useEffect(() => {
    let intervalId: number;
    if (payOsOrderCode && exitSessionData) {
      intervalId = window.setInterval(async () => {
        try {
          const status = await verifyPayment(payOsOrderCode);
          if (status.isPaid) {
            clearInterval(intervalId);
            showNotification('success', 'Customer has paid via Bank transfer successfully!');
            setPayOsQrCode(null);
            setPayOsOrderCode(null);
            setIsPayOsPaid(true);
          }
        } catch (err) {
          // ignore error while polling
        }
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payOsOrderCode, exitSessionData]);

  const handleGeneratePayOsQr = async () => {
    if (!exitSessionData) return;
    setPayOsLoading(true);
    try {
      const res = await createPayOSPayment({
        amount: exitSessionData.amountDue ?? exitSessionData.estimatedFee,
        description: `Fee ${exitSessionData.licensePlate}`,
        parkingSessionId: exitSessionData.sessionId,
      });
      if (res.qrCode) {
        setPayOsQrCode(res.qrCode);
        setPayOsOrderCode(res.orderCode);
      } else {
        showNotification('error', 'PayOS did not return QR Code.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to generate PayOS QR');
    } finally {
      setPayOsLoading(false);
    }
  };

  const handleEntryCameraResult = async (result: ScanPlateResponse, imageBase64: string) => {
    // Camera chỉ scan biển số → VNDiền vào input → Staff xác nhận rồi bấm CHECK-IN
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
    showNotification('info', `License plate scanned: ${result.licensePlate}. Please scan QR ticket.`);
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
    <div className="flex-1 flex flex-col min-h-screen admin-bg-base admin-text font-sans antialiased selection:bg-[#FF4C4C]/25 selection:text-[#FF4C4C] rounded-2xl overflow-hidden border admin-border shadow-sm">


      <header className="admin-bg-surface border-b admin-border px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold admin-text">
            Gate Station
          </h2>
          <p className="text-2xs admin-text-faint font-bold uppercase tracking-wider mt-0.5">Live barrier and security check</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-2xs font-extrabold admin-text-faint uppercase tracking-widest">Active online</span>
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
              <div className="glass-card rounded-[1.5rem] flex flex-col overflow-hidden h-full">
                <div className="p-5 border-b admin-border flex items-center gap-3 admin-bg-surface">
                  <Camera className="w-5 h-5 admin-text-muted" />
                  <h3 className="text-sm font-bold admin-text uppercase tracking-widest">CAMERA SCANNER (LICENSE PLATE)</h3>
                </div>

                <div className="bg-black relative flex-1 flex flex-col items-center justify-center min-h-[450px] overflow-hidden rounded-xl">
                  {/* Camera Status Labels */}
                  <div className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-emerald-500/20 px-3 py-1.5 rounded-full backdrop-blur-md border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Ready to scan</span>
                  </div>
                  <div className="absolute top-4 right-4 z-30 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                    <span className="text-[10px] font-mono font-bold text-[#fff] tracking-widest">CAM-ENTRY-01</span>
                  </div>

                  {/* Decorative scanner frame corners */}
                  <div className="absolute top-16 bottom-20 inset-x-10 border-2 border-transparent pointer-events-none z-40">
                    <div className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-red-500 rounded-tl-xl" />
                    <div className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-red-500 rounded-tr-xl" />
                    <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-red-500 rounded-bl-xl" />
                    <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-red-500 rounded-br-xl" />
                  </div>

                  {/* CameraCapture Component inside the frame */}
                  <div className="absolute inset-0 z-10 w-full h-full bg-black">
                    <CameraCapture
                      onSuccess={handleEntryCameraResult}
                      onCancel={() => { }}
                      token={token}
                      inline
                      className="w-full h-full"
                    />
                  </div>
                </div>
                <div className="admin-bg-surface p-5 text-center border-t admin-border">
                  <p className="text-[11px] font-bold admin-text-faint uppercase tracking-[0.2em]">PLEASE ASK CUSTOMER TO ALIGN LICENSE PLATE IN FRAME</p>
                </div>
              </div>

              {/* Right Column: Manual Entry & Exceptions */}
              <div className="flex flex-col gap-6">
                {/* Manual Entry Block */}
                <div className="glass-card rounded-[1.5rem] p-6 flex flex-col">
                  <div className="flex items-center gap-2 mb-6 pb-4 border-b admin-border">
                    <span className="font-mono font-bold text-lg admin-text">{`>`}</span>
                    <h3 className="text-sm font-bold admin-text uppercase tracking-widest">MANUAL ENTRY</h3>
                  </div>

                  {/* Info box */}
                  <div className="mb-6 rounded-xl admin-bg-surface/5 p-4 border admin-border">
                    <p className="text-xs font-medium admin-text-muted leading-relaxed">
                      In case of camera scan failure, manually enter the <br />
                      <span className="font-bold uppercase tracking-wider admin-text">LICENSE PLATE</span>.
                    </p>
                  </div>

                  {/* Input license plate */}
                  <label className="mb-2 block text-[10px] font-bold admin-text-muted uppercase tracking-wider">License plate</label>
                  <div className="relative mb-6">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 admin-text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input
                      ref={entryInputRef}
                      type="text"
                      value={entryLicensePlate}
                      onChange={(event) => setEntryLicensePlate(event.target.value.toUpperCase())}
                      placeholder="Enter License Plate"
                      className="h-14 w-full rounded-xl border admin-border admin-bg-surface pl-12 pr-4 text-lg font-black tracking-widest admin-text outline-none transition-all focus:border-[#FF4C4C] focus:ring-4 focus:ring-[#FF4C4C]/10 shadow-sm"
                    />
                  </div>

                  {/* Vehicle Type */}
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[10px] font-bold admin-text-muted uppercase tracking-wider">Vehicle type</label>
                    <span className="text-[10px] admin-text-faint font-bold">Keyboard: 1 / 2 / 3</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {VEHICLE_TYPES.map((vehicle) => {
                      const selected = entryVehicleType === vehicle.type;
                      return (
                        <button
                          key={vehicle.type}
                          type="button"
                          onClick={() => setEntryVehicleType(vehicle.type)}
                          className={`relative rounded-xl border px-3 py-3 text-xs font-bold transition-all ${selected
                            ? 'border-[#FF4C4C] bg-[#FF4C4C]/10 text-[#FF4C4C] shadow-sm'
                            : 'admin-border admin-bg-surface admin-text-muted hover:border-[#FF4C4C]/40 hover:admin-text'
                            }`}
                        >
                          {vehicle.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Assigned Slot */}
                  <label className="mb-2 block text-[10px] font-bold admin-text-muted uppercase tracking-wider">Card Assigned Slot</label>
                  <div className="mb-6 rounded-xl admin-bg-surface border admin-border p-4 flex justify-between items-center">
                    <div>
                      <div className="font-extrabold admin-text mt-1">
                        {selectedSlotId ? `Slot ${selectedSlotNumber}` : 'Auto (AI Suggest)'}
                      </div>
                      <div className="text-xs admin-text-faint mt-1">
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
                    className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-[#FF4C4C] hover:bg-[#E13B3B] text-sm font-bold text-white transition-colors shadow-sm"
                  >
                    <Zap className="mr-2 w-4 h-4" />
                    VALIDATE TICKET
                  </button>
                  <p className="mt-3 text-center text-[10px] admin-text-faint font-bold tracking-widest uppercase">Shortcut: F1</p>
                </div>

                {/* Exception Block */}
                <div className="glass-card rounded-[1.5rem] p-6">
                  <h4 className="text-[11px] font-bold admin-text-muted uppercase tracking-widest mb-4">Gate Exception Override Tools</h4>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => openExceptionModal('manual-open')}
                      className="inline-flex items-center justify-start rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-3 text-xs font-bold text-amber-500 transition-colors text-left"
                    >
                      <DoorOpen className="mr-3 h-4 w-4" aria-hidden="true" />
                      Manual Gate Open
                    </button>
                    <button
                      type="button"
                      onClick={() => openExceptionModal('incident')}
                      className="inline-flex items-center justify-start rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-4 py-3 text-xs font-bold text-red-500 transition-colors text-left"
                    >
                      <AlertTriangle className="mr-3 h-4 w-4" aria-hidden="true" />
                      Report Incident
                    </button>
                    <button
                      type="button"
                      onClick={() => openExceptionModal('lost-ticket')}
                      className="inline-flex items-center justify-start rounded-xl border admin-border admin-bg-surface hover:admin-bg-surface/10 px-4 py-3 text-xs font-bold admin-text-muted transition-colors text-left"
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

                <div className="glass-card rounded-[1.5rem] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[11px] font-bold admin-text-faint uppercase tracking-widest">MANUAL ENTRY & SEARCH</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLostTicketMode(!isLostTicketMode);
                        if (!isLostTicketMode) setExitQrCode('');
                      }}
                      className={`text-[9px] font-bold uppercase tracking-widest border px-3 py-1.5 rounded-lg transition-colors ${
                        isLostTicketMode 
                          ? 'bg-[#FF4C4C]/10 border-[#FF4C4C]/30 text-[#FF4C4C]' 
                          : 'admin-bg-surface admin-border admin-text hover:bg-[#FF4C4C]/5 hover:text-[#FF4C4C] hover:border-[#FF4C4C]/30'
                      }`}
                    >
                      {isLostTicketMode ? 'LOST TICKET MODE: ON' : 'LOST TICKET'}
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={exitQrCode}
                        onChange={(event) => setExitQrCode(event.target.value)}
                        placeholder={isLostTicketMode ? "QR bypassed in Lost Ticket Mode" : "QR Code / Session ID"}
                        disabled={isLostTicketMode}
                        className="h-14 min-w-0 flex-1 rounded-xl border admin-border admin-bg-surface px-6 text-sm font-medium admin-text outline-none transition-all focus:border-[#FF4C4C] focus:ring-4 focus:ring-[#FF4C4C]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="flex gap-3">
                      <input
                        ref={exitInputRef}
                        type="text"
                        value={exitLicensePlate}
                        onChange={(event) => setExitLicensePlate(event.target.value.toUpperCase())}
                        placeholder="Enter License Plate"
                        className="h-14 min-w-0 flex-1 rounded-xl border admin-border admin-bg-surface px-6 text-sm font-medium admin-text outline-none transition-all focus:border-[#FF4C4C] focus:ring-4 focus:ring-[#FF4C4C]/10 uppercase"
                      />
                      <button
                        type="button"
                        onClick={handleSearchExit}
                        disabled={exitLoading || (!isLostTicketMode && !exitQrCode.trim()) || !exitLicensePlate.trim()}
                        className="h-14 rounded-xl bg-blue-600 hover:bg-blue-700 px-8 text-sm font-bold text-[#fff] transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                      >
                        {exitLoading ? <Loader className="w-5 h-5 animate-spin" /> : 'Search'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 text-[10px] admin-text-faint font-bold flex justify-between px-2">
                    <span>Waiting for vehicle scan...</span>
                    <span className="flex items-center gap-1"><Camera className="w-3 h-3" /> AI SCAN</span>
                  </div>
                </div>


                {/* Session Details Block */}
                <div className="glass-card rounded-[1.5rem] p-6 min-h-[250px]">
                  <h3 className="text-[11px] font-bold admin-text-muted uppercase tracking-widest mb-6">ACTIVE SESSION DETAILS</h3>
                  {exitLoading ? (
                    <div className="text-center text-sm font-bold admin-text-faint py-12">Loading data...</div>
                  ) : exitSessionData ? (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-4">
                      <div>
                        <p className="text-[10px] admin-text-faint font-bold uppercase tracking-wider mb-1">Session ID</p>
                        <p className="text-sm font-bold admin-text font-mono">{exitSessionData.sessionCode}</p>
                      </div>
                      <div>
                        <p className="text-[10px] admin-text-faint font-bold uppercase tracking-wider mb-1">Vehicle Type</p>
                        <p className="text-sm font-bold admin-text capitalize">{exitSessionData.vehicleTypeName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] admin-text-faint font-bold uppercase tracking-wider mb-1">License Plate</p>
                        <p className="text-sm font-black admin-text tracking-widest">{exitSessionData.licensePlate}</p>
                      </div>
                      <div>
                        <p className="text-[10px] admin-text-faint font-bold uppercase tracking-wider mb-1">Entry Time</p>
                        <p className="text-sm font-bold admin-text">{new Date(exitSessionData.entryTime).toLocaleString('en-US')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] admin-text-faint font-bold uppercase tracking-wider mb-1">Duration</p>
                        <p className="text-sm font-bold admin-text">{Math.floor(exitSessionData.totalHours)}h {Math.round((exitSessionData.totalHours % 1) * 60)}m</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold tracking-wider admin-text-faint">Location</p>
                        <p className="text-sm font-bold admin-text">{exitSessionData.floorName} - Slot {exitSessionData.slotNumber}</p>
                      </div>

                      {/* Status Row */}
                      <div className="col-span-2 lg:col-span-3 border-t admin-border pt-6 flex justify-between items-center">
                        <span className="text-[10px] admin-text-muted font-bold uppercase tracking-widest">PAYMENT STATUS</span>
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg uppercase tracking-wider">Ready for Collection</span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-4 opacity-40">
                      <div>
                        <p className="text-[10px] admin-text-faint font-bold uppercase tracking-wider mb-1">Session ID</p>
                        <p className="text-sm font-bold admin-text-faint">---</p>
                      </div>
                      <div>
                        <p className="text-[10px] admin-text-faint font-bold uppercase tracking-wider mb-1">Vehicle Type</p>
                        <p className="text-sm font-bold admin-text-faint">---</p>
                      </div>
                      <div>
                        <p className="text-[10px] admin-text-faint font-bold uppercase tracking-wider mb-1">License Plate</p>
                        <p className="text-sm font-bold admin-text-faint">---</p>
                      </div>
                      <div>
                        <p className="text-[10px] admin-text-faint font-bold uppercase tracking-wider mb-1">Entry Time</p>
                        <p className="text-sm font-bold admin-text-faint">--:-- --</p>
                      </div>
                      <div>
                        <p className="text-[10px] admin-text-faint font-bold uppercase tracking-wider mb-1">Duration</p>
                        <p className="text-sm font-bold admin-text-faint">--h --m</p>
                      </div>
                      <div>
                        <p className="text-[10px] admin-text-faint font-bold uppercase tracking-wider mb-1">Slot Code</p>
                        <p className="text-sm font-bold admin-text-faint">---</p>
                      </div>
                      <div className="col-span-2 lg:col-span-3 border-t admin-border pt-6 flex justify-between items-center">
                        <span className="text-[10px] admin-text-muted font-bold uppercase tracking-widest">PAYMENT STATUS</span>
                        <span className="text-[10px] font-bold admin-text-faint">Pending Lookup</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* History Log Block */}
                <div className="glass-card rounded-[1.5rem] p-6">
                  <h3 className="text-[11px] font-bold admin-text-muted uppercase tracking-widest mb-4">HISTORY LOG</h3>
                  {(() => {
                    const filteredLogs = exitSessionData?.feeBreakdown?.surchargeLogs?.filter(log => {
                      const lowerName = log.name.toLowerCase();
                      return lowerName.includes('overdue') || lowerName.includes('late') || lowerName.includes('early') || lowerName.includes('đến sớm');
                    }) || [];

                    if (filteredLogs.length > 0) {
                      return (
                        <div className="space-y-4 max-h-[180px] overflow-y-auto pr-2 scrollbar-thin">
                          {filteredLogs.map((log, index) => {
                            const lowerName = log.name.toLowerCase();
                            const isEarly = lowerName.includes('early') || lowerName.includes('đến sớm');
                            const isOverdue = lowerName.includes('late') || lowerName.includes('overdue');
                            
                            let textColorClass = 'admin-text';
                            if (isEarly) textColorClass = 'text-[#b45309] dark:text-orange-500';
                            else if (isOverdue) textColorClass = 'text-[#FF4C4C]';

                            return (
                              <div key={index} className="flex justify-between items-start pb-3 border-b border-dashed admin-border last:border-0">
                                <div>
                                  <div className={`text-xs font-bold mb-1 ${textColorClass}`}>{log.name}</div>
                                  <div className="text-[9px] admin-text-faint font-medium">
                                    {new Date(log.timestamp).toLocaleDateString('vi-VN')} {new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                                <div className="text-xs font-black admin-text">
                                  + {log.amount.toLocaleString('vi-VN')} ₫
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    } else {
                      return (
                        <div className="border admin-border admin-bg-surface rounded-xl py-10 flex items-center justify-center">
                          <span className="text-xs font-medium admin-text-faint">No history logs available</span>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="flex flex-col gap-6 h-full">
                {/* Camera Block */}
                <div className="glass-card rounded-[1.5rem] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold admin-text-muted uppercase tracking-widest">LIVE CAMERAS</span>
                    <span
                      onClick={() => setIsExitCameraOff(!isExitCameraOff)}
                      className={`text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-md cursor-pointer transition-colors ${isExitCameraOff
                        ? 'bg-red-500/20 text-red-500 border border-red-500/30'
                        : 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                        }`}
                    >
                      {isExitCameraOff ? 'TURN ON CAMS' : 'TURN OFF CAMS'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* LPR Camera */}
                    <div className="relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center border-2 border-black shadow-inner group">
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-20 bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
                        <span className={`w-1.5 h-1.5 rounded-full ${isExitCameraOff ? 'bg-stone-500' : 'bg-red-500 animate-pulse'}`}></span>
                        <span className={`text-[8px] font-mono font-bold tracking-wider ${isExitCameraOff ? 'text-stone-500' : 'text-[#fff]'}`}>LPR-CAM</span>
                      </div>
                      <div className="relative z-10 w-full h-full">
                        {!isExitCameraOff ? (
                          <CameraCapture
                            onSuccess={handleExitCameraResult}
                            onCancel={() => { }}
                            token={token}
                            inline
                            className="w-full h-full rounded-lg object-cover"
                            mode="lpr"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-stone-500">
                            <Camera className="w-5 h-5 mb-1 opacity-20" />
                            <span className="text-[8px] font-bold uppercase tracking-widest opacity-50">Offline</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* QR Scanner */}
                    <div className="relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center border-2 border-black shadow-inner group">
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-20 bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
                        <span className={`w-1.5 h-1.5 rounded-full ${isExitCameraOff ? 'bg-stone-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                        <span className={`text-[8px] font-mono font-bold tracking-wider ${isExitCameraOff ? 'text-stone-500' : 'text-[#fff]'}`}>QR-CAM</span>
                      </div>
                      <div className="relative z-10 w-full h-full">
                        {!isExitCameraOff ? (
                          <CameraCapture
                            onSuccess={() => { }}
                            onCancel={() => { }}
                            token={token}
                            inline
                            className="w-full h-full rounded-lg object-cover"
                            mode="qr"
                            onQrSuccess={handleQrExitSuccess}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-stone-500">
                            <Camera className="w-5 h-5 mb-1 opacity-20" />
                            <span className="text-[8px] font-bold uppercase tracking-widest opacity-50">Offline</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Block */}
                <div className="glass-card rounded-[1.5rem] p-6 flex flex-col flex-1">
                  <h3 className="text-[11px] font-bold admin-text-muted uppercase tracking-widest mb-6">BALANCE DUE</h3>

                  <div className="text-5xl font-black admin-text-faint mb-8 tracking-tighter flex items-start gap-1">
                    <span className={exitSessionData ? "admin-text" : ""}>
                      {exitSessionData ? (exitSessionData.amountDue ?? exitSessionData.estimatedFee).toLocaleString('en-US') : '0'}
                    </span>
                    <span className="text-3xl admin-text-faint mt-1">VND</span>
                  </div>

                  <div className="space-y-4 mb-8">
                    {(() => {
                      const baseFeeVal = exitSessionData?.prePaidAmount || 0;
                      const dynamicFeeVal = exitSessionData ? ((exitSessionData.estimatedFee || 0) - (exitSessionData.penaltyFee || 0) - baseFeeVal) : 0;
                      const isReservation = baseFeeVal > 0;
                      return (
                        <>
                          {isReservation && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-bold admin-text-muted">Base Fee</span>
                              <span className="font-bold admin-text-muted">
                                {baseFeeVal.toLocaleString('en-US')} VND
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-bold admin-text-muted">{isReservation ? 'Overtime Fee' : 'Parking Fee'}</span>
                            <span className="font-bold admin-text-muted">
                              {Math.max(0, dynamicFeeVal).toLocaleString('en-US')} VND
                            </span>
                          </div>
                        </>
                      );
                    })()}
                    {!!exitSessionData?.penaltyFee && exitSessionData.penaltyFee > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-[#FF4C4C]">Penalty Fee (Exception)</span>
                        <span className="font-bold text-[#FF4C4C]">
                          {exitSessionData.penaltyFee.toLocaleString('en-US')} VND
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto space-y-3">
                    {payOsQrCode && (
                      <div className="flex flex-col items-center justify-center p-4 border admin-border rounded-xl mb-4 bg-white dark:bg-[#18181B]">
                        <p className="text-[10px] font-bold text-[#FF4C4C] mb-3 uppercase tracking-widest text-center">Scan to Pay via Bank</p>
                        <div className="bg-white p-2 rounded-xl">
                          <QRCodeSVG value={payOsQrCode} size={160} level="M" includeMargin={true} />
                        </div>
                        <p className="text-xs text-center mt-3 font-medium admin-text-muted">Waiting for payment...</p>
                        <button
                          type="button"
                          onClick={() => {
                            setPayOsQrCode(null);
                            setPayOsOrderCode(null);
                          }}
                          className="mt-3 text-[10px] font-bold text-red-500 hover:underline tracking-widest uppercase"
                        >
                          Cancel QR
                        </button>
                      </div>
                    )}

                    {!payOsQrCode && !isPayOsPaid && (
                      <button
                        type="button"
                        onClick={handleGeneratePayOsQr}
                        disabled={!exitSessionData || exitSessionData.estimatedFee <= 0 || payOsLoading}
                        className="w-full h-14 flex items-center justify-center gap-2 rounded-xl border admin-border admin-bg-surface hover:admin-bg-surface/10 disabled:opacity-40 text-sm font-bold text-[#FF4C4C] transition-colors shadow-sm"
                      >
                        {payOsLoading ? <Loader className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
                        Generate QR (PayOS)
                      </button>
                    )}

                    {!payOsQrCode && !isPayOsPaid && exitSessionData && exitSessionData.estimatedFee > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsCashReceived(!isCashReceived)}
                        className={`w-full h-12 mt-2 mb-2 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                          isCashReceived
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-stone-50 dark:bg-white/5 border admin-border admin-text-muted hover:admin-bg-surface/10'
                        }`}
                      >
                        {isCashReceived ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-5 h-5 rounded-full border-2 border-current opacity-50" />}
                        {isCashReceived ? 'Cash Received Confirmed' : 'Mark as Cash Received'}
                      </button>
                    )}

                    {isPayOsPaid && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl p-3 mb-2 text-center text-xs font-bold flex flex-col items-center justify-center gap-1">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Payment Received via PayOS</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCollectAndOpen(isPayOsPaid ? 1 : 0)}
                      disabled={
                        !exitSessionData || 
                        payOsLoading || 
                        !!payOsQrCode || 
                        (!isPayOsPaid && exitSessionData.estimatedFee > 0 && !isCashReceived)
                      }
                      className="w-full flex items-center justify-center gap-2 h-14 rounded-xl bg-[#FF4C4C] hover:bg-[#E13B3B] disabled:opacity-40 text-sm font-bold text-white transition-colors shadow-sm"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      {exitSessionData?.estimatedFee === 0 ? 'Process & Release' : (isPayOsPaid ? 'Process & Release (PayOS)' : 'Process & Release (Cash)')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openExceptionModal('manual-open')}
                      className="w-full h-14 rounded-xl border admin-border admin-bg-surface hover:admin-bg-surface/10 text-xs font-bold admin-text-muted uppercase tracking-widest transition-colors"
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
          <div className="admin-bg-surface rounded-2xl w-[900px] max-w-[90vw] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border admin-border">
            <div className="p-5 border-b flex justify-between items-center admin-bg-base">
              <div>
                <h3 className="text-xl font-bold admin-text">Available Slots Map</h3>
                <p className="text-xs admin-text-muted mt-1">Manually select a slot (only showing available slots)</p>
              </div>
              <button
                onClick={() => setShowMap(false)}
                className="rounded-xl p-2 hover:bg-white/10 transition-colors"
              >
                <X size={20} className="admin-text-muted" />
              </button>
            </div>
            <div className="p-6 overflow-auto admin-bg-base flex-1">
              {loadingSlots ? (
                <div className="py-12 text-center text-sm font-bold admin-text-faint">Loading map...</div>
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
                        className={`h-12 flex flex-col items-center justify-center rounded-xl border text-[10px] font-bold transition-all ${isSelected
                          ? 'bg-[#FF4C4C] border-[#FF4C4C] text-[#fff] shadow-md'
                          : 'admin-bg-base admin-border admin-text-muted hover:border-[#FF4C4C] hover:text-[#FF4C4C]'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4">
          <style>{`
            .ticket-mask {
              --r: 20px;
              -webkit-mask-image: 
                radial-gradient(circle at 0 0, transparent calc(var(--r) - 0.5px), black var(--r)),
                radial-gradient(circle at 100% 0, transparent calc(var(--r) - 0.5px), black var(--r)),
                radial-gradient(circle at 0 100%, transparent calc(var(--r) - 0.5px), black var(--r)),
                radial-gradient(circle at 100% 100%, transparent calc(var(--r) - 0.5px), black var(--r));
              -webkit-mask-size: 51% 51%;
              -webkit-mask-position: top left, top right, bottom left, bottom right;
              -webkit-mask-repeat: no-repeat;
            }
          `}</style>
          
          <div className="relative w-full max-w-[320px] animate-fade-in-up flex flex-col items-center">
            
            <div className="w-full flex flex-col drop-shadow-[0_15px_30px_rgba(0,0,0,0.2)]">
              
              {/* TOP TICKET */}
              <div className="ticket-mask w-full pt-10 pb-8 px-6 flex flex-col items-center relative z-10 bg-white">
                
                {/* Red Border */}
                <div className="absolute inset-[8px] border-[2.5px] border-[#ef4444] rounded-[10px] pointer-events-none"></div>

                <div className="z-10 flex flex-col items-center w-full justify-center px-4">
                  <h3 className="text-[#ef4444] font-black text-[3.25rem] uppercase tracking-tighter leading-none mb-1">Park</h3>
                  <h3 className="text-[#ef4444] font-black text-[3.25rem] uppercase tracking-widest leading-none mb-8">Ticket</h3>
                  
                  <div className="w-full flex justify-between items-center mb-6">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-[#ef4444]/60 uppercase tracking-widest">Plate</span>
                      <span className="text-xl font-black text-stone-800">{checkInResultData.licensePlate}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[9px] font-bold text-[#ef4444]/60 uppercase tracking-widest">Type</span>
                      <span className="text-lg font-bold text-stone-700">{checkInResultData.vehicleTypeName}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center w-full">
                    <span className="text-[9px] font-bold text-[#ef4444]/60 uppercase tracking-widest">Location</span>
                    <span className="text-2xl font-black text-stone-800">Floor {checkInResultData.floorName}</span>
                    <span className="text-sm font-bold text-stone-600">{checkInResultData.buildingName}</span>
                  </div>
                </div>
              </div>

              {/* DIVIDER */}
              <div className="w-full h-0 relative flex justify-center items-center z-20">
                <div className="w-full border-t-[5px] border-dotted border-[#ef4444]/40 mx-[24px]"></div>
              </div>

              {/* BOTTOM TICKET */}
              <div className="ticket-mask w-full pt-6 pb-8 px-6 flex flex-col items-center relative z-10 bg-white">
                
                {/* Red Border */}
                <div className="absolute inset-[8px] border-[2.5px] border-[#ef4444] rounded-[10px] pointer-events-none"></div>

                <div className="z-10 flex flex-row w-full justify-between items-center h-full px-2 mt-2">
                  {checkInResultData.sessionQrCodeBase64 && (
                    <img 
                      src={`data:image/png;base64,${checkInResultData.sessionQrCodeBase64}`} 
                      alt="Session QR" 
                      className="w-[160px] h-[160px] object-contain"
                    />
                  )}
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] font-bold text-[#ef4444]/60 uppercase tracking-widest mb-0.5">Slot</span>
                    <span className="text-3xl font-black text-[#ef4444] tracking-tighter leading-none">{checkInResultData.slotNumber}</span>
                    <span className="text-[9px] font-bold text-[#ef4444]/60 uppercase tracking-widest mt-2">ID: {checkInResultData.sessionCode}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Print & Close Button */}
            <button
              onClick={() => setCheckInResultData(null)}
              className="mt-8 px-8 py-3.5 rounded-full font-black text-sm bg-white hover:bg-stone-100 text-[#ef4444] shadow-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Printer size={16} />
              Print & Close
            </button>
            
          </div>
        </div>
      )}

    </div>
  );
}