import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { getVehicleTypes } from '../../services/vehicleTypesService';
import { getAllPolicies, getPolicyByVehicleType } from '../../services/pricingService';
import type { PricingPolicyResponse } from '../../services/pricingService';
import { getFloorsByBuilding, getBuildings } from '../../services/buildingsService';
import type { FloorResponse } from '../../services/buildingsService';
import { getSlotsByFloor } from '../../services/parkingService';
import type { ParkingSlotDetail } from '../../services/parkingService';
import { createReservation, getAiSuggestions } from '../../services/reservationsService';
import { createPayOSPayment } from '../../services/paymentService';
import { getMyVehicles, createVehicle } from '../../services/vehiclesService';
import type { VehicleResponse } from '../../services/vehiclesService';

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

const todayDateStr = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
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
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  vehicles: ApiVehicleType[];
  loading: boolean;
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
          <h2 className="text-lg font-bold text-stone-900">Select Vehicle Type</h2>
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
                  : 'bg-white border-gray-200/80 hover:bg-gray-50 hover:border-gray-300'
                }`}
            >
              {/* Icon container */}
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200 ${selected
                    ? 'bg-[#FF4C4C]/10 border-2 border-[#FF4C4C]/30'
                    : 'bg-gray-100 border-2 border-gray-200/60 group-hover:bg-[#FF4C4C]/10 group-hover:border-[#FF4C4C]/20'
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
                  className={`font-bold text-sm ${selected ? 'text-[#FF4C4C]' : 'text-stone-800'
                    }`}
                >
                  {v.name}
                </p>
                {v.description && (
                  <p className="text-[10px] text-stone-400 mt-0.5 line-clamp-1 font-medium">
                    {v.description}
                  </p>
                )}
                <p className="text-xs text-stone-500 mt-1.5 font-bold">
                  {formatCurrency(v.hourlyRate)}/hr
                </p>
              </div>

              {selected && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#FF4C4C]">
                  <CheckCircle2 size={14} className="text-[#FF4C4C]" />
                  Selected
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

  const [activeTab, setActiveTab] = useState<'saved' | 'manual'>(
    myVehicles.length > 0 ? 'saved' : 'manual'
  );

  // Tự động chuyển sang tab "Xe đã lưu" nếu load xong và có xe, và chưa nhập biển số
  useEffect(() => {
    if (myVehicles.length > 0 && !state.licensePlate) {
      setActiveTab('saved');
    }
  }, [myVehicles, state.licensePlate]);

  return (
    <div className="flex flex-col gap-6">
      {/* Step header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 border border-[#FF4C4C]/25 flex items-center justify-center">
          <ParkingSquare size={20} className="text-[#FF4C4C]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-stone-900">Enter License Plate</h2>
          <p className="text-xs text-stone-500">
            Step 2 of 6 — Your vehicle's identification number
          </p>
        </div>
      </div>

      {/* Tabs Switcher - Chỉ hiển thị nếu người dùng đã đăng ký xe */}
      {myVehicles.length > 0 && (
        <div className="flex bg-stone-105/80 p-1 rounded-2xl w-fit mx-auto mb-2 border border-stone-200/50">
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'saved'
                ? 'bg-white text-[#FF4C4C] shadow-sm shadow-[#FF4C4C]/5 border border-stone-200/10'
                : 'text-stone-500 hover:text-stone-850'
            }`}
          >
            <Car size={14} />
            Xe đã lưu
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'manual'
                ? 'bg-white text-[#FF4C4C] shadow-sm shadow-[#FF4C4C]/5 border border-stone-200/10'
                : 'text-stone-500 hover:text-stone-850'
            }`}
          >
            <ParkingSquare size={14} />
            Nhập thủ công
          </button>
        </div>
      )}

      {/* Loading state for vehicles */}
      {loadingMyVehicles && myVehicles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <Loader2 size={24} className="text-[#FF4C4C] animate-spin" />
          <p className="text-xs text-stone-400 font-semibold">Đang tải danh sách xe...</p>
        </div>
      )}

      {/* Tab content: Saved Vehicles */}
      {activeTab === 'saved' && myVehicles.length > 0 && !loadingMyVehicles && (
        <div className="flex flex-col gap-3 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
          {myVehicles.map((v) => {
            const isSelected = state.licensePlate === v.plateNumber;
            const lowerName = v.vehicleTypeName?.toLowerCase() || '';
            const isMotor = lowerName.includes('moto') ||
              lowerName.includes('xe máy') ||
              lowerName.includes('bike') ||
              lowerName.includes('xe hai bánh');
            const Icon = isMotor ? Bike : Car;

            return (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setState((s) => ({
                    ...s,
                    licensePlate: v.plateNumber,
                    vehicleType: v.vehicleTypeId,
                  }));
                }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 text-left group ${
                  isSelected
                    ? 'bg-[#FF4C4C]/5 border-[#FF4C4C] shadow-sm shadow-[#FF4C4C]/10'
                    : 'bg-white border-gray-200/80 hover:bg-stone-50 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${
                      isSelected
                        ? 'bg-[#FF4C4C]/10 text-[#FF4C4C]'
                        : 'bg-gray-100 text-stone-400 group-hover:bg-[#FF4C4C]/5'
                    }`}
                  >
                    <Icon size={24} strokeWidth={1.5} />
                  </div>

                  <div>
                    <p
                      className={`text-base font-black tracking-wider leading-none mb-1.5 ${
                        isSelected ? 'text-[#FF4C4C]' : 'text-stone-800'
                      }`}
                    >
                      {v.plateNumber}
                    </p>
                    <p className="text-[10px] text-stone-450 font-bold uppercase tracking-wider">
                      {v.vehicleTypeName || 'Phương tiện'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {v.isPrimary && (
                    <span className="bg-amber-500/10 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                      Mặc định
                    </span>
                  )}
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[#FF4C4C] flex items-center justify-center shadow-sm shadow-[#FF4C4C]/20">
                      <CheckCircle2 size={12} className="text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Tab content: Manual Entry */}
      {(activeTab === 'manual' || myVehicles.length === 0) && !loadingMyVehicles && (
        <>
          {/* Vehicle type display */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 border-2 border-gray-200/60 flex items-center justify-center">
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
                className="w-full bg-gray-50 border-2 border-gray-200/80 focus:border-[#FF4C4C] rounded-2xl px-6 py-4 text-stone-850 text-2xl font-black text-center tracking-[0.25em] placeholder-stone-300 outline-none transition-all duration-200 shadow-sm focus:shadow-md focus:shadow-[#FF4C4C]/5"
              />
            </div>

            {/* Format hint */}
            <div className="text-center space-y-1">
              <p className="text-xs text-stone-500">
                Format:{' '}
                <span className="text-stone-700 font-bold">51A-12345</span>{' '}
                (car) or{' '}
                <span className="text-stone-700 font-bold">59T1-12345</span>{' '}
                (motorcycle)
              </p>
              <p className="text-xs text-stone-400">
                This will be linked to your parking session.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
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
  const durations = [1, 2, 3, 4, 6, 8, 12, 24];

  // ── Tính giờ ra dựa trên giờ vào + duration ──
  const computeExitTime = (): { time: string; date: string } => {
    if (!state.entryDate || !state.entryTime) return { time: '--:--', date: '--/--/----' };
    const [h, m] = state.entryTime.split(':').map(Number);
    const entry = new Date(state.entryDate);
    entry.setHours(h, m, 0, 0);
    const exit = new Date(entry.getTime() + state.duration * 60 * 60 * 1000);
    const exitTime = `${String(exit.getHours()).padStart(2, '0')}:${String(exit.getMinutes()).padStart(2, '0')}`;
    const exitDate = `${String(exit.getDate()).padStart(2, '0')}/${String(exit.getMonth() + 1).padStart(2, '0')}/${exit.getFullYear()}`;
    return { time: exitTime, date: exitDate };
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '--/--/----';
    const [y, mo, d] = dateStr.split('-');
    return `${d}/${mo}/${y}`;
  };

  // ── Tính chi phí ước tính theo đúng logic PricingPolicy ──
  // Logic: block đầu tiên (blockPrice) + các giờ tiếp theo (hourlyRate/giờ)
  // Tổng chi phí bị giới hạn bởi dailyMaxRate
  const computeEstimatedCost = (): { total: number; isCapped: boolean; breakdown: string } => {
    const selectedVehicle = vehicles.find((v) => v.id === state.vehicleType);
    if (!selectedVehicle) return { total: 0, isCapped: false, breakdown: '' };

    // Nếu có PricingPolicy đầy đủ → dùng logic block
    if (policy && policy.blockPrice > 0 && policy.blockMinutes > 0) {
      const blocksPerHour = 60 / policy.blockMinutes;
      const firstBlockCost = policy.blockPrice; // Chi phí block đầu
      const additionalHours = Math.max(0, state.duration - 1);
      const additionalCost = additionalHours * policy.hourlyRate;
      const raw = firstBlockCost + additionalCost;
      const capped = policy.dailyMaxRate > 0 ? Math.min(raw, policy.dailyMaxRate) : raw;
      const isCapped = policy.dailyMaxRate > 0 && raw > policy.dailyMaxRate;
      const perBlock = `${policy.blockPrice.toLocaleString('vi-VN')}đ/${policy.blockMinutes}ph`;
      const perHour = `${policy.hourlyRate.toLocaleString('vi-VN')}đ/h`;
      const bd = state.duration <= 1
        ? `1 block (${perBlock})`
        : `1 block (${perBlock}) + ${additionalHours}h × ${perHour}`;
      return { total: capped, isCapped, breakdown: bd };
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
  };

  const exitInfo = computeExitTime();
  const costResult = computeEstimatedCost();

  return (
    <div className="flex flex-col gap-6">
      {/* ── Step header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 border border-[#FF4C4C]/25 flex items-center justify-center">
          <Calendar size={20} className="text-[#FF4C4C]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-stone-900">Date & Time</h2>
          <p className="text-xs text-stone-500">Step 3 of 5 — When do you plan to park?</p>
        </div>
      </div>

      {/* ── Inputs grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Booking Date */}
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
            <Calendar size={12} className="text-[#FF4C4C]" />
            Booking Date
          </label>
          <input
            type="date"
            value={state.entryDate}
            min={todayDateStr()}
            onChange={(e) => setState((s) => ({ ...s, entryDate: e.target.value }))}
            className="w-full bg-white border border-gray-200 hover:border-gray-300 focus:border-[#FF4C4C]/60 rounded-xl px-4 py-3 text-stone-800 text-sm outline-none transition-all"
          />
        </div>

        {/* Arrival Time */}
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
            <Clock size={12} className="text-[#FF4C4C]" />
            Arrival Time
          </label>
          <input
            type="time"
            value={state.entryTime}
            onChange={(e) => setState((s) => ({ ...s, entryTime: e.target.value }))}
            className="w-full bg-white border border-gray-200 hover:border-gray-300 focus:border-[#FF4C4C]/60 rounded-xl px-4 py-3 text-stone-800 text-sm outline-none transition-all"
          />
        </div>
      </div>

      {/* ── Duration ── */}
      <div>
        <label className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">
          <Clock size={12} className="text-[#FF4C4C]" />
          Duration
        </label>
        <div className="flex flex-wrap gap-2">
          {durations.map((d) => (
            <button
              key={d}
              onClick={() => setState((s) => ({ ...s, duration: d }))}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${state.duration === d
                  ? 'bg-[#FF4C4C] text-white border-[#FF4C4C] shadow-sm shadow-[#FF4C4C]/20'
                  : 'bg-white text-stone-600 border-gray-200 hover:bg-gray-50 hover:text-stone-900 hover:border-gray-300'
                }`}
            >
              {d}h
            </button>
          ))}
        </div>
      </div>

      {/* ── Pricing Structure Card ── */}
      {policy && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[9px] font-black">₫</span>
            </div>
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">
              Pricing Structure
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {/* Grace Period */}
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <span className="text-[10px] text-stone-500 font-semibold">Grace Period</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 text-right">
              {policy.gracePeriodMinutes} phút miễn phí
            </span>

            {/* Block Price */}
            {policy.blockPrice > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-[10px] text-stone-500 font-semibold">Block đầu tiên</span>
                </div>
                <span className="text-[10px] font-bold text-blue-600 text-right">
                  {policy.blockPrice.toLocaleString('vi-VN')}đ / {policy.blockMinutes}ph
                </span>
              </>
            )}

            {/* Hourly Rate */}
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF4C4C] flex-shrink-0" />
              <span className="text-[10px] text-stone-500 font-semibold">Giá theo giờ</span>
            </div>
            <span className="text-[10px] font-bold text-[#FF4C4C] text-right">
              {policy.hourlyRate.toLocaleString('vi-VN')}đ / giờ
            </span>

            {/* Daily Max Rate */}
            {policy.dailyMaxRate > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                  <span className="text-[10px] text-stone-500 font-semibold">Tối đa / ngày</span>
                </div>
                <span className="text-[10px] font-bold text-purple-600 text-right">
                  {policy.dailyMaxRate.toLocaleString('vi-VN')}đ
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Parking Summary Card ── */}
      <div className="rounded-2xl bg-blue-50/70 border border-blue-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">P</span>
          </div>
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">
            Your Parking
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Left: Entry → Exit times */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-2xl font-black text-blue-600 leading-none">
                {state.entryTime || '--:--'}
              </span>
              <span className="text-[10px] text-stone-400 font-bold mt-1">
                {formatDateDisplay(state.entryDate)}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-stone-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                {state.duration}h
              </span>
              <div className="w-8 h-px bg-blue-300" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-2xl font-black text-emerald-600 leading-none">
                {exitInfo.time}
              </span>
              <span className="text-[10px] text-stone-400 font-bold mt-1">{exitInfo.date}</span>
            </div>
          </div>

          {/* Right: Estimated Cost */}
          <div className="text-right flex-shrink-0">
            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1">
              Est. Cost
            </p>
            {costResult.total > 0 ? (
              <>
                <p className="text-xl font-black text-[#FF4C4C]">
                  {costResult.total.toLocaleString('vi-VN')}đ
                </p>
                {costResult.isCapped && (
                  <span className="text-[9px] font-bold text-purple-500 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full">
                    Giá trần/ngày
                  </span>
                )}
              </>
            ) : (
              <p className="text-xl font-black text-stone-300">--</p>
            )}
          </div>
        </div>

        {/* ── Chi phí breakdown ── */}
        {costResult.breakdown && costResult.total > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-100">
            <p className="text-[10px] text-stone-400 font-semibold">
              <span className="text-stone-500 font-bold">Cách tính: </span>
              {costResult.breakdown}
            </p>
          </div>
        )}
      </div>
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
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  floors: FloorResponse[];
  loading: boolean;
  allBuildingSlots: ParkingSlotDetail[];
}) {
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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 border border-[#FF4C4C]/25 flex items-center justify-center">
          <Layers size={20} className="text-[#FF4C4C]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-stone-900">Select Floor</h2>
          <p className="text-xs text-stone-500">Step 4 of 6 — Choose a floor to park on</p>
        </div>
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
                  : 'bg-white border-gray-200/80 hover:bg-gray-50 hover:border-gray-300'
                }`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${selected
                    ? 'bg-[#FF4C4C]/10 border-2 border-[#FF4C4C]/30'
                    : 'bg-gray-100 border-2 border-gray-200/60 group-hover:bg-[#FF4C4C]/10 group-hover:border-[#FF4C4C]/20'
                  }`}
              >
                <FloorIcon
                  size={24}
                  strokeWidth={1.5}
                  className={`transition-colors ${selected ? 'text-[#FF4C4C]' : 'text-stone-450 group-hover:text-[#FF4C4C]'
                    }`}
                />
              </div>
              <div className="text-center">
                <p className={`font-bold text-sm ${selected ? 'text-[#FF4C4C]' : 'text-stone-850'}`}>
                  {floor.name}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {(() => {
                    const availableSpots = allBuildingSlots.filter(
                      (s) => s.floorId === floor.id &&
                             s.vehicleTypeId === state.vehicleType &&
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
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  slots: ParkingSlotDetail[];
  vehicles: ApiVehicleType[];
}) {
  const [loadingAi, setLoadingAi] = useState(false);
  const COLS = 8; // Số cột trong lưới (A → H)

  const selectedVehicle = vehicles.find((v) => v.id === state.vehicleType);
  const isMotorbike = selectedVehicle?.name.toLowerCase().includes('moto') ||
    selectedVehicle?.name.toLowerCase().includes('xe máy') ||
    selectedVehicle?.name.toLowerCase().includes('bike') ||
    selectedVehicle?.name.toLowerCase().includes('xe hai bánh') ||
    false;
  const VehicleIcon = isMotorbike ? Bike : Car;

  // Lọc slots theo loại xe đã chọn (không hiển thị slots bảo trì)
  const filteredSlots = slots.filter(
    (s) => s.vehicleTypeId === state.vehicleType && s.status !== 'Maintenance'
  );

  // Nhóm các slots thành từng hàng (COLS ô mỗi hàng)
  const rows: ParkingSlotDetail[][] = [];
  for (let i = 0; i < filteredSlots.length; i += COLS) {
    rows.push(filteredSlots.slice(i, i + COLS));
  }

  const availableCount = filteredSlots.filter(s => s.status === 'Available' || String(s.status) === '0').length;
  const occupiedCount  = filteredSlots.filter(s => s.status === 'Occupied' || String(s.status) === '1').length;
  const reservedCount  = filteredSlots.filter(s => s.status === 'Reserved' || String(s.status) === '2').length;

  // Helper hàm để xác định màu hiển thị cho mỗi Slot
  const getSlotStyle = (slot: ParkingSlotDetail): string => {
    const isSelected = state.slotId === slot.id;
    if (isSelected) {
      return 'bg-[#FF4C4C] border-[#FF4C4C] text-white shadow-md shadow-[#FF4C4C]/30 scale-105 z-10';
    }
    
    // Một số backend serialize enum thành integer string, cần kiểm tra cả hai
    const isAvailable = slot.status === 'Available' || String(slot.status) === '0';
    const isOccupied = slot.status === 'Occupied' || String(slot.status) === '1';
    const isReserved = slot.status === 'Reserved' || String(slot.status) === '2';

    if (isAvailable) {
      return 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 hover:scale-105 cursor-pointer';
    } else if (isOccupied) {
      return 'bg-red-50 border-red-200/60 text-red-400/60 cursor-not-allowed';
    } else if (isReserved) {
      return 'bg-amber-50 border-amber-200/60 text-amber-500/70 cursor-not-allowed';
    } else {
      return 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed';
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
            <h2 className="text-lg font-bold text-stone-900">Select Slot</h2>
            <p className="text-xs text-stone-500">
              Step 5 of 5 — Pick an available parking spot
            </p>
          </div>
        </div>
        <button
          onClick={async () => {
            try {
              setLoadingAi(true);
              const token = localStorage.getItem('sp_token') || '';
              const suggestions = await getAiSuggestions(state.vehicleType!, undefined, 1, token);
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

      {/* ── Stats Thống kê nhanh ── */}
      <div className="flex items-center gap-4 flex-wrap">
        {[
          { label: 'Còn trống',  count: availableCount, dot: 'bg-emerald-400' },
          { label: 'Đang dùng',  count: occupiedCount,  dot: 'bg-red-400' },
          { label: 'Đặt trước', count: reservedCount,   dot: 'bg-amber-400' },
          { label: 'Tổng',       count: filteredSlots.length, dot: 'bg-stone-400' },
        ].map(({ label, count, dot }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            <span className="text-[11px] text-stone-500 font-semibold">{label}</span>
            <span className="text-[11px] font-bold text-stone-700">{count}</span>
          </div>
        ))}
      </div>

      {filteredSlots.length === 0 ? (
        <div className="py-14 text-center bg-gray-50 rounded-2xl border border-gray-200">
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
                    const isSelected = state.slotId === slot.id;
                    const isOccupied = slot.status === 'Occupied' || String(slot.status) === '1';

                    const colIdx = filteredSlots.indexOf(slot) % COLS;
                    const colLetter = String.fromCharCode(65 + colIdx);
                    const rowNum = Math.floor(filteredSlots.indexOf(slot) / COLS) + 1;

                    return (
                      <button
                        key={slot.id}
                        disabled={!isAvailable}
                        title={`${colLetter}${rowNum} · ${slot.slotNumber} · ${slot.status}`}
                        onClick={() => {
                          if (!isAvailable) return;
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
                          <VehicleIcon size={11} />
                        ) : (
                          <VehicleIcon size={11} className="opacity-60" />
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
      <div className="flex items-center flex-wrap gap-4 pt-3 border-t border-gray-100 text-[11px] text-stone-500">
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
    <div className="w-72 flex-shrink-0 bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200/80 flex items-center gap-2">
          <ClipboardList size={16} className="text-[#FF4C4C]" />
          <h3 className="text-sm font-bold text-stone-850">Booking Summary</h3>
        </div>

        {/* Rows */}
        <div className="px-5 py-4 space-y-3">
          {rows.map(({ label, value, muted }) => (
            <div key={label} className="flex items-start justify-between gap-3">
              <span className="text-xs text-stone-400 font-semibold flex-shrink-0">{label}</span>
              <span
                className={`text-xs font-bold text-right leading-snug ${muted ? 'text-stone-350 italic' : 'text-stone-700'
                  }`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-gray-200/80">
        {pricePerHour > 0 ? (
          <div className="bg-[#FF4C4C]/5 border border-[#FF4C4C]/15 rounded-xl p-4">
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
}: {
  lot: ParkingLot;
  state: WizardState;
  onClose: () => void;
  onDone: () => void;
  vehicles: ApiVehicleType[];
  floorLabel: string;
  myVehicles: VehicleResponse[];
}) {
  const [phase, setPhase] = useState<PopupPhase>('confirm');
  const [createdReservation, setCreatedReservation] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PAYOS_RESULT') {
        if (event.data.status === 'success') {
          setPhase('qr');
        } else {
          setError('Thanh toán thất bại hoặc đã bị hủy.');
          setPhase('payment');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const selectedVehicle = vehicles.find((v) => v.id === state.vehicleType);
  const pricePerHour = selectedVehicle?.hourlyRate ?? 0;
  const total = pricePerHour * state.duration;

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
      const exit = new Date(entry.getTime() + state.duration * 3600000);

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
      
      const paymentPayload = {
        amount: total,
        description: `Thanh toan don dat cho`,
        reservationId: res.id
      };

      const payOSRes = await createPayOSPayment(paymentPayload, token);
      
      // Thay vì chuyển trang, mở iframe PayOS ngay trong popup
      setCheckoutUrl(payOSRes.checkoutUrl);
      setPhase('checkout');
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Reservation failed. Please check your information.');
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (phase === 'qr') {
      localStorage.setItem('latest_booking_qr', qrData);
    }
  }, [phase, qrData]);

  const formatDateDisplay = (d: string) => {
    if (!d) return '--';
    const [y, mo, dd] = d.split('-');
    return `${dd}/${mo}/${y}`;
  };

  const exitTime = (() => {
    if (!state.entryDate || !state.entryTime) return '--:--';
    const [h, m] = state.entryTime.split(':').map(Number);
    const entry = new Date(state.entryDate);
    entry.setHours(h, m, 0, 0);
    const ex = new Date(entry.getTime() + state.duration * 3600000);
    return `${String(ex.getHours()).padStart(2, '0')}:${String(ex.getMinutes()).padStart(2, '0')}`;
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up">

        {/* ── Header ── */}
        <div className={`px-6 pt-6 pb-5 border-b border-gray-100 ${headerConfig.headerBg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${headerConfig.iconBg}`}>
                {headerConfig.icon}
              </div>
              <div>
                <h2 className="text-base font-bold text-stone-850">{headerConfig.title}</h2>
                <p className="text-xs text-stone-400 font-medium">{headerConfig.subtitle}</p>
              </div>
            </div>
            {phase !== 'payment' && (
              <button
                onClick={phase === 'qr' ? onDone : onClose}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-gray-100 transition-all"
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
              <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
                {rows.map(({ label, value }, i) => (
                  <div
                    key={label}
                    className={`flex items-start justify-between gap-4 px-4 py-3 ${i < rows.length - 1 ? 'border-b border-gray-150' : ''
                      }`}
                  >
                    <span className="text-xs text-stone-400 font-semibold flex-shrink-0">{label}</span>
                    <span className="text-xs font-bold text-stone-700 text-right">{value}</span>
                  </div>
                ))}
              </div>
              <div className="bg-[#FF4C4C]/5 border border-[#FF4C4C]/15 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-stone-400 font-bold mb-0.5">Estimated Total Cost</p>
                  <p className="text-xs text-stone-400 font-medium">{state.duration}h × {formatCurrency(pricePerHour)}</p>
                </div>
                <p className="text-2xl font-black text-[#FF4C4C]">{formatCurrency(total)}</p>
              </div>
            </div>
          )}

          {/* ── Phase: Payment ── */}
          {phase === 'payment' && (
            <div className="space-y-5">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">Reserved Location</p>
                  <p className="text-sm font-bold text-stone-800">{floorLabel} › {state.zone} › Slot {state.slot}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{lot.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">Total Price</p>
                  <p className="text-xl font-black text-[#FF4C4C]">{formatCurrency(total)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Thanh Toán</p>
                <div className="bg-white border-2 border-[#FF4C4C] rounded-xl p-4 text-center">
                  <p className="text-sm font-bold text-stone-800 mb-2">Thanh toán qua Ngân hàng (VietQR)</p>
                  <p className="text-xs text-stone-500">
                    Bạn sẽ được chuyển hướng tới cổng thanh toán an toàn của PayOS. Vui lòng sử dụng ứng dụng Ngân hàng để quét mã QR và hoàn tất thanh toán.
                  </p>
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

          {/* ── Phase: Checkout (Iframe) ── */}
          {phase === 'checkout' && checkoutUrl && (
            <div className="w-full flex flex-col items-center justify-center">
              <div className="w-full h-[550px] relative overflow-hidden rounded-2xl border border-gray-200">
                <iframe 
                  src={checkoutUrl} 
                  className="w-full h-full border-0 absolute top-0 left-0" 
                  title="PayOS Checkout" 
                />
              </div>
            </div>
          )}

          {/* ── Phase: QR Code ── */}
          {phase === 'qr' && (
            <div className="flex flex-col items-center gap-5">
              {/* Success badge */}
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-4 py-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span className="text-xs font-bold text-emerald-600">Payment Successful</span>
              </div>

              {/* QR Code */}
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-[#FF4C4C]/5 blur-lg" />
                <div className="relative bg-white border border-gray-200/80 rounded-2xl p-4 shadow-xl flex items-center justify-center min-w-[212px] min-h-[212px]">
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
              <div className="w-full bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
                {[
                  { label: 'Parking Lot', value: lot.name },
                  { label: 'License Plate', value: state.licensePlate },
                  { label: 'Location', value: `${floorLabel} › ${state.zone} › Slot ${state.slot}` },
                  { label: 'Entry Time', value: `${formatDateDisplay(state.entryDate)} ${state.entryTime}` },
                  { label: 'Est. Exit Time', value: `${formatDateDisplay(state.entryDate)} ${exitTime}` },
                ].map(({ label, value }, i, arr) => (
                  <div
                    key={label}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-gray-150' : ''
                      }`}
                  >
                    <span className="text-xs text-stone-400 font-semibold flex-shrink-0">{label}</span>
                    <span className="text-xs font-bold text-stone-700 text-right">{value}</span>
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
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3 bg-gray-50/50">
          {phase === 'confirm' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-stone-500 border border-gray-200 hover:text-stone-900 hover:bg-gray-50 transition-all"
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
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-stone-500 border border-gray-200 hover:text-stone-900 hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                <ChevronLeft size={15} />
                Back
              </button>
              <button
                disabled={submitting}
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
                setPhase('payment');
                setCheckoutUrl(null);
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-stone-500 border border-gray-200 hover:text-stone-900 hover:bg-gray-50 transition-all"
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
                      : 'bg-gray-50 border-gray-200 text-stone-400'
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
export default function BookingWizard({ lot, onClose }: BookingWizardProps) {
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
    duration: 2,
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

        // Tự động điền xe mặc định (isPrimary) hoặc xe đầu tiên nếu người dùng chưa nhập biển số
        if (data.length > 0) {
          const primary = data.find(v => v.isPrimary) || data[0];
          setState(s => {
            if (!s.licensePlate) {
              return {
                ...s,
                licensePlate: primary.plateNumber,
                vehicleType: primary.vehicleTypeId,
              };
            }
            return s;
          });
        }
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
        const slotsArrays = await Promise.all(
          sorted.map((f) => getSlotsByFloor(f.id).catch(() => []))
        );
        const flatSlots = slotsArrays.flat();
        setAllBuildingSlots(flatSlots);
      } catch (err) {
        console.error('Lỗi khi tải tầng:', err);
      } finally {
        setLoadingFloors(false);
      }
    }
    loadFloors();
  }, [lot.id]);

  // Load slots when floor changes
  useEffect(() => {
    if (!state.floor) {
      setSlots([]);
      return;
    }
    async function loadSlots() {
      try {
        setLoadingSlots(true);
        const data = await getSlotsByFloor(state.floor);
        setSlots(data);
      } catch (err) {
        console.error('Lỗi khi tải ô đỗ xe:', err);
      } finally {
        setLoadingSlots(false);
      }
    }
    loadSlots();
  }, [state.floor]);

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
      case 1: return <StepVehicleType state={state} setState={setState} vehicles={vehicles} loading={loadingVehicles} />;
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
      case 4: return <StepSelectFloor state={state} setState={setState} floors={floors} loading={loadingFloors} allBuildingSlots={allBuildingSlots} />;
      case 5: return <StepSelectSlot state={state} setState={setState} slots={slots} vehicles={vehicles} />;
      default: return null;
    }
  };

  return (
    <>
      {/* ── Wizard Backdrop + Modal ── */}
      <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-sm">
        <div
          className="relative w-full max-w-2xl bg-white border border-gray-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '90vh' }}
        >
          {/* ── Modal Header ── */}
          <div className="flex-shrink-0 px-6 pt-6 pb-5 border-b border-gray-150">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-base font-bold text-stone-850">Book a Parking Spot</h1>
                <p className="text-xs text-stone-400 font-semibold mt-0.5 truncate max-w-xs">{lot.name}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-gray-100 transition-all"
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
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-150 flex items-center justify-between gap-3 bg-gray-50/50">
            <button
              onClick={step === 1 ? onClose : handleBack}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-stone-500 border border-gray-200 hover:text-stone-900 hover:bg-gray-50 transition-all"
            >
              <ChevronLeft size={16} />
              {step === 1 ? 'Close' : 'Back'}
            </button>

            <span className="text-xs text-stone-450 font-bold">
              {step} / {STEPS.length}
            </span>

            {step < 5 ? (
              <button
                onClick={handleNext}
                disabled={!canAdvance()}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${canAdvance()
                    ? 'bg-[#FF4C4C] hover:bg-[#E13B3B] text-white shadow-sm shadow-[#FF4C4C]/10'
                    : 'bg-gray-100 text-stone-300 border-gray-200/80 cursor-not-allowed'
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
                    : 'bg-gray-100 text-stone-300 border-gray-200/80 cursor-not-allowed'
                  }`}
              >
                <CheckCircle2 size={16} />
                Confirm Booking
              </button>
            )}
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
        />
      )}
    </>
  );
}
