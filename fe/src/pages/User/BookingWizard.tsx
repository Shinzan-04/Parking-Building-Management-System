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
} from 'lucide-react';
import { getVehicleTypes } from '../../services/vehicleTypesService';
import { getAllPolicies } from '../../services/pricingService';

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
  zone: string | null;
  slot: string | null;
}

interface BookingWizardProps {
  lot: ParkingLot;
  onClose: () => void;
}

// ─────────────────────────────────────────────
// Hard-coded parking layout data
// ─────────────────────────────────────────────
const FLOORS = ['Tầng 1', 'Tầng 2', 'Tầng 3', 'Tầng 4'];

const ZONES_BY_FLOOR: Record<string, string[]> = {
  'Tầng 1': ['Khu A', 'Khu B', 'Khu C'],
  'Tầng 2': ['Khu A', 'Khu B'],
  'Tầng 3': ['Khu A', 'Khu B', 'Khu C', 'Khu D'],
  'Tầng 4': ['Khu A'],
};

// null = occupied, string = available slot code
const generateSlots = (floor: string, zone: string): (string | null)[] => {
  const seed = floor.charCodeAt(2) + zone.charCodeAt(4);
  return Array.from({ length: 20 }, (_, i) => {
    const occupied = (seed + i * 7) % 5 === 0;
    return occupied ? null : `${zone.replace('Khu ', '')}${String(i + 1).padStart(2, '0')}`;
  });
};

// ─────────────────────────────────────────────
// Step definitions
// ─────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Vehicle Type', short: 'Vehicle' },
  { id: 2, label: 'License Plate', short: 'Plate' },
  { id: 3, label: 'Date & Time', short: 'Time' },
  { id: 4, label: 'Select Floor', short: 'Floor' },
  { id: 5, label: 'Select Zone', short: 'Zone' },
  { id: 6, label: 'Select Slot', short: 'Slot' },
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

