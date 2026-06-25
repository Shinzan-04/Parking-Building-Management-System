import { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Car,
  Bike,
  Calendar,
  Clock,
  Layers,
  LayoutGrid,
  ParkingSquare,
  CheckCircle2,
  ClipboardList,
  Building2,
  Loader2,
  Sparkles,
  ChevronDown,
  Sun,
  Moon,
  User,
  LogOut,
} from 'lucide-react';
import { getVehicleTypes } from '../../services/vehicleTypesService';
import { getAllPolicies, getPolicyByVehicleType } from '../../services/pricingService';
import type { PricingPolicyResponse } from '../../services/pricingService';
import { getFloorsByBuilding, getBuildings } from '../../services/buildingsService';
import type { FloorResponse } from '../../services/buildingsService';
import { getAvailableSlotsByVehicleType, getRecommendedSlots, getSlotsByFloor, getAvailableSlotsByFloor } from '../../services/parkingService';
import type { ParkingSlotDetail } from '../../services/parkingService';
import { createReservation, getAiSuggestions } from '../../services/reservationsService';
import { createPayOSPayment, verifyPayment } from '../../services/paymentService';
import { getMyVehicles, createVehicle } from '../../services/vehiclesService';
import type { VehicleResponse } from '../../services/vehiclesService';
import { getWallet, depositWallet } from '../../services/walletService';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import DatePickerModal from '../../components/DatePickerModal';
import TimePickerModal from '../../components/TimePickerModal';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ParkingLot {
  id: string;
  name: string;
  address: string;
  pricePerHour: number;
}

interface WizardState {
  vehicleType: string | null;
  licensePlate: string;
  entryDate: string;
  entryTime: string;
  exitDate: string;
  exitTime?: string;
  duration: number; // hours
  floor: string | null;
  slot: string | null;
  slotId: string | null;
  zone: string | null;
  bookingMethod: number; // 0 = Manual, 1 = AIRecommended
}

interface BookingWizardProps {
  lot: ParkingLot;
  onClose: () => void;
}

// ─────────────────────────────────────────────
// Step definitions
// ─────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Vehicle Type', short: 'Vehicle' },
  { id: 2, label: 'License Plate', short: 'Plate' },
  { id: 3, label: 'Date & Time', short: 'Time' },
  { id: 4, label: 'Select Floor', short: 'Floor' },
  { id: 5, label: 'Select Slot', short: 'Slot' },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const formatCurrency = (n: number) => n.toLocaleString('vi-VN') + 'đ';

