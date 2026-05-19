import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  DoorOpen,
  LogOut,
  TicketX,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import CameraCapture from '../components/CameraCapture';
import type { ScanPlateResponse, ScanAndCheckInResponse } from '../services/ocrService';
import { scanAndCheckIn } from '../services/ocrService';
import { useAuth } from '../hooks/useAuth';

type VehicleType = 'car' | 'motorbike' | 'ev';

type SessionSummary = {
  duration: string;
  fee: number;
};

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
    tone: 'border-amber-500 text-amber-300',
  },
  incident: {
    title: 'Report Incident',
    description: 'Capture an incident log for vehicle disputes, equipment faults, or safety issues.',
    confirmLabel: 'Log Incident',
    tone: 'border-red-500 text-red-300',
  },
  'lost-ticket': {
    title: 'Lost Ticket Handling',
    description: 'Use the override flow to process vehicles that cannot present a valid ticket.',
    confirmLabel: 'Apply Override',
    tone: 'border-slate-500 text-slate-300',
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
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
      : kind === 'error'
        ? 'border-red-500/40 bg-red-500/10 text-red-200'
        : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200';

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${tone}`}>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${copy.tone}`}>Exception flow</p>
            <h3 className="mt-2 text-2xl font-bold text-white">{copy.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            Close
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-400">{copy.description}</p>

        <label className="mt-6 block text-sm font-medium text-slate-300">Operator note</label>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Enter a short note for the audit trail..."
          rows={4}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400"
        />

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(note)}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90"
          >
            {copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GateControlPage() {
  const [entryLicensePlate, setEntryLicensePlate] = useState('');
  const [entryVehicleType, setEntryVehicleType] = useState<VehicleType>('car');
  const [exitLicensePlate, setExitLicensePlate] = useState('');
  const [exitSessionData, setExitSessionData] = useState<SessionSummary | null>(null);
  const [notification, setNotification] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
  const [exceptionAction, setExceptionAction] = useState<ExceptionAction | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [currentCameraMode, setCurrentCameraMode] = useState<'entry' | 'exit'>('entry');
  const [vehicleTypeMap, setVehicleTypeMap] = useState<Record<string, string>>({});

  const { token } = useAuth();

  const entryInputRef = useRef<HTMLInputElement>(null);
  const exitInputRef = useRef<HTMLInputElement>(null);

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

  const handleConfirmEntry = () => {
    if (!entryLicensePlate.trim()) {
      showNotification('error', 'Please enter a license plate for entry.');
      return;
    }

    showNotification('success', `Entry confirmed for ${entryLicensePlate} (${entryVehicleType}).`);
    setEntryLicensePlate('');
    setEntryVehicleType('car');
    entryInputRef.current?.focus();
  };

  const handleSearchExit = () => {
    if (!exitLicensePlate.trim()) {
      showNotification('error', 'Please enter a license plate for exit lookup.');
      return;
    }

    const durationHours = Math.floor(Math.random() * 5) + 1;
    const durationMinutes = Math.floor(Math.random() * 60);
    const fee = Number((Math.random() * 50 + 10).toFixed(2));

    setExitSessionData({
      duration: `${durationHours}h ${durationMinutes}m`,
      fee,
    });
    showNotification('info', `Session loaded for ${exitLicensePlate}.`);
  };

  const handleCollectAndOpen = () => {
    if (!exitSessionData) {
      showNotification('error', 'No active session found for this vehicle.');
      return;
    }

    showNotification('success', `Payment collected: $${exitSessionData.fee.toFixed(2)}. Barrier opening.`);
    setExitLicensePlate('');
    setExitSessionData(null);
    exitInputRef.current?.focus();
  };

  const openExceptionModal = (action: ExceptionAction) => {
    setExceptionAction(action);
    setExceptionModalOpen(true);
  };

  const handleCameraResult = async (result: ScanPlateResponse, imageBase64: string) => {
    if (currentCameraMode === 'entry') {
      // If we have a mapping for vehicle type, try scan-and-checkin to get full flow
      const vtKey = entryVehicleType;
      const vtId = vehicleTypeMap[vtKey.toLowerCase()];

      if (vtId) {
        try {
          const checkinRes: ScanAndCheckInResponse = await scanAndCheckIn(imageBase64, vtId, token);
          setEntryLicensePlate(checkinRes.licensePlate);
          showNotification(
            'success',
            `Detected: ${checkinRes.licensePlate} (Confidence: ${(checkinRes.confidence * 100).toFixed(1)}%)`
          );
        } catch (err) {
          // fallback to basic scan result
          setEntryLicensePlate(result.licensePlate);
          showNotification(
            'info',
            `Detected (scan only): ${result.licensePlate} - ${err instanceof Error ? err.message : ''}`
          );
        }
      } else {
        setEntryLicensePlate(result.licensePlate);
        showNotification(
          'success',
          `Detected: ${result.licensePlate} (Confidence: ${(result.confidence * 100).toFixed(1)}%)`
        );
      }
      entryInputRef.current?.focus();
    } else {
      setExitLicensePlate(result.licensePlate);
      showNotification(
        'success',
        `Detected: ${result.licensePlate} (Confidence: ${(result.confidence * 100).toFixed(1)}%)`
      );
      exitInputRef.current?.focus();
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F1') {
        event.preventDefault();
        handleConfirmEntry();
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

  return (
    <div className="min-h-screen bg-[#08111F] text-white">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/15 p-2 text-emerald-400 ring-1 ring-emerald-400/20">
              <Zap className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold sm:text-xl">Gate Station #01</h1>
              <p className="text-xs text-slate-400 sm:text-sm">Live entry and exit control</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Manager Portal</span>
              <span className="sm:hidden">Back</span>
            </Link>
            <button
              type="button"
              onClick={() => showNotification('info', 'Logout action is not wired in this page yet.')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-2 lg:px-6 lg:py-8 xl:px-8">
        {notification ? (
          <div className="lg:col-span-2">
            <GateStatusBanner kind={notification.kind} message={notification.message} />
          </div>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/20 lg:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-emerald-300">Entry Gate</h2>
              <p className="mt-1 text-sm text-slate-400">Vehicle check-in and slot recommendation</p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Live OCR
            </span>
          </div>

          <div className="relative mb-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
            <button
              type="button"
              onClick={() => {
                setCurrentCameraMode('entry');
                setCameraOpen(true);
              }}
              className="flex aspect-video w-full items-center justify-center transition-colors hover:bg-slate-800"
            >
              <div className="flex flex-col items-center gap-3">
                <Camera className="h-16 w-16 text-emerald-400" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-300">Click to open camera</p>
              </div>
            </button>
            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/90 px-3 py-1.5 text-sm font-semibold text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              Ready to scan
            </div>
            <div className="absolute bottom-4 right-4 rounded-full bg-slate-950/90 px-3 py-1 text-xs text-slate-400">
              CAM-ENTRY-01
            </div>
          </div>

          <label className="mb-2 block text-sm font-semibold text-slate-300">License plate</label>
          <input
            ref={entryInputRef}
            type="text"
            value={entryLicensePlate}
            onChange={(event) => setEntryLicensePlate(event.target.value.toUpperCase())}
            placeholder="ABC-1234"
            className="h-16 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-center text-2xl font-bold tracking-[0.35em] text-white outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-400"
          />

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-4">
              <label className="block text-sm font-semibold text-slate-300">Vehicle type</label>
              <span className="text-xs text-slate-500">Keyboard: 1 / 2 / 3</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {VEHICLE_TYPES.map((vehicle) => {
                const selected = entryVehicleType === vehicle.type;

                return (
                  <button
                    key={vehicle.type}
                    type="button"
                    onClick={() => setEntryVehicleType(vehicle.type)}
                    className={`relative rounded-2xl border px-4 py-4 text-sm font-semibold transition-all ${
                      selected
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200 shadow-lg shadow-emerald-500/10'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <span className="absolute right-2 top-2 rounded-md bg-slate-950/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                      {vehicle.key}
                    </span>
                    {vehicle.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Zap className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              AI recommendation
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-300">Floor B2 - Zone A</div>
            <p className="mt-1 text-sm text-slate-400">12 available slots • Closest to elevator</p>
          </div>

          <button
            type="button"
            onClick={handleConfirmEntry}
            className="mt-6 inline-flex h-16 w-full items-center justify-center rounded-2xl bg-emerald-500 text-xl font-bold text-white transition-colors hover:bg-emerald-600"
          >
            CONFIRM ENTRY
          </button>
          <p className="mt-2 text-center text-xs text-slate-500">Shortcut: F1</p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/20 lg:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-sky-300">Exit Gate</h2>
              <p className="mt-1 text-sm text-slate-400">Vehicle check-out and payment collection</p>
            </div>
            <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
              Payment ready
            </span>
          </div>

          <div className="relative mb-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
            <button
              type="button"
              onClick={() => {
                setCurrentCameraMode('exit');
                setCameraOpen(true);
              }}
              className="flex aspect-video w-full items-center justify-center transition-colors hover:bg-slate-800"
            >
              <div className="flex flex-col items-center gap-3">
                <Camera className="h-16 w-16 text-sky-400" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-300">Click to open camera</p>
              </div>
            </button>
            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-sky-500/90 px-3 py-1.5 text-sm font-semibold text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              Ready to scan
            </div>
            <div className="absolute bottom-4 right-4 rounded-full bg-slate-950/90 px-3 py-1 text-xs text-slate-400">
              CAM-EXIT-01
            </div>
          </div>

          <label className="mb-2 block text-sm font-semibold text-slate-300">License plate</label>
          <div className="flex gap-3">
            <input
              ref={exitInputRef}
              type="text"
              value={exitLicensePlate}
              onChange={(event) => setExitLicensePlate(event.target.value.toUpperCase())}
              placeholder="ABC-1234"
              className="h-16 min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-900 px-4 text-center text-2xl font-bold tracking-[0.35em] text-white outline-none transition-colors placeholder:text-slate-600 focus:border-sky-400"
            />
            <button
              type="button"
              onClick={handleSearchExit}
              className="h-16 rounded-2xl bg-sky-500 px-6 text-sm font-bold text-white transition-colors hover:bg-sky-600"
            >
              Search
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">
            Press <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-slate-300">F2</span> to focus
          </p>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5">
            {exitSessionData ? (
              <>
                <div>
                  <p className="text-sm text-slate-400">Duration</p>
                  <p className="mt-1 text-xl font-bold text-white">{exitSessionData.duration}</p>
                </div>
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="text-sm text-slate-400">Total fee</p>
                  <p className="mt-2 text-5xl font-bold text-emerald-300">${exitSessionData.fee.toFixed(2)}</p>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-slate-500">
                Enter a license plate to view payment details.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleCollectAndOpen}
            disabled={!exitSessionData}
            className="mt-6 inline-flex h-16 w-full items-center justify-center rounded-2xl bg-sky-500 text-xl font-bold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            COLLECT & OPEN BARRIER
          </button>
          <p className="mt-2 text-center text-xs text-slate-500">Shortcut: Enter while the exit field is focused</p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/20 lg:col-span-2 lg:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <button
              type="button"
              onClick={() => openExceptionModal('manual-open')}
              className="inline-flex items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-500/20"
            >
              <DoorOpen className="mr-2 h-4 w-4" aria-hidden="true" />
              Manual Gate Open
            </button>
            <button
              type="button"
              onClick={() => openExceptionModal('incident')}
              className="inline-flex items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/20"
            >
              <AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />
              Report Incident
            </button>
            <button
              type="button"
              onClick={() => openExceptionModal('lost-ticket')}
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <TicketX className="mr-2 h-4 w-4" aria-hidden="true" />
              Lost Ticket
            </button>
          </div>
        </section>
      </main>

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

      {cameraOpen && (
        <CameraCapture
          onSuccess={handleCameraResult}
          onCancel={() => setCameraOpen(false)}
          token={token}
        />
      )}
    </div>
  );
}