// Step 1 – Vehicle Type
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
        <Loader2 size={32} className="text-amber-400 animate-spin" />
        <p className="text-sm text-slate-400">Đang tải danh sách loại xe...</p>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Car size={48} className="text-slate-600 mb-3" />
        <p className="text-sm text-slate-400 font-bold">Không tìm thấy loại xe nào</p>
        <p className="text-xs text-slate-600">Vui lòng kiểm tra lại cấu hình hệ thống.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <Car size={20} className="text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Select Vehicle Type</h2>
          <p className="text-sm text-slate-500">Step 1 of 6 — Choose your vehicle category</p>
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
              className={`flex-1 flex flex-col items-center gap-5 py-10 rounded-2xl border-2 transition-all duration-200 group ${
                selected
                  ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                  : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.07] hover:border-white/20'
              }`}
            >
              {/* Icon container – outline icon màu amber trên nền tròn mờ */}
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                  selected
                    ? 'bg-amber-500/20 border-2 border-amber-500/40'
                    : 'bg-white/[0.06] border-2 border-white/10 group-hover:bg-amber-500/10 group-hover:border-amber-500/20'
                }`}
              >
                <Icon
                  size={44}
                  strokeWidth={1.5}
                  className={`transition-colors duration-200 ${
                    selected ? 'text-amber-400' : 'text-slate-400 group-hover:text-amber-400'
                  }`}
                />
              </div>

              <div className="text-center px-4">
                <p
                  className={`font-bold text-base ${
                    selected ? 'text-amber-400' : 'text-slate-200'
                  }`}
                >
                  {v.name}
                </p>
                {v.description && (
                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                    {v.description}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1.5 font-semibold">
                  {formatCurrency(v.hourlyRate)}/hr
                </p>
              </div>

              {selected && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                  <CheckCircle2 size={14} className="text-amber-400" />
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
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  vehicles: ApiVehicleType[];
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

  return (
    <div className="flex flex-col gap-7">
      {/* Step header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <ParkingSquare size={20} className="text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Enter License Plate</h2>
          <p className="text-sm text-slate-500">
            Step 2 of 6 — Your vehicle's identification number
          </p>
        </div>
      </div>

      {/* Vehicle type display */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-24 h-24 rounded-2xl bg-white/[0.05] border-2 border-white/10 flex items-center justify-center">
          <VehicleIcon
            size={52}
            strokeWidth={1.5}
            className="text-amber-400"
          />
        </div>
        <span className="text-sm font-semibold text-slate-400">{vehicleLabel}</span>
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
            className="w-full bg-white/[0.04] border-2 border-amber-500/40 focus:border-amber-500 rounded-2xl px-6 py-4 text-white text-2xl font-black text-center tracking-[0.25em] placeholder-slate-700 outline-none transition-all duration-200 shadow-lg shadow-amber-500/5 focus:shadow-amber-500/15"
          />
        </div>

        {/* Format hint */}
        <div className="text-center space-y-1">
          <p className="text-xs text-slate-500">
            Format:{' '}
            <span className="text-slate-300 font-semibold">51A-12345</span>{' '}
            (car) or{' '}
            <span className="text-slate-300 font-semibold">59T1-12345</span>{' '}
            (motorcycle)
          </p>
          <p className="text-xs text-slate-600">
            This will be linked to your parking session.
          </p>
        </div>
      </div>
    </div>
  );
}

// Step 3 – Date & Time
function StepDateTime({
  state,
  setState,
  vehicles,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  vehicles: ApiVehicleType[];
}) {
  const durations = [1, 2, 3, 4, 6, 8, 12, 24];

  // Tính giờ ra dựa trên giờ vào + duration
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

  const selectedVehicle = vehicles.find((v) => v.id === state.vehicleType);
  const pricePerHour = selectedVehicle?.hourlyRate ?? 0;
  const total = pricePerHour * state.duration;
  const exitInfo = computeExitTime();

  return (
    <div className="flex flex-col gap-6">
      {/* Step header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <Calendar size={20} className="text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Date & Time</h2>
          <p className="text-sm text-slate-500">Step 3 of 6 — When do you plan to park?</p>
        </div>
      </div>

      {/* ── Booking Date ── */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          <Calendar size={12} className="text-amber-500" />
          Booking Date
        </label>
        <input
          type="date"
          value={state.entryDate}
          min={todayDateStr()}
          onChange={(e) => setState((s) => ({ ...s, entryDate: e.target.value }))}
          className="w-full bg-white/[0.05] border border-white/10 hover:border-white/20 focus:border-amber-500/60 rounded-xl px-4 py-3 text-white text-sm outline-none transition-all [color-scheme:dark]"
        />
      </div>

      {/* ── Arrival Time ── */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          <Clock size={12} className="text-amber-500" />
          Arrival Time
        </label>
        <input
          type="time"
          value={state.entryTime}
          onChange={(e) => setState((s) => ({ ...s, entryTime: e.target.value }))}
          className="w-full bg-white/[0.05] border border-white/10 hover:border-white/20 focus:border-amber-500/60 rounded-xl px-4 py-3 text-white text-sm outline-none transition-all [color-scheme:dark]"
        />
      </div>

      {/* ── Duration ── */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          <Clock size={12} className="text-amber-500" />
          Duration
        </label>
        <div className="flex flex-wrap gap-2">
          {durations.map((d) => (
            <button
              key={d}
              onClick={() => setState((s) => ({ ...s, duration: d }))}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                state.duration === d
                  ? 'bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/25'
                  : 'bg-white/[0.04] text-slate-400 border-white/10 hover:bg-white/[0.08] hover:text-white hover:border-white/20'
              }`}
            >
              {d}h
            </button>
          ))}
        </div>
      </div>

      {/* ── Parking Summary Card ── */}
      <div className="rounded-2xl bg-[#0D1520] border border-[#1E3A5F]/60 p-5 mt-1">
        {/* Label */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center">
            <span className="text-white text-[10px] font-black">P</span>
          </div>
          <span className="text-xs font-black text-slate-300 uppercase tracking-widest">
            Your Parking
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Left: times */}
          <div className="flex items-center gap-4">
            {/* Entry time */}
            <div className="flex flex-col gap-0.5">
              <span className="text-3xl font-black text-blue-400 leading-none">
                {state.entryTime || '--:--'}
              </span>
              <span className="text-xs text-slate-500 mt-1">
                {formatDateDisplay(state.entryDate)}
              </span>
            </div>

            {/* Duration badge */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-full">
                {state.duration}h
              </span>
              <div className="w-8 h-px bg-blue-500/50" />
            </div>

            {/* Exit time */}
            <div className="flex flex-col gap-0.5">
              <span className="text-3xl font-black text-emerald-400 leading-none">
                {exitInfo.time}
              </span>
              <span className="text-xs text-slate-500 mt-1">{exitInfo.date}</span>
            </div>
          </div>

          {/* Right: Est. Cost */}
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              Est. Cost
            </p>
            <p className="text-2xl font-black text-amber-400">
              {pricePerHour > 0 ? `${total.toLocaleString('vi-VN')}đ` : '--'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}



// Step 4 – Select Floor
function StepSelectFloor({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  // Icon tương ứng theo tầng
  const floorIconComponents = [ParkingSquare, Car, Layers, Building2];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <Layers size={20} className="text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Select Floor</h2>
          <p className="text-sm text-slate-500">Step 4 of 6 — Choose a floor to park on</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {FLOORS.map((floor, idx) => {
          const selected = state.floor === floor;
          const zones = ZONES_BY_FLOOR[floor]?.length ?? 0;
          const FloorIcon = floorIconComponents[idx % floorIconComponents.length];
          return (
            <button
              key={floor}
              onClick={() => setState((s) => ({ ...s, floor, zone: null, slot: null }))}
              className={`flex flex-col items-center gap-3 py-6 rounded-2xl border-2 transition-all group ${
                selected
                  ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                  : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.07] hover:border-amber-500/20'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${
                  selected
                    ? 'bg-amber-500/20 border-2 border-amber-500/40'
                    : 'bg-white/[0.06] border-2 border-white/10 group-hover:bg-amber-500/10 group-hover:border-amber-500/20'
                }`}
              >
                <FloorIcon
                  size={28}
                  strokeWidth={1.5}
                  className={`transition-colors ${
                    selected ? 'text-amber-400' : 'text-slate-400 group-hover:text-amber-400'
                  }`}
                />
              </div>
              <div className="text-center">
                <p className={`font-bold ${selected ? 'text-amber-400' : 'text-slate-200'}`}>
                  {floor}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{zones} khu vực</p>
              </div>
              {selected && (
                <CheckCircle2 size={16} className="text-amber-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Step 5 – Select Zone
function StepSelectZone({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const zones = state.floor ? ZONES_BY_FLOOR[state.floor] ?? [] : [];
  const zoneColors = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6'];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <LayoutGrid size={20} className="text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Select Zone</h2>
          <p className="text-sm text-slate-500">
            Step 5 of 6 — Zones available on {state.floor}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {zones.map((zone, idx) => {
          const selected = state.zone === zone;
          const color = zoneColors[idx % zoneColors.length];
          return (
            <button
              key={zone}
              onClick={() => setState((s) => ({ ...s, zone, slot: null }))}
              className={`flex flex-col items-center gap-3 py-6 rounded-2xl border-2 transition-all ${
                selected
                  ? 'border-amber-500 shadow-lg shadow-amber-500/10'
                  : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.07] hover:border-white/20'
              }`}
              style={
                selected
                  ? { background: `${color}18` }
                  : {}
              }
            >
              {/* Zone letter badge */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black"
                style={{
                  background: selected ? `${color}30` : 'rgba(255,255,255,0.05)',
                  color: selected ? color : '#94a3b8',
                  border: `2px solid ${selected ? color + '60' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {zone.replace('Khu ', '')}
              </div>
              <div className="text-center">
                <p className={`font-bold ${selected ? 'text-amber-400' : 'text-slate-200'}`}>
                  {zone}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">20 ô đỗ xe</p>
              </div>
              {selected && <CheckCircle2 size={16} className="text-amber-500" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Step 6 – Select Slot
function StepSelectSlot({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const slots = state.floor && state.zone ? generateSlots(state.floor, state.zone) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <ParkingSquare size={20} className="text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Select Slot</h2>
          <p className="text-sm text-slate-500">
            Step 6 of 6 — Pick an available parking spot
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-md bg-emerald-500/20 border border-emerald-500/40" />
          <span className="text-slate-400">Trống</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-md bg-amber-500/20 border-2 border-amber-500" />
          <span className="text-slate-400">Đang chọn</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-md bg-red-500/20 border border-red-500/40" />
          <span className="text-slate-400">Đã có xe</span>
        </div>
      </div>

      {/* Slot grid */}
      <div className="grid grid-cols-5 gap-2">
        {slots.map((slot, idx) => {
          const available = slot !== null;
          const selected = state.slot === slot;
          return (
            <button
              key={idx}
              disabled={!available}
              onClick={() => available && setState((s) => ({ ...s, slot }))}
              className={`aspect-square rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                !available
                  ? 'bg-red-500/10 border-red-500/30 text-red-500/40 cursor-not-allowed'
                  : selected
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/20 scale-105'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/60 hover:scale-105'
              }`}
            >
              {available ? (
                <>
                  <Car size={14} />
                  <span className="text-[10px] leading-none">{slot}</span>
                </>
              ) : (
                <Car size={14} />
              )}
            </button>
          );
        })}
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
}: {
  lot: ParkingLot;
  state: WizardState;
  vehicles: ApiVehicleType[];
}) {
  const selectedVehicle = vehicles.find((v) => v.id === state.vehicleType);
  const pricePerHour = selectedVehicle?.hourlyRate ?? 0;
  const total = pricePerHour * state.duration;

  const isMotorbike = selectedVehicle?.name.toLowerCase().includes('moto') || 
                      selectedVehicle?.name.toLowerCase().includes('xe máy') ||
                      selectedVehicle?.name.toLowerCase().includes('bike') ||
                      selectedVehicle?.name.toLowerCase().includes('xe hai bánh') ||
                      false;

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
      value: state.floor ?? 'Not selected',
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
    <div className="w-72 flex-shrink-0 bg-[#0D0D0F] border border-white/[0.07] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
        <ClipboardList size={16} className="text-amber-500" />
        <h3 className="text-sm font-bold text-white">Booking Summary</h3>
      </div>

      {/* Rows */}
      <div className="px-5 py-4 space-y-3.5">
        {rows.map(({ label, value, muted }) => (
          <div key={label} className="flex items-start justify-between gap-3">
            <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
            <span
              className={`text-xs font-semibold text-right leading-snug ${
                muted ? 'text-slate-600 italic' : 'text-slate-200'
              }`}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-white/[0.06]" />

      {/* Total */}
      <div className="px-5 py-4">
        {pricePerHour > 0 ? (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">Estimated total</span>
              <span className="text-xs text-slate-400">{state.duration}h × {formatCurrency(pricePerHour)}</span>
            </div>
            <p className="text-xl font-black text-amber-400">{formatCurrency(total)}</p>
          </div>
        ) : (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
            <p className="text-xs text-slate-600">Chọn loại xe để xem giá</p>
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

type PopupPhase = 'confirm' | 'payment' | 'qr';

const PAYMENT_METHODS = [
  { key: 'cash',  label: 'Tiền mặt',     icon: '💵' },
  { key: 'card',  label: 'Thẻ tín dụng', icon: '💳' },
  { key: 'momo',  label: 'MoMo',         icon: '🟣' },
  { key: 'vnpay', label: 'VNPay',        icon: '🔵' },
];

function ConfirmationPopup({
  lot,
  state,
  onClose,
  onDone,
  vehicles,
}: {
  lot: ParkingLot;
  state: WizardState;
  onClose: () => void;
  onDone: () => void;
  vehicles: ApiVehicleType[];
}) {
  const [phase, setPhase] = useState<PopupPhase>('confirm');
  const [payMethod, setPayMethod] = useState<string>('cash');

  const selectedVehicle = vehicles.find((v) => v.id === state.vehicleType);
  const pricePerHour = selectedVehicle?.hourlyRate ?? 0;
  const total = pricePerHour * state.duration;

  const isMotorbike = selectedVehicle?.name.toLowerCase().includes('moto') || 
                      selectedVehicle?.name.toLowerCase().includes('xe máy') ||
                      selectedVehicle?.name.toLowerCase().includes('bike') ||
                      selectedVehicle?.name.toLowerCase().includes('xe hai bánh') ||
                      false;

  // Mã đặt chỗ hardcode (sau này lấy từ API response)
  const bookingRef = `PKG-${Date.now().toString(36).toUpperCase().slice(-8)}`;

  // Dữ liệu nhúng vào QR (JSON compact)
  const qrData = JSON.stringify({
    ref: bookingRef,
    lot: lot.name,
    plate: state.licensePlate,
    vehicle: selectedVehicle?.name ?? '',
    slot: `${state.floor}/${state.zone}/${state.slot}`,
    date: state.entryDate,
    entry: state.entryTime,
    duration: state.duration,
  });

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
    { label: 'Bãi đỗ xe', value: lot.name },
    { label: 'Biển số',   value: state.licensePlate },
    { label: 'Loại xe',   value: selectedVehicle ? `${isMotorbike ? '🏍️' : '🚗'} ${selectedVehicle.name}` : 'Chưa chọn' },
    { label: 'Ngày vào',  value: `${formatDateDisplay(state.entryDate)} ${state.entryTime}` },
    { label: 'Giờ ra (dự kiến)', value: `${formatDateDisplay(state.entryDate)} ${exitTime}` },
    { label: 'Thời gian', value: `${state.duration}h` },
    { label: 'Vị trí',   value: `${state.floor} › ${state.zone} › Ô ${state.slot}` },
  ];

  // ─── Header config theo phase ───
  const headerConfig = {
    confirm: {
      icon: <ClipboardList size={18} className="text-amber-400" />,
      iconBg: 'bg-amber-500/15 border border-amber-500/30',
      headerBg: '',
      title: 'Xác nhận thông tin',
      subtitle: 'Kiểm tra kỹ trước khi xác nhận',
    },
    payment: {
      icon: <CheckCircle2 size={18} className="text-emerald-400" />,
      iconBg: 'bg-emerald-500/20 border border-emerald-500/40',
      headerBg: 'bg-emerald-500/5',
      title: 'Thanh toán',
      subtitle: 'Chọn phương thức thanh toán',
    },
    qr: {
      icon: <CheckCircle2 size={18} className="text-blue-400" />,
      iconBg: 'bg-blue-500/20 border border-blue-500/40',
      headerBg: 'bg-blue-500/5',
      title: 'Đặt chỗ thành công!',
      subtitle: 'Xuất trình mã QR cho nhân viên khi vào',
    },
  }[phase];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0E0E11] border border-white/[0.09] rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up">

        {/* ── Header ── */}
        <div className={`px-6 pt-6 pb-5 border-b border-white/[0.06] ${headerConfig.headerBg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${headerConfig.iconBg}`}>
                {headerConfig.icon}
              </div>
              <div>
                <h2 className="text-base font-bold text-white">{headerConfig.title}</h2>
                <p className="text-xs text-slate-500">{headerConfig.subtitle}</p>
              </div>
            </div>
            {/* Chỉ cho đóng ở phase confirm và qr */}
            {phase !== 'payment' && (
              <button
                onClick={phase === 'qr' ? onDone : onClose}
                className="p-1.5 rounded-xl text-slate-500 hover:text-white hover:bg-white/[0.07] transition-all"
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
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                {rows.map(({ label, value }, i) => (
                  <div
                    key={label}
                    className={`flex items-start justify-between gap-4 px-4 py-3 ${
                      i < rows.length - 1 ? 'border-b border-white/[0.05]' : ''
                    }`}
                  >
                    <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
                    <span className="text-xs font-semibold text-slate-200 text-right">{value}</span>
                  </div>
                ))}
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Tổng chi phí dự kiến</p>
                  <p className="text-xs text-slate-500">{state.duration}h × {formatCurrency(pricePerHour)}</p>
                </div>
                <p className="text-2xl font-black text-amber-400">{formatCurrency(total)}</p>
              </div>
            </div>
          )}

          {/* ── Phase: Payment ── */}
          {phase === 'payment' && (
            <div className="space-y-5">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Vị trí đặt</p>
                  <p className="text-sm font-bold text-white">{state.floor} › {state.zone} › Ô {state.slot}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{lot.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 mb-1">Tổng tiền</p>
                  <p className="text-xl font-black text-amber-400">{formatCurrency(total)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Phương thức thanh toán</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(({ key, label, icon }) => (
                    <button
                      key={key}
                      onClick={() => setPayMethod(key)}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                        payMethod === key
                          ? 'bg-amber-500/10 border-amber-500 text-white'
                          : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <span className="text-xl">{icon}</span>
                      <span className="text-xs font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-600 text-center">
                Bằng cách xác nhận, bạn đồng ý với điều khoản sử dụng dịch vụ.
              </p>
            </div>
          )}

          {/* ── Phase: QR Code ── */}
          {phase === 'qr' && (
            <div className="flex flex-col items-center gap-5">
              {/* Success badge */}
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">Thanh toán thành công</span>
              </div>

              {/* QR Code */}
              <div className="relative">
                {/* Glow ring */}
                <div className="absolute inset-0 rounded-2xl bg-amber-500/10 blur-xl" />
                <div className="relative bg-white rounded-2xl p-4 shadow-2xl">
                  <QRCodeSVG
                    value={qrData}
                    size={180}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#0a0a0c"
                    imageSettings={{
                      src: '', // có thể thêm logo vào đây
                      height: 0,
                      width: 0,
                      excavate: false,
                    }}
                  />
                </div>
              </div>

              {/* Booking ref */}
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-widest">Mã đặt chỗ</p>
                <p className="text-lg font-black text-amber-400 tracking-widest">{bookingRef}</p>
              </div>

              {/* Info summary */}
              <div className="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                {[
                  { label: 'Bãi đỗ xe', value: lot.name },
                  { label: 'Biển số',   value: state.licensePlate },
                  { label: 'Vị trí',   value: `${state.floor} › ${state.zone} › Ô ${state.slot}` },
                  { label: 'Giờ vào',  value: `${formatDateDisplay(state.entryDate)} ${state.entryTime}` },
                  { label: 'Giờ ra (d.k)', value: `${formatDateDisplay(state.entryDate)} ${exitTime}` },
                ].map(({ label, value }, i, arr) => (
                  <div
                    key={label}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                      i < arr.length - 1 ? 'border-b border-white/[0.05]' : ''
                    }`}
                  >
                    <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
                    <span className="text-xs font-semibold text-slate-200 text-right">{value}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-600 text-center px-4">
                Xuất trình mã QR này cho nhân viên tại bãi để xác nhận chỗ đỗ.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center gap-3 bg-[#0A0A0C]/60">
          {phase === 'confirm' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-white/10 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all"
              >
                Huỷ
              </button>
              <button
                onClick={() => setPhase('payment')}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={15} />
                Xác nhận
              </button>
            </>
          )}

          {phase === 'payment' && (
            <>
              <button
                onClick={() => setPhase('confirm')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-white/10 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all"
              >
                <ChevronLeft size={15} />
                Quay lại
              </button>
              <button
                onClick={() => setPhase('qr')}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={15} />
                Thanh toán ngay
              </button>
            </>
          )}

          {phase === 'qr' && (
            <button
              onClick={onDone}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={15} />
              Xong – Đóng
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
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all duration-300 ${
                  done
                    ? 'bg-amber-500 border-amber-500 text-black'
                    : active
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/30'
                    : 'bg-white/[0.03] border-white/10 text-slate-600'
                }`}
              >
                {done ? <CheckCircle2 size={16} /> : step.id}
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${
                  active ? 'text-amber-400' : done ? 'text-amber-500/60' : 'text-slate-600'
                }`}
              >
                {step.short}
              </span>
            </div>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div
                className={`w-12 sm:w-16 h-0.5 mb-5 mx-1 rounded-full transition-all duration-300 ${
                  done ? 'bg-amber-500' : 'bg-white/[0.06]'
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

  const [state, setState] = useState<WizardState>({
    vehicleType: null,
    licensePlate: '',
    entryDate: todayDateStr(),
    entryTime: nowTimeStr(),
    duration: 2,
    floor: null,
    zone: null,
    slot: null,
  });
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);

  // Load vehicle types & policies
  useEffect(() => {
    async function loadVehicleTypes() {
      try {
        setLoadingVehicles(true);
        const [types, policies] = await Promise.all([
          getVehicleTypes(),
          getAllPolicies()
        ]);
        
        const mapped = types.map(t => {
          const policy = policies.find(p => p.vehicleTypeId === t.id);
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
      case 5: return !!state.zone;
      case 6: return !!state.slot;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < 6 && canAdvance()) setStep((s) => s + 1);
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

  const renderStep = () => {
    switch (step) {
      case 1: return <StepVehicleType state={state} setState={setState} vehicles={vehicles} loading={loadingVehicles} />;
      case 2: return <StepLicensePlate state={state} setState={setState} vehicles={vehicles} />;
      case 3: return <StepDateTime state={state} setState={setState} vehicles={vehicles} />;
      case 4: return <StepSelectFloor state={state} setState={setState} />;
      case 5: return <StepSelectZone state={state} setState={setState} />;
      case 6: return <StepSelectSlot state={state} setState={setState} />;
      default: return null;
    }
  };

  return (
    <>
      {/* ── Wizard Backdrop + Modal ── */}
      <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 sm:p-6 bg-black/70">
        <div
          className="relative w-full max-w-4xl bg-[#0E0E11] border border-white/[0.08] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '90vh' }}
        >
          {/* ── Modal Header ── */}
          <div className="flex-shrink-0 px-6 pt-6 pb-5 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-base font-bold text-white">Đặt chỗ đỗ xe</h1>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{lot.name}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.07] transition-all"
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
          <div className="flex-shrink-0 px-6 py-4 border-t border-white/[0.06] flex items-center justify-between gap-3 bg-[#0A0A0C]/50">
            <button
              onClick={step === 1 ? onClose : handleBack}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-white/10 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all"
            >
              <ChevronLeft size={16} />
              {step === 1 ? 'Close' : 'Back'}
            </button>

            <span className="text-xs text-slate-600 font-medium">
              {step} / {STEPS.length}
            </span>

            {step < 6 ? (
              <button
                onClick={handleNext}
                disabled={!canAdvance()}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  canAdvance()
                    ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20'
                    : 'bg-white/5 text-slate-600 border border-white/10 cursor-not-allowed'
                }`}
              >
                Continue
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                disabled={!canAdvance()}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  canAdvance()
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                    : 'bg-white/5 text-slate-600 border border-white/10 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 size={16} />
                Xác nhận đặt chỗ
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Confirmation & Payment Popup ──
          Đặt NGOÀI backdrop div để tránh stacking context trap từ backdrop-filter */}
      {showConfirmPopup && (
        <ConfirmationPopup
          lot={lot}
          state={state}
          onClose={() => setShowConfirmPopup(false)}
          onDone={handlePaymentDone}
          vehicles={vehicles}
        />
      )}
    </>
  );
}