const getLocalDateStr = (d: Date = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const todayDateStr = () => {
  return getLocalDateStr(new Date());
};

const nowTimeStr = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// ─────────────────────────────────────────────
// Sub-components for each step
// ─────────────────────────────────────────────

// Step 1 – Vehicle Type
interface ApiVehicleType {
  id: string;
  name: string;
  description?: string;
  hourlyRate: number;
}

function StepVehicleType({
  state,
  setState,
  vehicles,
  loading,
  policy,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  vehicles: ApiVehicleType[];
  loading: boolean;
  policy: PricingPolicyResponse | null;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={32} className="text-[#FF4C4C] animate-spin" />
        <p className="text-sm text-stone-500">Loading vehicle types...</p>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Car size={48} className="text-stone-300 mb-3" />
        <p className="text-sm text-stone-500 font-bold">No vehicle types found</p>
        <p className="text-xs text-stone-400">Please check the system configuration.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 border border-[#FF4C4C]/25 flex items-center justify-center">
          <Car size={20} className="text-[#FF4C4C]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-stone-900 dark:text-white transition-colors">Select Vehicle Type</h2>
          <p className="text-xs text-stone-500">Step 1 of 6 — Choose your vehicle category</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {vehicles.map((v) => {
          const selected = state.vehicleType === v.id;
          const isMotorbike = v.name.toLowerCase().includes('moto') ||
            v.name.toLowerCase().includes('xe máy') ||
            v.name.toLowerCase().includes('bike') ||
            v.name.toLowerCase().includes('xe hai bánh');
          const Icon = isMotorbike ? Bike : Car;

          return (
            <button
              key={v.id}
              onClick={() => setState((s) => ({ ...s, vehicleType: v.id }))}
              className={`flex-1 flex flex-col items-center gap-5 py-8 rounded-2xl border-2 transition-all duration-200 group ${selected
                ? 'bg-[#FF4C4C]/5 border-[#FF4C4C] shadow-sm shadow-[#FF4C4C]/10'
                : 'bg-white dark:bg-[#18181B] border-gray-200/80 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-300 dark:hover:border-white/20'
                }`}
            >
              {/* Icon container */}
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200 ${selected
                  ? 'bg-[#FF4C4C]/10 border-2 border-[#FF4C4C]/30'
                  : 'bg-gray-100 dark:bg-white/5 border-2 border-gray-200/60 dark:border-white/10 group-hover:bg-[#FF4C4C]/10 group-hover:border-[#FF4C4C]/20'
                  }`}
              >
                <Icon
                  size={32}
                  strokeWidth={1.5}
                  className={`transition-colors duration-200 ${selected ? 'text-[#FF4C4C]' : 'text-stone-400 group-hover:text-[#FF4C4C]'
                    }`}
                />
              </div>

              <div className="text-center px-4">
                <p
                  className={`font-bold text-sm ${selected ? 'text-[#FF4C4C]' : 'text-stone-800 dark:text-stone-200'
                    }`}
                >
                  {v.name}
                </p>
                {v.description && (
                  <p className="text-[10px] text-stone-400 mt-0.5 line-clamp-1 font-medium">
                    {v.description}
                  </p>
                )}

              </div>

              {selected && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#FF4C4C]">
                    <CheckCircle2 size={14} className="text-[#FF4C4C]" />
                    Selected
                  </div>
                  {policy && (
                    <div className="flex flex-col items-center gap-1 text-[11px] text-stone-500 bg-white px-3 py-2 rounded-xl border border-[#FF4C4C]/20 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <span>Ngày: <strong className="text-stone-700">{formatCurrency(policy.dayBlockRate)}</strong>/block</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>Đêm: <strong className="text-stone-700">{formatCurrency(policy.nightBlockRate)}</strong>/block</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Step 2 – License Plate
function StepLicensePlate({
  state,
  setState,
  vehicles,
  myVehicles,
  loadingMyVehicles,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  vehicles: ApiVehicleType[];
  myVehicles: VehicleResponse[];
  loadingMyVehicles: boolean;
}) {
  const selectedVehicle = vehicles.find((v) => v.id === state.vehicleType);
  const isMotorbike = selectedVehicle?.name.toLowerCase().includes('moto') ||
    selectedVehicle?.name.toLowerCase().includes('xe máy') ||
    selectedVehicle?.name.toLowerCase().includes('bike') ||
    selectedVehicle?.name.toLowerCase().includes('xe hai bánh') ||
    false;
  const VehicleIcon = isMotorbike ? Bike : Car;
  const vehicleLabel = selectedVehicle?.name || 'Car';
  const placeholder = isMotorbike ? '59T1-12345' : '51A-12345';

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Tự động chọn xe mặc định nếu có (chỉ chạy 1 lần khi load xong xe)
  useEffect(() => {
    if (myVehicles.length > 0 && !state.licensePlate) {
      const defaultVehicle = myVehicles.find(v => v.isPrimary) || myVehicles[0];
      setState(s => ({
        ...s,
        licensePlate: defaultVehicle.plateNumber,
        vehicleType: defaultVehicle.vehicleTypeId,
      }));
    }
  }, [myVehicles, state.licensePlate, setState]);

  return (
    <div className="flex flex-col gap-6">
      {/* Step header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 border border-[#FF4C4C]/25 flex items-center justify-center">
          <ParkingSquare size={20} className="text-[#FF4C4C]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-stone-900 dark:text-white transition-colors">Enter License Plate</h2>
          <p className="text-xs text-stone-500">
            Step 2 of 6 — Your vehicle's identification number
          </p>
        </div>
      </div>

      {/* Loading state for vehicles */}
      {loadingMyVehicles && myVehicles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <Loader2 size={24} className="text-[#FF4C4C] animate-spin" />
          <p className="text-xs text-stone-400 font-semibold">Đang tải danh sách xe...</p>
        </div>
      )}

      {!loadingMyVehicles && (
        <div className="flex flex-col gap-6">
          {/* Saved vehicles dropdown */}
          {myVehicles.length > 0 && (
            <div className="relative z-10 w-full max-w-sm mx-auto" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-[#18181B] border-2 border-[#FF4C4C]/30 hover:border-[#FF4C4C]/60 transition-all duration-200 shadow-sm shadow-[#FF4C4C]/5"
              >
                {(() => {
                  const selectedV = myVehicles.find(v => v.plateNumber === state.licensePlate);
                  if (selectedV) {
                    const lowerName = selectedV.vehicleTypeName?.toLowerCase() || '';
                    const isMotor = lowerName.includes('moto') || lowerName.includes('xe máy') || lowerName.includes('bike');
                    const Icon = isMotor ? Bike : Car;
                    return (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 text-[#FF4C4C] flex items-center justify-center">
                          <Icon size={20} strokeWidth={1.5} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black tracking-wider text-[#FF4C4C]">{selectedV.plateNumber}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] text-stone-800 dark:text-stone-300 font-bold uppercase tracking-wider">{selectedV.vehicleTypeName || 'Phương tiện'}</p>
                            {selectedV.isPrimary && (
                              <span className="bg-amber-500/10 text-amber-600 text-[9px] font-bold px-1.5 py-0.5 rounded-sm">Mặc định</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 text-stone-400 flex items-center justify-center transition-colors">
                        <Car size={20} strokeWidth={1.5} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black tracking-wider text-stone-800 dark:text-white transition-colors">Xe khác (Nhập thủ công)</p>
                      </div>
                    </div>
                  );
                })()}
                <ChevronDown size={18} className={`text-stone-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showDropdown && (
                <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white dark:bg-[#18181B] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="max-h-[220px] overflow-y-auto scrollbar-thin flex flex-col p-2 gap-1">
                    {myVehicles.map(v => {
                      const isSelected = state.licensePlate === v.plateNumber;
                      const lowerName = v.vehicleTypeName?.toLowerCase() || '';
                      const isMotor = lowerName.includes('moto') || lowerName.includes('xe máy') || lowerName.includes('bike');
                      const Icon = isMotor ? Bike : Car;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setState(s => ({
                              ...s,
                              licensePlate: v.plateNumber,
                              vehicleType: v.vehicleTypeId,
                            }));
                            setShowDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl transition-colors ${isSelected ? 'bg-red-50/50 dark:bg-[#FF4C4C]/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-[#FF4C4C]/10 text-[#FF4C4C]' : 'bg-gray-100 dark:bg-white/5 text-stone-400'}`}>
                              <Icon size={16} strokeWidth={1.5} />
                            </div>
                            <div className="text-left">
                              <p className={`text-xs font-black tracking-wider ${isSelected ? 'text-[#FF4C4C]' : 'text-stone-800 dark:text-white'}`}>{v.plateNumber}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[9px] text-stone-500 font-bold uppercase">{v.vehicleTypeName || 'Phương tiện'}</p>
                                {v.isPrimary && (
                                  <span className="bg-amber-500/10 text-amber-600 text-[8px] font-bold px-1 rounded-sm">Mặc định</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 size={14} className="text-[#FF4C4C]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Vehicle type display */}
          <div className="flex flex-col items-center gap-3 mt-2">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-white/5 border-2 border-gray-200/60 dark:border-white/10 flex items-center justify-center transition-colors">
              <VehicleIcon
                size={40}
                strokeWidth={1.5}
                className="text-[#FF4C4C]"
              />
            </div>
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">{vehicleLabel}</span>
          </div>

          {/* License plate input */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-full max-w-sm">
              <input
                type="text"
                placeholder={placeholder}
                value={state.licensePlate}
                onChange={(e) =>
                  setState((s) => ({ ...s, licensePlate: e.target.value.toUpperCase() }))
                }
                maxLength={12}
                className="w-full bg-gray-50 dark:bg-white/5 border-2 border-gray-200/80 dark:border-white/10 focus:border-[#FF4C4C] rounded-2xl px-6 py-4 text-stone-800 dark:text-white text-2xl font-black text-center tracking-[0.25em] placeholder-stone-300 dark:placeholder-stone-600 outline-none transition-all duration-200 shadow-sm focus:shadow-md focus:shadow-[#FF4C4C]/5"
              />
            </div>

            {/* Format hint */}
            <div className="text-center space-y-1">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Format:{' '}
                <span className="text-stone-700 dark:text-stone-200 font-bold">51A-12345</span>{' '}
                (car) or{' '}
                <span className="text-stone-700 dark:text-stone-200 font-bold">59T1-12345</span>{' '}
                (motorcycle)
              </p>
              <p className="text-xs text-stone-400 dark:text-stone-500">
                This will be linked to your parking session.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hàm tính chi phí ước tính dùng chung ──
export function computeEstimatedCostHelper(
  state: WizardState,
  vehicles: ApiVehicleType[],
  policy: PricingPolicyResponse | null
): { total: number; isCapped: boolean; breakdown: string; blocksDetails?: { startTime: string; endTime: string; isNight: boolean; price: number }[] } {
  const selectedVehicle = vehicles.find((v) => v.id === state.vehicleType);
  if (!selectedVehicle) return { total: 0, isCapped: false, breakdown: '' };

  if (policy && policy.blockDurationHours > 0) {
    const blocksRequired = Math.ceil(state.duration / policy.blockDurationHours);
    const [h, m] = (state.entryTime || '00:00').split(':').map(Number);
    let currentHour = h + m / 60;

    let dayBlocks = 0;
    let nightBlocks = 0;

    const blocksDetails: { startTime: string; endTime: string; isNight: boolean; price: number }[] = [];
    let currentDate = new Date(`${state.entryDate || todayDateStr()}T${state.entryTime || '00:00'}:00`);

    for (let i = 0; i < blocksRequired; i++) {
      let currentHourDec = currentDate.getHours() + currentDate.getMinutes() / 60;
      const isNight = policy.nightStartHour <= policy.nightEndHour
        ? (currentHourDec >= policy.nightStartHour && currentHourDec < policy.nightEndHour)
        : (currentHourDec >= policy.nightStartHour || currentHourDec < policy.nightEndHour);

      const startTimeStr = `${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}`;
      currentDate = new Date(currentDate.getTime() + policy.blockDurationHours * 60 * 60 * 1000);
      const endTimeStr = `${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}`;

      const price = isNight ? policy.nightBlockRate : policy.dayBlockRate;
      blocksDetails.push({ startTime: startTimeStr, endTime: endTimeStr, isNight, price });

      if (isNight) nightBlocks++;
      else dayBlocks++;
    }

    const raw = (dayBlocks * policy.dayBlockRate) + (nightBlocks * policy.nightBlockRate);

    const days = Math.ceil(state.duration / 24) || 1;
    const maxAllowed = policy.dailyRate > 0 ? (days * policy.dailyRate) : raw;

    const capped = Math.min(raw, maxAllowed);
    const isCapped = raw > maxAllowed;

    const breakdownArr = [];
    if (dayBlocks > 0) breakdownArr.push(`${dayBlocks} Block Ngày (${policy.dayBlockRate.toLocaleString('vi-VN')}đ/bl)`);
    if (nightBlocks > 0) breakdownArr.push(`${nightBlocks} Block Đêm (${policy.nightBlockRate.toLocaleString('vi-VN')}đ/bl)`);
    const breakdown = breakdownArr.join(' + ');

    return { total: capped, isCapped, breakdown, blocksDetails };
  }

  // Fallback: dùng hourlyRate từ vehicle data
  const rate = selectedVehicle.hourlyRate;
  const raw = rate * state.duration;
  const dailyMax = policy?.dailyMaxRate ?? 0;
  const capped = dailyMax > 0 ? Math.min(raw, dailyMax) : raw;
  const isCapped = dailyMax > 0 && raw > dailyMax;
  return {
    total: capped,
    isCapped,
    breakdown: `${state.duration}h × ${rate.toLocaleString('vi-VN')}đ/h`,
  };
}

// Step 3 – Date & Time
function StepDateTime({
  state,
  setState,
  vehicles,
  policy,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  vehicles: ApiVehicleType[];
  policy: PricingPolicyResponse | null;
}) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isExitDatePickerOpen, setIsExitDatePickerOpen] = useState(false);
  const [isExitTimePickerOpen, setIsExitTimePickerOpen] = useState(false);
  const durations = [1, 2, 3, 4, 6, 8, 12, 24];

  const calculateDiffMins = (enD: string, enT: string, exD: string, exT: string) => {
    const entry = new Date(enD);
    const [enH, enM] = enT.split(':').map(Number);
    entry.setHours(enH, enM, 0, 0);

    const exit = new Date(exD);
    const [exH, exM] = exT.split(':').map(Number);
    exit.setHours(exH, exM, 0, 0);

    return (exit.getTime() - entry.getTime()) / (1000 * 60);
  };

  const exitInfo = useMemo(() => {
    if (!state.entryDate || !state.entryTime) return { time: '--:--', date: '--/--/----', rawDate: '' };
    
    let exTime = state.exitTime;
    let exDate = state.exitDate;

    if (!exTime || !exDate) {
      const entry = new Date(state.entryDate);
      const [h, m] = state.entryTime.split(':').map(Number);
      entry.setHours(h, m, 0, 0);
      
      const exit = new Date(entry.getTime() + state.duration * 60 * 60 * 1000);
      exTime = `${String(exit.getHours()).padStart(2, '0')}:${String(exit.getMinutes()).padStart(2, '0')}`;
      exDate = getLocalDateStr(exit);
    }

    const d = new Date(exDate);
    const displayDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    return { time: exTime!, date: displayDate, rawDate: exDate };
  }, [state.entryDate, state.entryTime, state.exitDate, state.exitTime, state.duration]);

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '--/--/----';
    const [y, mo, d] = dateStr.split('-');
    return `${d}/${mo}/${y}`;
  };

  const formatDateFancy = (dateStr: string) => {
    if (!dateStr) return 'Select Date';
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'long' });
    const year = d.getFullYear();
    return `${day} ${month}, ${year}`;
  };
  const costResult = computeEstimatedCostHelper(state, vehicles, policy);

  const durationOptions = policy && policy.blockDurationHours > 0
    ? [1, 2, 3, 4, 5, 6].map(b => b * policy.blockDurationHours)
    : durations;

  const totalBlocks = policy && policy.blockDurationHours > 0 ? Math.ceil(state.duration / policy.blockDurationHours) : 1;

  return (
    <div className="flex flex-col gap-3">

      {/* Dates Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Arrival Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
            Arrival Date
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(true)}
              className="absolute inset-0 w-full h-full cursor-pointer z-10 opacity-0"
            />
            <div className="w-full bg-white dark:bg-[#18181B] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm transition-colors group-hover:border-gray-300 dark:group-hover:border-white/20">
              <span className="text-[14px] font-bold text-stone-800 dark:text-white transition-colors truncate pr-2">
                {state.entryDate ? formatDateFancy(state.entryDate) : 'Select Date'}
              </span>
              <ChevronDown size={16} className="text-stone-400 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Exit Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
            Exit Date
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExitDatePickerOpen(true)}
              className="absolute inset-0 w-full h-full cursor-pointer z-10 opacity-0"
            />
            <div className="w-full bg-white dark:bg-[#18181B] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm transition-colors group-hover:border-gray-300 dark:group-hover:border-white/20">
              <span className="text-[14px] font-bold text-stone-800 dark:text-white transition-colors truncate pr-2">
                {exitInfo.rawDate ? formatDateFancy(exitInfo.rawDate) : 'Select Date'}
              </span>
              <ChevronDown size={16} className="text-stone-400 flex-shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Times Row */}
      <div className="grid grid-cols-2 gap-3 mt-1">
        {/* Arrival Time */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
            Arrival Time
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTimePickerOpen(true)}
              className="absolute inset-0 w-full h-full cursor-pointer z-10 opacity-0"
            />
            <div className="w-full bg-white dark:bg-[#18181B] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm transition-colors group-hover:border-gray-300 dark:group-hover:border-white/20">
              <span className="text-[14px] font-bold text-stone-800 dark:text-white transition-colors">
                {state.entryTime || 'Select Time'}
              </span>
              <ChevronDown size={16} className="text-stone-400 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Exit Time (Duration Selector) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
            Exit Time
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExitTimePickerOpen(true)}
              className="absolute inset-0 w-full h-full cursor-pointer z-10 opacity-0"
            />
            <div className="w-full bg-white dark:bg-[#18181B] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm transition-colors cursor-pointer group-hover:border-gray-300 dark:group-hover:border-white/20">
              <span className="text-[14px] font-bold text-stone-800 dark:text-white transition-colors">
                {state.exitTime || exitInfo.time}
              </span>
              <ChevronDown size={16} className="text-stone-400 flex-shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Block Breakdown */}
      {costResult.total > 0 && costResult.blocksDetails && costResult.blocksDetails.length > 0 && (
        <div className="mt-2 border border-dashed border-gray-300 dark:border-white/10 rounded-xl p-3 bg-white/50 dark:bg-white/5">
          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2">
            Block Breakdown ({totalBlocks} Blocks)
          </p>
          <div className="flex flex-row flex-wrap gap-2">
            {costResult.blocksDetails.map((block, idx) => (
              <div key={idx} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm w-fit ${block.isNight ? 'bg-[#1A1E29] text-white' : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-gray-200 dark:border-white/10'}`}>
                {block.isNight ? <Moon size={13} className="text-stone-300" /> : <Sun size={13} className="text-orange-500" />}
                <span>{block.startTime} - {block.endTime} <span className={block.isNight ? 'text-stone-400 font-medium ml-0.5' : 'text-stone-500 dark:text-stone-400 font-bold ml-0.5'}>({block.price.toLocaleString('vi-VN')}đ)</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Your Parking */}
      <div className="mt-2 bg-[#E8F1FF] dark:bg-[#FF4C4C]/10 rounded-2xl p-4 border border-blue-100/60 dark:border-[#FF4C4C]/20 shadow-sm">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-widest mb-3">
              Your Parking
            </span>

            <div className="flex items-center gap-3 mt-1">
              <div className="flex flex-col items-start gap-1">
                <span className="text-3xl font-black text-blue-700 dark:text-white leading-none tracking-tight">{state.entryTime || '--:--'}</span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-semibold">{formatDateDisplay(state.entryDate)}</span>
              </div>

              <div className="flex flex-col items-center justify-center -mt-3 mx-1">
                <span className="text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">{state.duration}h</span>
                <div className="w-5 h-[2px] bg-blue-600 dark:bg-[#FF4C4C]" />
              </div>

              <div className="flex flex-col items-start gap-1">
                <span className="text-3xl font-black text-blue-700 dark:text-white leading-none tracking-tight">{exitInfo.time}</span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-semibold">{exitInfo.date}</span>
              </div>
            </div>
          </div>

          <div className="text-right flex flex-col items-end">
            <span className="text-[10px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-widest mb-1.5">
              Est. Cost
            </span>
            <span className="text-2xl font-black text-[#FF5A26] leading-none mb-2.5">
              {costResult.total.toLocaleString('vi-VN')}đ
            </span>
            <p className="text-[9px] text-stone-500 dark:text-stone-400 font-medium leading-relaxed text-right max-w-[120px]">
              Phí tính theo block. {state.duration}h =<br />
              {totalBlocks} block(s).
            </p>
          </div>
        </div>
      </div>

      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        selectedDate={state.entryDate}
        onSelectDate={(date) => {
          let newExitDate = exitInfo.rawDate || state.exitDate;
          if (new Date(date) > new Date(newExitDate)) newExitDate = date;
          setState((s) => ({ ...s, entryDate: date, exitDate: newExitDate, exitTime: undefined, duration: 1 }));
        }}
      />

      <TimePickerModal
        isOpen={isTimePickerOpen}
        onClose={() => setIsTimePickerOpen(false)}
        selectedDate={state.entryDate}
        selectedTime={state.entryTime}
        onSelectTime={(time) => {
          setState((s) => ({ ...s, entryTime: time, exitTime: undefined, duration: 1 }));
        }}
      />

      <DatePickerModal
        isOpen={isExitDatePickerOpen}
        onClose={() => setIsExitDatePickerOpen(false)}
        selectedDate={exitInfo.rawDate || state.exitDate}
        onSelectDate={(date) => {
          if (new Date(date) < new Date(state.entryDate)) return; // prevent past date
          const exT = state.exitTime || exitInfo.time;
          let diffMins = calculateDiffMins(state.entryDate, state.entryTime, date, exT);
          if (diffMins <= 0) diffMins = 0;
          const diffHours = diffMins > 0 ? Number((diffMins / 60).toFixed(2)) : 0;
          setState((s) => ({ ...s, exitDate: date, exitTime: exT, duration: diffHours }));
        }}
      />

      <TimePickerModal
        isOpen={isExitTimePickerOpen}
        onClose={() => setIsExitTimePickerOpen(false)}
        selectedDate={exitInfo.rawDate || state.exitDate}
        selectedTime={state.exitTime || exitInfo.time}
        title="Select Exit Time"
        confirmText="Confirm Exit Time"
        solidTheme={true}
        disablePastTime={false}
        onSelectTime={(time) => {
          let newExitDate = exitInfo.rawDate || state.exitDate;
          let diffMins = calculateDiffMins(state.entryDate, state.entryTime, newExitDate, time);
          
          if (diffMins <= 0 && state.entryDate === newExitDate) {
             const exitD = new Date(newExitDate);
             exitD.setDate(exitD.getDate() + 1);
             newExitDate = exitD.toISOString().split('T')[0];
             diffMins = calculateDiffMins(state.entryDate, state.entryTime, newExitDate, time);
          } else if (diffMins <= 0) {
             diffMins = 0;
          }
          
          const diffHours = diffMins > 0 ? Number((diffMins / 60).toFixed(2)) : 0;
          setState((s) => ({ ...s, exitTime: time, exitDate: newExitDate, duration: diffHours }));
        }}
      />
    </div>
  );
}

// Step 4 – Select Floor
function StepSelectFloor({
  state,
  setState,
  floors,
  loading,
  allBuildingSlots,
  lotId,
  onNext,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  floors: FloorResponse[];
  loading: boolean;
  allBuildingSlots: ParkingSlotDetail[];
  lotId: string;
  onNext: () => void;
}) {
  const [loadingAi, setLoadingAi] = useState(false);
  const floorIconComponents = [ParkingSquare, Car, Layers, Building2];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={32} className="text-[#FF4C4C] animate-spin" />
        <p className="text-sm text-stone-500">Loading floors...</p>
      </div>
    );
  }

  if (floors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Layers size={48} className="text-stone-300 mb-3" />
        <p className="text-sm text-stone-500 font-bold">No floors found</p>
        <p className="text-xs text-stone-400">This parking lot has no floors configured.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 border border-[#FF4C4C]/25 flex items-center justify-center">
            <Layers size={20} className="text-[#FF4C4C]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-white transition-colors">Select Floor</h2>
            <p className="text-xs text-stone-500">Step 4 of 6 — Choose a floor to park on</p>
          </div>
        </div>
        <button
          onClick={async () => {
            try {
              setLoadingAi(true);
              const token = localStorage.getItem('sp_token') || '';
              const suggestions = await getAiSuggestions(state.vehicleType!, lotId, 1, token);
              if (suggestions.length > 0) {
                const best = suggestions[0];
                setState(s => ({
                  ...s,
                  floor: best.floorId,
                  slotId: best.slotId,
                  slot: best.slotNumber,
                  zone: getZoneName(best.slotNumber),
                  bookingMethod: 1 // Mark as AI Recommended
                }));
                onNext();
              } else {
                alert('Không có chỗ đỗ nào khả dụng theo gợi ý của AI.');
              }
            } catch (err: any) {
              alert('AI Suggest error: ' + err.message);
            } finally {
              setLoadingAi(false);
            }
          }}
          disabled={loadingAi}
          className="flex items-center gap-1.5 bg-[#FF4C4C]/10 hover:bg-[#FF4C4C]/20 text-[#FF4C4C] px-3 py-2 rounded-xl border border-[#FF4C4C]/20 transition-all text-xs font-bold disabled:opacity-50"
        >
          {loadingAi ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loadingAi ? 'AI Thinking...' : 'AI Suggest'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {floors.map((floor, idx) => {
          const selected = state.floor === floor.id;
          const FloorIcon = floorIconComponents[idx % floorIconComponents.length];
          return (
            <button
              key={floor.id}
              onClick={() => setState((s) => ({ ...s, floor: floor.id, zone: null, slot: null, slotId: null }))}
              className={`flex flex-col items-center gap-3 py-6 rounded-2xl border-2 transition-all group ${selected
                ? 'bg-[#FF4C4C]/5 border-[#FF4C4C] shadow-sm shadow-[#FF4C4C]/10'
                : 'bg-white dark:bg-[#18181B] border-gray-200/80 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-300 dark:hover:border-white/20'
                }`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${selected
                  ? 'bg-[#FF4C4C]/10 border-2 border-[#FF4C4C]/30'
                  : 'bg-gray-100 dark:bg-white/5 border-2 border-gray-200/60 dark:border-white/10 group-hover:bg-[#FF4C4C]/10 group-hover:border-[#FF4C4C]/20'
                  }`}
              >
                <FloorIcon
                  size={24}
                  strokeWidth={1.5}
                  className={`transition-colors ${selected ? 'text-[#FF4C4C]' : 'text-stone-500 dark:text-stone-400 group-hover:text-[#FF4C4C]'
                    }`}
                />
              </div>
              <div className="text-center">
                <p className={`font-bold text-sm ${selected ? 'text-[#FF4C4C]' : 'text-stone-800 dark:text-stone-200'}`}>
                  {floor.name}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {(() => {
                    const availableSpots = allBuildingSlots.filter(
                      (s) => s.floorId === floor.id &&
                        (s.status === 'Available' || String(s.status) === '0')
                    ).length;
                    return `${availableSpots} spots available`;
                  })()}
                </p>
              </div>
              {selected && (
                <CheckCircle2 size={16} className="text-[#FF4C4C]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Hàm phụ định nghĩa cách xác định zone từ slotNumber
const getZoneName = (slotNo: string): string => {
  const firstChar = slotNo.trim().charAt(0).toUpperCase();
  if (firstChar >= 'A' && firstChar <= 'Z') {
    return `Zone ${firstChar}`;
  }
  const num = parseInt(slotNo, 10);
  if (!isNaN(num)) {
    if (num <= 20) return 'Zone A';
    if (num <= 40) return 'Zone B';
    if (num <= 60) return 'Zone C';
    return 'Zone D';
  }
  return 'Zone A';
};

// Step 5 – Select Slot
function StepSelectSlot({
  state,
  setState,
  slots,
  vehicles,
  lotId,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  slots: ParkingSlotDetail[];
  vehicles: ApiVehicleType[];
  lotId: string;
}) {
  const COLS = 8; // Số cột trong lưới (A → H)

  const selectedVehicle = vehicles.find((v) => v.id === state.vehicleType);
  const isMotorbike = selectedVehicle?.name.toLowerCase().includes('moto') ||
    selectedVehicle?.name.toLowerCase().includes('xe máy') ||
    selectedVehicle?.name.toLowerCase().includes('bike') ||
    selectedVehicle?.name.toLowerCase().includes('xe hai bánh') ||
    false;
  const VehicleIcon = isMotorbike ? Bike : Car;

  // Hiển thị tất cả các slot, không lọc theo loại xe hay trạng thái
  const filteredSlots = slots;

  // Lấy icon động dựa theo vehicleTypeId của từng slot
  const getSlotIcon = (slot: ParkingSlotDetail) => {
    const slotVehicleType = vehicles.find((v) => v.id === slot.vehicleTypeId);
    const isMotorbike = slotVehicleType?.name.toLowerCase().includes('moto') ||
      slotVehicleType?.name.toLowerCase().includes('xe máy') ||
      slotVehicleType?.name.toLowerCase().includes('bike') ||
      slotVehicleType?.name.toLowerCase().includes('xe hai bánh') ||
      false;
    return isMotorbike ? Bike : Car;
  };

  // Nhóm các slots thành từng hàng (COLS ô mỗi hàng)
  const rows: ParkingSlotDetail[][] = [];
  for (let i = 0; i < filteredSlots.length; i += COLS) {
    rows.push(filteredSlots.slice(i, i + COLS));
  }

  const availableCount = filteredSlots.filter(s => s.status === 'Available' || String(s.status) === '0').length;
  const occupiedCount = filteredSlots.filter(s => s.status === 'Occupied' || String(s.status) === '3').length;
  const reservedCount = filteredSlots.filter(s => s.status === 'Reserved' || String(s.status) === '2' || s.status === 'TemporaryHeld' || String(s.status) === '1').length;

  // Helper hàm để xác định màu hiển thị cho mỗi Slot
  const getSlotStyle = (slot: ParkingSlotDetail): string => {
    const isSelected = state.slotId === slot.id;
    if (isSelected) {
      return 'bg-[#FF4C4C] border-[#FF4C4C] text-white shadow-md shadow-[#FF4C4C]/30 scale-105 z-10';
    }

    const isAvailable = slot.status === 'Available' || String(slot.status) === '0';
    const isOccupied = slot.status === 'Occupied' || String(slot.status) === '3';
    const isReserved = slot.status === 'Reserved' || String(slot.status) === '2' || slot.status === 'TemporaryHeld' || String(slot.status) === '1';
    const isWrongType = slot.vehicleTypeId !== state.vehicleType;

    if (isAvailable && !isWrongType) {
      return 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:border-emerald-400 hover:scale-105 cursor-pointer';
    } else if (isOccupied) {
      return 'bg-red-50 dark:bg-red-500/10 border-red-200/60 dark:border-red-500/20 text-red-400/60 dark:text-red-400/50 cursor-not-allowed';
    } else if (isReserved) {
      return 'bg-amber-50 dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-500/20 text-amber-500/70 cursor-not-allowed';
    } else {
      return 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-400 cursor-not-allowed opacity-60';
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── Step header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 border border-[#FF4C4C]/25 flex items-center justify-center">
            <ParkingSquare size={20} className="text-[#FF4C4C]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">Select Slot</h2>
            <p className="text-xs text-stone-500">
              Step 5 of 5 — Pick an available parking spot
            </p>
          </div>
        </div>
      </div>
      {/* ── Stats Thống kê nhanh ── */}
      <div className="flex items-center gap-4 flex-wrap">
        {[
          { label: 'Còn trống', count: availableCount, dot: 'bg-emerald-400' },
          { label: 'Đang dùng', count: occupiedCount, dot: 'bg-red-400' },
          { label: 'Đặt trước', count: reservedCount, dot: 'bg-amber-400' },
          { label: 'Tổng', count: filteredSlots.length, dot: 'bg-stone-400' },
        ].map(({ label, count, dot }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            <span className="text-[11px] text-stone-500 dark:text-stone-400 font-semibold">{label}</span>
            <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">{count}</span>
          </div>
        ))}
      </div>

      {filteredSlots.length === 0 ? (
        <div className="py-14 text-center bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10">
          <ParkingSquare size={36} className="text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500 font-bold">Không có chỗ đỗ</p>
          <p className="text-xs text-stone-400 mt-1">
            Tầng này chưa có ô đỗ phù hợp với loại xe của bạn.
          </p>
        </div>
      ) : (
        /* ── Slot Grid View ── */
        <div className="overflow-x-auto pb-1">
          <div className="min-w-max">
            {/* Column headers (A, B, C...) */}
            <div
              className="grid gap-1.5 mb-1"
              style={{ gridTemplateColumns: `1.75rem repeat(${Math.min(COLS, filteredSlots.length)}, minmax(0,1fr))` }}
            >
              <div /> {/* Gốc rỗng */}
              {Array.from({ length: Math.min(COLS, filteredSlots.length) }, (_, c) => (
                <div
                  key={c}
                  className="text-center text-[10px] font-bold text-stone-400 tracking-wider"
                >
                  {String.fromCharCode(65 + c)}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="space-y-1.5">
              {rows.map((row, rowIdx) => (
                <div
                  key={rowIdx}
                  className="grid gap-1.5 items-center"
                  style={{ gridTemplateColumns: `1.75rem repeat(${COLS}, minmax(0,1fr))` }}
                >
                  {/* Row number label */}
                  <div className="text-center text-[10px] font-bold text-stone-400">
                    {rowIdx + 1}
                  </div>

                  {/* Slot cells */}
                  {row.map((slot) => {
                    const isAvailable = slot.status === 'Available' || String(slot.status) === '0';
                    const isWrongType = slot.vehicleTypeId !== state.vehicleType;
                    const isSelected = state.slotId === slot.id;
                    const isOccupied = slot.status === 'Occupied' || String(slot.status) === '3';

                    const colIdx = filteredSlots.indexOf(slot) % COLS;
                    const colLetter = String.fromCharCode(65 + colIdx);
                    const rowNum = Math.floor(filteredSlots.indexOf(slot) / COLS) + 1;
                    const SlotIcon = getSlotIcon(slot);

                    return (
                      <button
                        key={slot.id}
                        disabled={!isAvailable || isWrongType}
                        title={`${colLetter}${rowNum} · ${slot.slotNumber} · ${slot.status}${isWrongType ? ' (Khác loại xe)' : ''}`}
                        onClick={() => {
                          if (!isAvailable || isWrongType) return;
                          setState((s) => ({
                            ...s,
                            slot: slot.slotNumber,
                            slotId: slot.id,
                            zone: getZoneName(slot.slotNumber),
                            bookingMethod: 0 // Mark as Manual
                          }));
                        }}
                        className={`h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 border-2 text-[9px] font-bold transition-all select-none ${getSlotStyle(slot)}`}
                      >
                        {isSelected ? (
                          <CheckCircle2 size={12} />
                        ) : isOccupied ? (
                          <SlotIcon size={11} />
                        ) : (
                          <SlotIcon size={11} className="opacity-60" />
                        )}
                        <span className="leading-none">{slot.slotNumber}</span>
                      </button>
                    );
                  })}

                  {/* Padding empty cells if row < COLS */}
                  {row.length < COLS && Array.from({ length: COLS - row.length }, (_, k) => (
                    <div key={`pad-${k}`} className="h-11" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="flex items-center flex-wrap gap-4 pt-3 border-t border-gray-100 dark:border-white/10 text-[11px] text-stone-500">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-md bg-emerald-50 border-2 border-emerald-300 flex-shrink-0" />
          Còn trống
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-md bg-[#FF4C4C] border-2 border-[#FF4C4C] flex-shrink-0" />
          Đã chọn
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-md bg-red-50 border-2 border-red-200 flex-shrink-0" />
          Đang dùng
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-md bg-amber-50 border-2 border-amber-200 flex-shrink-0" />
          Đặt trước
        </div>
        {state.slot && (
          <span className="ml-auto text-[#FF4C4C] font-bold">
            Đã chọn: {state.slot}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Booking Summary sidebar
// ─────────────────────────────────────────────
function BookingSummary({
  lot,
  state,
  vehicles,
  floorLabel,
}: {
  lot: ParkingLot;
  state: WizardState;
  vehicles: ApiVehicleType[];
  floorLabel: string;
}) {
  const selectedVehicle = vehicles.find((v) => v.id === state.vehicleType);
  const pricePerHour = selectedVehicle?.hourlyRate ?? 0;
  const total = pricePerHour * state.duration;

  const rows: { label: string; value: string; muted?: boolean }[] = [
    { label: 'Facility', value: lot.name },
    {
      label: 'License Plate',
      value: state.licensePlate || 'Not entered',
      muted: !state.licensePlate,
    },
    {
      label: 'Vehicle',
      value: selectedVehicle?.name ?? 'Not selected',
      muted: !state.vehicleType,
    },
    {
      label: 'Entry',
      value:
        state.entryDate && state.entryTime
          ? `${state.entryDate.split('-').reverse().join('/')} ${state.entryTime}`
          : 'Not set',
      muted: !state.entryDate,
    },
    {
      label: 'Duration',
      value: `${state.duration}h`,
    },
    {
      label: 'Floor',
      value: floorLabel,
      muted: !state.floor,
    },
    {
      label: 'Zone',
      value: state.zone ?? 'Not selected',
      muted: !state.zone,
    },
    {
      label: 'Slot',
      value: state.slot ?? 'Not selected',
      muted: !state.slot,
    },
  ];

  return (
    <div className="w-72 flex-shrink-0 bg-gray-50 dark:bg-[#18181B] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200/80 dark:border-white/10 flex items-center gap-2">
          <ClipboardList size={16} className="text-[#FF4C4C]" />
          <h3 className="text-sm font-bold text-stone-800 dark:text-white">Booking Summary</h3>
        </div>

        {/* Rows */}
        <div className="px-5 py-4 space-y-3">
          {rows.map(({ label, value, muted }) => (
            <div key={label} className="flex items-start justify-between gap-3">
              <span className="text-xs text-stone-400 font-semibold flex-shrink-0">{label}</span>
              <span
                className={`text-xs font-bold text-right leading-snug ${muted ? 'text-stone-350 italic' : 'text-stone-700 dark:text-stone-300'
                  }`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-gray-200/80 dark:border-white/10">
        {pricePerHour > 0 ? (
          <div className="bg-[#FF4C4C]/5 dark:bg-white/5 border border-[#FF4C4C]/15 dark:border-white/10 rounded-2xl p-4 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-stone-400 font-bold">Estimated Total</span>
              <span className="text-[10px] text-stone-400 font-bold">{state.duration}h × {formatCurrency(pricePerHour)}</span>
            </div>
            <p className="text-lg font-black text-[#FF4C4C]">{formatCurrency(total)}</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200/80 rounded-xl p-4 text-center">
            <p className="text-xs text-stone-400 font-semibold">Select vehicle type to view pricing</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Confirmation + Payment + QR Popup
// ─────────────────────────────────────────────
import { QRCodeSVG } from 'qrcode.react';

type PopupPhase = 'confirm' | 'payment' | 'checkout' | 'qr';

function ConfirmationPopup({
  lot,
  state,
  onClose,
  onDone,
  vehicles,
  floorLabel,
  myVehicles,
  policy,
}: {
  lot: ParkingLot;
  state: WizardState;
  onClose: () => void;
  onDone: () => void;
  vehicles: ApiVehicleType[];
  floorLabel: string;
  myVehicles: VehicleResponse[];
  policy: PricingPolicyResponse | null;
}) {
  const [phase, setPhase] = useState<PopupPhase>('confirm');
  const [createdReservation, setCreatedReservation] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // orderCode từ PayOS để poll trạng thái
  const [pendingOrderCode, setPendingOrderCode] = useState<number | null>(null);
  // Ref tới tab PayOS đã mở
  const payosTabRef = useRef<Window | null>(null);
  // Bộ đếm giây polling
  const [pollSeconds, setPollSeconds] = useState(0);
  // Phương thức thanh toán
  const [paymentMethod, setPaymentMethod] = useState<'PayOS' | 'Wallet'>('Wallet');
  // Số dư ví
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    async function loadWallet() {
      try {
        const token = localStorage.getItem('sp_token') || '';
        if (token) {
          const info = await getWallet(token);
          setWalletBalance(info.balance);
        }
      } catch (err) {
        console.error('Lỗi khi tải số dư ví:', err);
      }
    }
    loadWallet();

    const onWalletUpdate = (e: Event) => {
      const { balance: newBalance } = (e as CustomEvent<{ balance: number }>).detail;
      setWalletBalance(newBalance);
    };
    window.addEventListener('walletUpdate', onWalletUpdate);
    return () => window.removeEventListener('walletUpdate', onWalletUpdate);
  }, []);

  const selectedVehicle = vehicles.find((v) => v.id === state.vehicleType);
  const costResult = computeEstimatedCostHelper(state, vehicles, policy);
  const total = costResult.total;

  const isMotorbike = selectedVehicle?.name.toLowerCase().includes('moto') ||
    selectedVehicle?.name.toLowerCase().includes('xe máy') ||
    selectedVehicle?.name.toLowerCase().includes('bike') ||
    selectedVehicle?.name.toLowerCase().includes('xe hai bánh') ||
    false;

  // Mã đặt chỗ hardcode fallback
  const bookingRef = `PKG-${Date.now().toString(36).toUpperCase().slice(-8)}`;

  const displayBookingRef = createdReservation?.bookingCode ?? bookingRef;

  // Dữ liệu nhúng vào QR (JSON compact)
  const qrData = JSON.stringify({
    ref: displayBookingRef,
    lot: lot.name,
    plate: state.licensePlate,
    vehicle: selectedVehicle?.name ?? '',
    slot: `${floorLabel} / Slot ${state.slot}`,
    date: state.entryDate,
    entry: state.entryTime,
    duration: state.duration,
  });

  const handleQuickDeposit = async (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent selecting the method
    const deficit = total - (walletBalance || 0);
    const depositAmount = deficit < 10000 ? 10000 : deficit;

    try {
      setSubmitting(true);
      setError(null);
      const token = localStorage.getItem('sp_token') || '';
      const res = await depositWallet({ amount: depositAmount }, token);
      window.open(res.checkoutUrl, '_blank', 'noopener');
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo giao dịch nạp tiền.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayAndBook = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const token = localStorage.getItem('sp_token') || '';
      if (!token) {
        throw new Error('Please log in to make a reservation.');
      }

      const [h, m] = state.entryTime.split(':').map(Number);
      const entry = new Date(state.entryDate);
      entry.setHours(h, m, 0, 0);
      
      const exit = new Date(state.exitDate);
      const exTime = state.exitTime || state.entryTime;
      const [exH, exM] = exTime.split(':').map(Number);
      exit.setHours(exH, exM, 0, 0);

      // Resolve vehicleId
      let vehicleIdToUse: string;
      const matchedVehicle = myVehicles.find(
        (v) => v.plateNumber === state.licensePlate && v.vehicleTypeId === state.vehicleType
      );

      if (matchedVehicle) {
        vehicleIdToUse = matchedVehicle.id;
      } else {
        // Auto-create vehicle for the user silently
        const newVehicle = await createVehicle({
          plateNumber: state.licensePlate,
          vehicleTypeId: state.vehicleType!
        }, token);
        vehicleIdToUse = newVehicle.id;
      }

      const payload = {
        vehicleId: vehicleIdToUse,
        parkingSlotId: state.slotId!,
        buildingId: lot.id,
        startTime: entry.toISOString(),
        endTime: exit.toISOString(),
        bookingMethod: state.bookingMethod
      };

      const res = await createReservation(payload, token);
      setCreatedReservation(res);

      if (paymentMethod === 'PayOS') {
        const paymentPayload = {
          amount: total,
          description: `Thanh toan don dat cho`,
          reservationId: res.id,
        };

        const payOSRes = await createPayOSPayment(paymentPayload, token);

        // Tính toán QR data thực tế chính xác dựa trên bookingCode thực tế vừa được tạo
        const realQrData = JSON.stringify({
          ref: res.bookingCode,
          lot: lot.name,
          plate: state.licensePlate,
          vehicle: selectedVehicle?.name ?? '',
          slot: `${floorLabel} / Slot ${state.slot}`,
          date: state.entryDate,
          entry: state.entryTime,
          duration: state.duration,
        });

        // Lưu QR data vào localStorage
        localStorage.setItem('latest_booking_qr', realQrData);
        localStorage.setItem('latest_reservation_id', res.id);

        // Mở tab mới thay vì iframe (tránh lỗi Private Network Access)
        const newTab = window.open(payOSRes.checkoutUrl, '_blank', 'noopener');
        payosTabRef.current = newTab;
        setPendingOrderCode(payOSRes.orderCode);
        setSubmitting(false);
        setPhase('checkout');
      } else {
        // Wallet thanh toán xong rồi (vì backend đã trừ ví)
        const realQrData = JSON.stringify({
          ref: res.bookingCode,
          lot: lot.name,
          plate: state.licensePlate,
          vehicle: selectedVehicle?.name ?? '',
          slot: `${floorLabel} / Slot ${state.slot}`,
          date: state.entryDate,
          entry: state.entryTime,
          duration: state.duration,
        });

        localStorage.setItem('latest_booking_qr', realQrData);
        localStorage.setItem('latest_reservation_id', res.id);

        setSubmitting(false);
        setPhase('qr');
      }

    } catch (err: any) {
      console.error(err);
      if (err.code === 'INSUFFICIENT_BALANCE' && err.requiredAmount) {
        const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
        setError(
          `Số dư ví không đủ. Cần nạp thêm ${fmt(err.requiredAmount)} ` +
          `(Tổng phí: ${fmt(err.totalFee ?? 0)} — Số dư hiện tại: ${fmt(err.currentBalance ?? 0)}). ` +
          `Vui lòng nạp tiền vào ví trước khi đặt chỗ.`
        );
      } else {
        setError(err.message || 'Reservation failed. Please check your information.');
      }
      setSubmitting(false);
    }
  };

  // ── Polling: kiểm tra trạng thái thanh toán sau khi mở tab PayOS ──
  useEffect(() => {
    if (phase !== 'checkout' || pendingOrderCode == null) return;

    const token = localStorage.getItem('sp_token') || '';
    let cancelled = false;
    let seconds = 0;
    setPollSeconds(0);

    const interval = setInterval(async () => {
      seconds += 3;
      setPollSeconds(seconds);

      if (seconds > 600) {
        clearInterval(interval);
        setError('Hết thời gian chờ (10 phút). Vui lòng thử lại.');
        setPhase('payment');
        setPendingOrderCode(null);
        return;
      }

      try {
        const result = await verifyPayment(pendingOrderCode, token);
        if (cancelled) return;

        if (result.isPaid) {
          clearInterval(interval);
          try { payosTabRef.current?.close(); } catch { }
          payosTabRef.current = null;
          setPendingOrderCode(null);
          setPhase('qr');
        } else if (result.status === 'Failed') {
          clearInterval(interval);
          try { payosTabRef.current?.close(); } catch { }
          payosTabRef.current = null;
          setPendingOrderCode(null);
          setError('Thanh toán thất bại. Vui lòng thử lại.');
          setPhase('payment');
        }
      } catch {
        // bỏ qua lỗi mạng tạm thời
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [phase, pendingOrderCode]);

  const formatDateDisplay = (d: string) => {
    if (!d) return '--';
    const [y, mo, dd] = d.split('-');
    return `${dd}/${mo}/${y}`;
  };

  const exitTime = (() => {
    if (!state.exitDate || !state.exitTime) return '--:--';
    return state.exitTime;
  })();

  const rows = [
    { label: 'Parking Lot', value: lot.name },
    { label: 'License Plate', value: state.licensePlate },
    { label: 'Vehicle Type', value: selectedVehicle ? `${isMotorbike ? '🏍️' : '🚗'} ${selectedVehicle.name}` : 'Not selected' },
    { label: 'Entry Date', value: `${formatDateDisplay(state.entryDate)} ${state.entryTime}` },
    { label: 'Estimated Exit', value: `${formatDateDisplay(state.entryDate)} ${exitTime}` },
    { label: 'Duration', value: `${state.duration}h` },
    { label: 'Location', value: `${floorLabel} › Slot ${state.slot}` },
  ];

  const headerConfig = {
    confirm: {
      icon: <ClipboardList size={18} className="text-[#FF4C4C]" />,
      iconBg: 'bg-[#FF4C4C]/10 border border-[#FF4C4C]/30',
      headerBg: '',
      title: 'Confirm Information',
      subtitle: 'Double check before confirming',
    },
    payment: {
      icon: <CheckCircle2 size={18} className="text-emerald-500" />,
      iconBg: 'bg-emerald-50 border border-emerald-200',
      headerBg: 'bg-emerald-50/30',
      title: 'Payment',
      subtitle: 'Select payment method',
    },
    checkout: {
      icon: <CheckCircle2 size={18} className="text-[#FF4C4C]" />,
      iconBg: 'bg-[#FF4C4C]/10 border border-[#FF4C4C]/30',
      headerBg: '',
      title: 'Secure Checkout',
      subtitle: 'Quét mã VietQR trên PayOS',
    },
    qr: {
      icon: <CheckCircle2 size={18} className="text-blue-500" />,
      iconBg: 'bg-blue-50 border border-blue-200',
      headerBg: 'bg-blue-50/30',
      title: 'Reservation Successful!',
      subtitle: 'Present this QR code to the staff upon entry',
    },
  }[phase];

  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-[#18181B] border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up transition-colors duration-300">

        {/* ── Header ── */}
        <div className={`px-6 pt-6 pb-5 border-b border-gray-100 dark:border-white/10 ${headerConfig.headerBg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${headerConfig.iconBg}`}>
                {headerConfig.icon}
              </div>
              <div>
                <h2 className="text-base font-bold text-stone-800 dark:text-white transition-colors">{headerConfig.title}</h2>
                <p className="text-xs text-stone-400 font-medium">{headerConfig.subtitle}</p>
              </div>
            </div>
            {phase !== 'payment' && (
              <button
                onClick={phase === 'qr' ? onDone : onClose}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 max-h-[62vh] overflow-y-auto scrollbar-thin">

          {/* ── Phase: Confirm ── */}
          {phase === 'confirm' && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden transition-colors">
                {rows.map(({ label, value }, i) => (
                  <div
                    key={label}
                    className={`flex items-start justify-between gap-4 px-4 py-3 ${i < rows.length - 1 ? 'border-b border-gray-150 dark:border-white/10' : ''
                      }`}
                  >
                    <span className="text-xs text-stone-400 font-semibold flex-shrink-0">{label}</span>
                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300 text-right">{value}</span>
                  </div>
                ))}
              </div>
              <div className="bg-[#FF4C4C]/5 dark:bg-white/5 border border-[#FF4C4C]/15 dark:border-white/10 rounded-2xl p-4 flex items-start justify-between transition-colors">
                <div className="flex-1 mr-4">
                  <p className="text-xs text-stone-400 font-bold mb-0.5">Estimated Total Cost</p>
                  <p className="text-xs text-stone-500 font-medium leading-relaxed">
                    Cách tính: {costResult.breakdown}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-black text-[#FF4C4C]">{formatCurrency(costResult.total)}</p>
                  {costResult.isCapped && (
                    <span className="text-[9px] font-bold text-purple-500 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                      Giá trần/ngày
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Phase: Payment ── */}
          {phase === 'payment' && (
            <div className="space-y-5">
              <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 flex items-center justify-between transition-colors">
                <div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">Reserved Location</p>
                  <p className="text-sm font-bold text-stone-800 dark:text-white transition-colors">{floorLabel} › {state.zone} › Slot {state.slot}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{lot.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">Total Price</p>
                  <p className="text-xl font-black text-[#FF4C4C]">{formatCurrency(total)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Thanh Toán</p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setPaymentMethod('Wallet')}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${paymentMethod === 'Wallet'
                        ? 'border-[#FF4C4C] bg-red-50 dark:bg-[#FF4C4C]/10'
                        : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#18181B] hover:border-red-200 dark:hover:border-[#FF4C4C]/30'
                      }`}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'Wallet' ? 'border-[#FF4C4C]' : 'border-gray-300 dark:border-white/20'
                        }`}>
                        {paymentMethod === 'Wallet' && <div className="w-2 h-2 rounded-full bg-[#FF4C4C]" />}
                      </div>
                      <p className="text-sm font-bold text-stone-800 dark:text-white transition-colors">Thanh toán qua Ví Hệ Thống</p>
                    </div>
                    <p className="text-xs text-stone-500 pl-7">
                      Trừ tiền trực tiếp vào số dư ví của bạn. Giao dịch hoàn tất ngay lập tức.
                    </p>
                    {walletBalance !== null && (
                      <div className="pl-7 mt-2">
                        <span className="text-xs font-semibold text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-white/10 px-2.5 py-1 rounded-md">
                          Số dư hiện tại: <span className="font-bold text-[#FF4C4C]">{walletBalance.toLocaleString('vi-VN')}đ</span>
                        </span>
                        {total > walletBalance && paymentMethod === 'Wallet' && (
                          <div className="mt-3 flex items-center justify-between p-2.5 bg-red-50 border border-red-100 rounded-xl cursor-default" onClick={e => e.stopPropagation()}>
                            <div>
                              <p className="text-[11px] font-bold text-red-600">Số dư không đủ thanh toán</p>
                            </div>
                            <button
                              onClick={handleQuickDeposit}
                              disabled={submitting}
                              className="bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold py-1.5 px-3 rounded-xl transition-all"
                            >
                              Nạp {Math.max(10000, total - walletBalance).toLocaleString('vi-VN')}đ
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </button>

                  <button
                    onClick={() => setPaymentMethod('PayOS')}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${paymentMethod === 'PayOS'
                        ? 'border-[#FF4C4C] bg-red-50 dark:bg-[#FF4C4C]/10'
                        : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#18181B] hover:border-red-200 dark:hover:border-[#FF4C4C]/30'
                      }`}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'PayOS' ? 'border-[#FF4C4C]' : 'border-gray-300 dark:border-white/20'
                        }`}>
                        {paymentMethod === 'PayOS' && <div className="w-2 h-2 rounded-full bg-[#FF4C4C]" />}
                      </div>
                      <p className="text-sm font-bold text-stone-800 dark:text-white transition-colors">Thanh toán qua Ngân hàng (VietQR)</p>
                    </div>
                    <p className="text-xs text-stone-500 pl-7">
                      Chuyển hướng tới cổng thanh toán PayOS để quét mã QR chuyển khoản.
                    </p>
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-150 text-red-500 text-xs px-4 py-3 rounded-2xl text-center font-bold">
                  ⚠️ {error}
                </div>
              )}

              <p className="text-xs text-stone-400 font-medium text-center">
                Bằng việc xác nhận, bạn đồng ý với Điều khoản và Dịch vụ.
              </p>
            </div>
          )}

          {/* ── Phase: Checkout (Tab mới + Polling) ── */}
          {phase === 'checkout' && (
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-emerald-100 flex items-center justify-center">
                  <Loader2 size={36} className="animate-spin text-emerald-500" />
                </div>
                <div className="absolute inset-0 rounded-full bg-emerald-400/10 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-base font-black text-stone-800 dark:text-white transition-colors mb-1">Đang chờ thanh toán</p>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Cửa sổ PayOS đã mở.<br />
                  Hoàn tất thanh toán trên cửa sổ đó,<br />
                  trang này sẽ tự động cập nhật.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-stone-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full px-5 py-2.5 transition-colors">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                  Đang kiểm tra... <span className="font-bold text-stone-700 dark:text-stone-300">{pollSeconds}s</span>
                </span>
              </div>
              <button
                onClick={() => {
                  if (payosTabRef.current && !payosTabRef.current.closed) {
                    payosTabRef.current.focus();
                  }
                }}
                className="text-xs text-[#FF4C4C] font-semibold hover:underline"
              >
                Nhấn để mở lại cửa sổ thanh toán →
              </button>
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-500 text-xs px-4 py-3 rounded-2xl text-center font-bold w-full">
                  ⚠️ {error}
                </div>
              )}
            </div>
          )}

          {/* ── Phase: QR Code ── */}
          {phase === 'qr' && (
            <div className="flex flex-col items-center gap-5">
              {/* Success badge */}
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-full px-4 py-1.5 transition-colors">
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Payment Successful</span>
              </div>

              {/* QR Code */}
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-[#FF4C4C]/5 blur-lg" />
                <div className="relative bg-white dark:bg-[#18181B] border border-gray-200/80 dark:border-white/10 rounded-2xl p-4 shadow-xl flex items-center justify-center min-w-[212px] min-h-[212px] transition-colors">
                  <QRCodeSVG
                    value={qrData}
                    size={180}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#1c1917"
                    imageSettings={{
                      src: '',
                      height: 0,
                      width: 0,
                      excavate: false,
                    }}
                  />
                </div>
              </div>

              {/* Booking ref */}
              <div className="text-center">
                <p className="text-[10px] text-stone-400 font-bold mb-1 uppercase tracking-widest">Booking Code</p>
                <p className="text-lg font-black text-[#FF4C4C] tracking-widest">{displayBookingRef}</p>
              </div>

              {/* Info summary */}
              <div className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden transition-colors">
                {[
                  { label: 'Parking Lot', value: lot.name },
                  { label: 'License Plate', value: state.licensePlate },
                  { label: 'Location', value: `${floorLabel} › ${state.zone} › Slot ${state.slot}` },
                  { label: 'Entry Time', value: `${formatDateDisplay(state.entryDate)} ${state.entryTime}` },
                  { label: 'Est. Exit Time', value: `${formatDateDisplay(state.entryDate)} ${exitTime}` },
                ].map(({ label, value }, i, arr) => (
                  <div
                    key={label}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-gray-150 dark:border-white/10' : ''
                      }`}
                  >
                    <span className="text-xs text-stone-400 font-semibold flex-shrink-0">{label}</span>
                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300 text-right">{value}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-stone-400 font-medium text-center px-4 leading-relaxed">
                Present this QR code to the staff at the parking lot to confirm your reservation.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-white/10 flex items-center gap-3 bg-gray-50/50 dark:bg-white/5 transition-colors duration-300">
          {phase === 'confirm' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-stone-500 border border-gray-200 dark:border-white/10 hover:text-stone-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => setPhase('payment')}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#FF4C4C] hover:bg-[#E13B3B] text-white shadow-md shadow-[#FF4C4C]/10 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={15} />
                Confirm
              </button>
            </>
          )}

          {phase === 'payment' && (
            <>
              <button
                disabled={submitting}
                onClick={() => setPhase('confirm')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-stone-500 border border-gray-200 dark:border-white/10 hover:text-stone-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-all disabled:opacity-50"
              >
                <ChevronLeft size={15} />
                Back
              </button>
              <button
                disabled={submitting || (paymentMethod === 'Wallet' && (walletBalance === null || walletBalance < total))}
                onClick={handlePayAndBook}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    Pay Now
                  </>
                )}
              </button>
            </>
          )}

          {phase === 'checkout' && (
            <button
              onClick={() => {
                try { payosTabRef.current?.close(); } catch { }
                payosTabRef.current = null;
                setPendingOrderCode(null);
                setPhase('payment');
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-stone-500 border border-gray-200 dark:border-white/10 hover:text-stone-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-all"
            >
              Hủy Thanh Toán
            </button>
          )}

          {phase === 'qr' && (
            <button
              onClick={onDone}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={15} />
              Done – Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Stepper progress bar
// ─────────────────────────────────────────────
function StepperBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, idx) => {
        const done = currentStep > step.id;
        const active = currentStep === step.id;
        return (
          <div key={step.id} className="flex items-center">
            {/* Circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all duration-300 ${done
                  ? 'bg-[#FF4C4C] border-[#FF4C4C] text-white'
                  : active
                    ? 'bg-[#FF4C4C]/10 border-[#FF4C4C] text-[#FF4C4C] shadow-sm shadow-[#FF4C4C]/10'
                    : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-stone-400 dark:text-stone-500'
                  }`}
              >
                {done ? <CheckCircle2 size={16} /> : step.id}
              </div>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${active ? 'text-[#FF4C4C]' : done ? 'text-[#FF4C4C]/70' : 'text-stone-400'
                  }`}
              >
                {step.short}
              </span>
            </div>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div
                className={`w-12 sm:w-16 h-0.5 mb-5 mx-1 rounded-full transition-all duration-300 ${done ? 'bg-[#FF4C4C]' : 'bg-gray-200'
                  }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main BookingWizard component
// ─────────────────────────────────────────────
function BookingWizardInner({ lot, onClose }: BookingWizardProps) {
  const [step, setStep] = useState(1);
  const [vehicles, setVehicles] = useState<ApiVehicleType[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [floors, setFloors] = useState<FloorResponse[]>([]);
  const [loadingFloors, setLoadingFloors] = useState(true);
  const [allBuildingSlots, setAllBuildingSlots] = useState<ParkingSlotDetail[]>([]);
  const [slots, setSlots] = useState<ParkingSlotDetail[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [policy, setPolicy] = useState<PricingPolicyResponse | null>(null);

  const [myVehicles, setMyVehicles] = useState<VehicleResponse[]>([]);
  const [loadingMyVehicles, setLoadingMyVehicles] = useState(false);

  const [state, setState] = useState<WizardState>({
    vehicleType: null,
    licensePlate: '',
    entryDate: todayDateStr(),
    entryTime: nowTimeStr(),
    exitDate: todayDateStr(),
    duration: 1,
    floor: null,
    slot: null,
    slotId: null,
    zone: null,
    bookingMethod: 0
  });
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);

  // Tải danh sách xe đã đăng ký của Driver
  useEffect(() => {
    const token = localStorage.getItem('sp_token') || '';
    if (!token) return;
    async function loadMyVehicles() {
      try {
        setLoadingMyVehicles(true);
        const data = await getMyVehicles(token);
        setMyVehicles(data);

        // Không tự động điền xe nữa theo yêu cầu của user
      } catch (err) {
        console.error('Lỗi khi tải danh sách xe của tôi:', err);
      } finally {
        setLoadingMyVehicles(false);
      }
    }
    loadMyVehicles();
  }, []);

  // Load vehicle types & policies
  useEffect(() => {
    async function loadVehicleTypes() {
      try {
        setLoadingVehicles(true);
        const [types, policies] = await Promise.all([
          getVehicleTypes(),
          getAllPolicies()
        ]);

        // Sắp xếp các chính sách theo thời gian tạo giảm dần để lấy chính sách mới nhất
        const sortedPolicies = [...policies].sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        const mapped = types.map(t => {
          const policy = sortedPolicies.find(p => p.vehicleTypeId === t.id);
          let rate = policy?.hourlyRate ?? 0;
          if (rate === 0) {
            const lowerName = t.name.toLowerCase();
            if (lowerName.includes('car') || lowerName.includes('ô tô') || lowerName.includes('xe hơi') || lowerName.includes('oto') || lowerName.includes('xe 01')) {
              rate = 10000;
            } else if (lowerName.includes('moto') || lowerName.includes('xe máy') || lowerName.includes('bike') || lowerName.includes('xe hai bánh')) {
              rate = 5000;
            } else {
              rate = 10000;
            }
          }
          return {
            id: t.id,
            name: t.name,
            description: t.description,
            hourlyRate: rate
          };
        });
        setVehicles(mapped);
      } catch (err) {
        console.error('Lỗi khi tải loại xe:', err);
      } finally {
        setLoadingVehicles(false);
      }
    }
    loadVehicleTypes();
  }, []);

  // Load PricingPolicy khi vehicleType thay đổi
  useEffect(() => {
    if (!state.vehicleType) {
      setPolicy(null);
      return;
    }
    async function loadPolicy() {
      setPolicy(null); // Xoá policy cũ ngay lập tức để tránh hiển thị sai giá trong lúc chờ
      try {
        const data = await getPolicyByVehicleType(state.vehicleType!);
        setPolicy(data);
      } catch {
        // Không có policy → giữ null, fallback sang hourlyRate từ vehicle
        setPolicy(null);
      }
    }
    loadPolicy();
  }, [state.vehicleType]);

  // Load floors by building
  useEffect(() => {
    if (!lot.id) return;
    async function loadFloors() {
      try {
        setLoadingFloors(true);

        let buildingId = lot.id;
        const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lot.id);

        if (!isGuid) {
          const buildings = await getBuildings();
          if (buildings.length > 0) {
            buildingId = buildings[0].id;
          }
        }

        const data = await getFloorsByBuilding(buildingId);
        const sorted = data.sort((a, b) => a.floorIndex - b.floorIndex);
        setFloors(sorted);

        // Fetch all slots for these floors in parallel
        let slotsArrays: ParkingSlotDetail[][] = [];
        if (state.entryDate && state.entryTime && state.exitDate && state.exitTime) {
          const [h, m] = state.entryTime.split(':').map(Number);
          const entry = new Date(state.entryDate);
          entry.setHours(h, m, 0, 0);
          
          const exit = new Date(state.exitDate);
          const [exH, exM] = state.exitTime.split(':').map(Number);
          exit.setHours(exH, exM, 0, 0);
          
          slotsArrays = await Promise.all(
            sorted.map((f) => getAvailableSlotsByFloor(f.id, entry.toISOString(), exit.toISOString()).catch(() => []))
          );
        } else {
          slotsArrays = await Promise.all(
            sorted.map((f) => getSlotsByFloor(f.id).catch(() => []))
          );
        }

        const flatSlots = slotsArrays.flat();
        setAllBuildingSlots(flatSlots);
      } catch (err) {
        console.error('Lỗi khi tải tầng:', err);
      } finally {
        setLoadingFloors(false);
      }
    }
    loadFloors();
  }, [lot.id, state.entryDate, state.entryTime, state.duration]);

  // Load slots when floor changes
  useEffect(() => {
    if (!state.floor) {
      setSlots([]);
      return;
    }
    const currentFloor = state.floor;
    async function loadSlots() {
      if (!currentFloor) return;
      try {
        setLoadingSlots(true);
        let data: ParkingSlotDetail[];

        if (state.entryDate && state.entryTime && state.exitDate && state.exitTime) {
          const [h, m] = state.entryTime.split(':').map(Number);
          const entry = new Date(state.entryDate);
          entry.setHours(h, m, 0, 0);
          
          const exit = new Date(state.exitDate);
          const [exH, exM] = state.exitTime.split(':').map(Number);
          exit.setHours(exH, exM, 0, 0);

          // Dùng API mới tính toán overlap
          data = await getAvailableSlotsByFloor(currentFloor, entry.toISOString(), exit.toISOString());
        } else {
          // Fallback nếu thiếu thời gian
          data = await getSlotsByFloor(currentFloor);
        }

        setSlots(data);
      } catch (err) {
        console.error('Lỗi khi tải ô đỗ xe:', err);
      } finally {
        setLoadingSlots(false);
      }
    }
    loadSlots();
  }, [state.floor, state.entryDate, state.entryTime, state.duration]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Validate whether the current step is complete enough to advance
  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return !!state.vehicleType;
      case 2: return state.licensePlate.trim().length >= 4;
      case 3: return !!state.entryDate && !!state.entryTime;
      case 4: return !!state.floor;
      case 5: return !!state.slot;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step === 3) {
      if (state.entryDate && state.entryTime) {
        const now = new Date();
        const [h, m] = state.entryTime.split(':').map(Number);
        const entry = new Date(state.entryDate);
        entry.setHours(h, m, 0, 0);

        if (entry <= now) {
          toast.error('Thời gian bắt đầu phải lớn hơn thời điểm hiện tại.');
          return;
        }
      }
    }
    if (step < 5 && canAdvance()) setStep((s) => s + 1);
  };
  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  // Mở popup xác nhận
  const handleConfirm = () => {
    if (canAdvance()) setShowConfirmPopup(true);
  };

  // Sau khi thanh toán xong
  const handlePaymentDone = () => {
    setShowConfirmPopup(false);
    onClose();
  };

  const selectedFloorObj = floors.find(f => f.id === state.floor);
  const floorLabel = selectedFloorObj?.name ?? 'Not selected';

  const renderStep = () => {
    switch (step) {
      case 1: return <StepVehicleType state={state} setState={setState} vehicles={vehicles} loading={loadingVehicles} policy={policy} />;
      case 2: return (
        <StepLicensePlate
          state={state}
          setState={setState}
          vehicles={vehicles}
          myVehicles={myVehicles}
          loadingMyVehicles={loadingMyVehicles}
        />
      );
      case 3: return <StepDateTime state={state} setState={setState} vehicles={vehicles} policy={policy} />;
      case 4: return <StepSelectFloor state={state} setState={setState} floors={floors} loading={loadingFloors} allBuildingSlots={allBuildingSlots} lotId={lot.id} onNext={() => setStep(5)} />;
      case 5: return <StepSelectSlot state={state} setState={setState} slots={slots} vehicles={vehicles} lotId={lot.id} />;
      default: return null;
    }
  };

  return (
    <>
      <div className="h-[calc(100vh-5rem)] w-full flex items-center justify-center bg-[#F3F3F5] dark:bg-[#0A0A0C] transition-colors duration-300 p-4 sm:p-6 relative">
        <button
          onClick={step === 1 ? onClose : handleBack}
          className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold text-stone-600 dark:text-stone-400 bg-white dark:bg-[#18181B] border-2 border-gray-200/60 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 hover:text-stone-900 dark:hover:text-white transition-all shadow-sm z-10"
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
          {step === 1 ? 'Exit' : 'Back'}
        </button>
        <div
          className="relative w-full max-w-3xl bg-white dark:bg-[#18181B] border border-gray-200 dark:border-white/10 rounded-3xl shadow-xl dark:shadow-2xl flex flex-col overflow-hidden max-h-full transition-colors duration-300"
        >
          {/* ── Modal Header ── */}
          <div className="flex-shrink-0 px-6 pt-6 pb-5 border-b border-gray-150 dark:border-white/10 transition-colors duration-300">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-base font-bold text-stone-800 dark:text-white transition-colors duration-300">Book a Parking Spot</h1>
                <p className="text-xs text-stone-400 font-semibold mt-0.5 truncate max-w-xs">{lot.name}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
              >
                <X size={18} />
              </button>
            </div>
            <StepperBar currentStep={step} />
          </div>

          {/* ── Modal Body ── */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
              <div key={step} className="animate-fade-in-up">
                {renderStep()}
              </div>
            </div>
          </div>

          {/* ── Modal Footer ── */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-150 dark:border-white/10 flex flex-col gap-3 bg-gray-50/50 dark:bg-white/5 transition-colors duration-300">
            <div className="flex items-center justify-between gap-3">
              <div className="w-24"></div> {/* Placeholder to keep center alignment */}

              <span className="text-xs text-stone-500 font-bold">
                {step} / {STEPS.length}
              </span>

              {step < 5 ? (
                <button
                  onClick={handleNext}
                  disabled={!canAdvance()}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${canAdvance()
                    ? 'bg-[#FF4C4C] hover:bg-[#E13B3B] text-white shadow-sm shadow-[#FF4C4C]/10'
                    : 'bg-gray-100 dark:bg-white/5 text-stone-300 dark:text-stone-600 border-gray-200/80 dark:border-white/10 cursor-not-allowed'
                    }`}
                >
                  Continue
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleConfirm}
                  disabled={!canAdvance()}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${canAdvance()
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-white/5 text-stone-300 dark:text-stone-600 border-gray-200/80 dark:border-white/10 cursor-not-allowed'
                    }`}
                >
                  <CheckCircle2 size={16} />
                  Confirm Booking
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirmation & Payment Popup ── */}
      {showConfirmPopup && (
        <ConfirmationPopup
          lot={lot}
          state={state}
          onClose={() => setShowConfirmPopup(false)}
          onDone={handlePaymentDone}
          vehicles={vehicles}
          floorLabel={floorLabel}
          myVehicles={myVehicles}
          policy={policy}
        />
      )}
    </>
  );
}

export default function BookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateLot = location.state?.lot as ParkingLot | undefined;

  const { user, token, logout } = useAuth();
  useNotification(token);

  const [lot, setLot] = useState<ParkingLot | null>(stateLot || null);
  const [loadingLot, setLoadingLot] = useState(false);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const initials = user?.fullName?.slice(0, 2)?.toUpperCase() ?? 'PD';

  useEffect(() => {
    if (!lot) {
      // If there is no lot in state (e.g. user refreshed the page or navigated directly)
      // Redirect them back to find-parking to select a lot
      navigate('/find-parking', { replace: true });
    }
  }, [lot, navigate]);

  if (loadingLot) {
    return (
      <div className="min-h-screen bg-[#F3F3F5] flex flex-col items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#FF4C4C]" />
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="min-h-screen bg-[#F3F3F5] flex flex-col items-center justify-center p-4">
        <p className="text-stone-500 font-bold mb-4">Parking lot not found.</p>
        <button onClick={() => navigate(-1)} className="text-blue-500 font-bold hover:underline">Go Back</button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#F3F3F5] dark:bg-[#0A0A0C] transition-colors duration-300">
      <BookingWizardInner lot={lot} onClose={() => navigate(-1)} />
    </div>
  );
}
