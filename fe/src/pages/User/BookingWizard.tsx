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
import { getFloorsByBuilding, getBuildings } from '../../services/buildingsService';
import type { FloorResponse } from '../../services/buildingsService';
import { getSlotsByFloor } from '../../services/parkingService';
import type { ParkingSlotDetail } from '../../services/parkingService';
import { createReservation } from '../../services/reservationsService';

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
  slotId: string | null;
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
        <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 border border-[#FF4C4C]/25 flex items-center justify-center">
          <Calendar size={20} className="text-[#FF4C4C]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-stone-900">Date & Time</h2>
          <p className="text-xs text-stone-500">Step 3 of 6 — When do you plan to park?</p>
        </div>
      </div>

      {/* Inputs grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── Booking Date ── */}
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

        {/* ── Arrival Time ── */}
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

      {/* ── Parking Summary Card ── */}
      <div className="rounded-2xl bg-blue-50/70 border border-blue-100 p-5 mt-1">
        {/* Label */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">P</span>
          </div>
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">
            Your Parking
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Left: times */}
          <div className="flex items-center gap-4">
            {/* Entry time */}
            <div className="flex flex-col gap-0.5">
              <span className="text-2xl font-black text-blue-600 leading-none">
                {state.entryTime || '--:--'}
              </span>
              <span className="text-[10px] text-stone-400 font-bold mt-1">
                {formatDateDisplay(state.entryDate)}
              </span>
            </div>

            {/* Duration badge */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-stone-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                {state.duration}h
              </span>
              <div className="w-8 h-px bg-blue-300" />
            </div>

            {/* Exit time */}
            <div className="flex flex-col gap-0.5">
              <span className="text-2xl font-black text-emerald-600 leading-none">
                {exitInfo.time}
              </span>
              <span className="text-[10px] text-stone-400 font-bold mt-1">{exitInfo.date}</span>
            </div>
          </div>

          {/* Right: Est. Cost */}
          <div className="text-right flex-shrink-0">
            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1">
              Est. Cost
            </p>
            <p className="text-xl font-black text-[#FF4C4C]">
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
  floors,
  loading,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  floors: FloorResponse[];
  loading: boolean;
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
                <p className="text-xs text-stone-400 mt-0.5">{floor.slotCount} spots</p>
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

// Step 5 – Select Zone
function StepSelectZone({
  state,
  setState,
  slots,
  loading,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  slots: ParkingSlotDetail[];
  loading: boolean;
}) {
  const zoneColors = ['#FF4C4C', '#3B82F6', '#10B981', '#8B5CF6'];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={32} className="text-[#FF4C4C] animate-spin" />
        <p className="text-sm text-stone-500">Loading zones...</p>
      </div>
    );
  }

  // Lấy các zone độc nhất từ slots của tầng này
  const zones = Array.from(new Set(slots.map(s => getZoneName(s.slotNumber)))).sort();

  if (zones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LayoutGrid size={48} className="text-stone-300 mb-3" />
        <p className="text-sm text-stone-500 font-bold">No zones found</p>
        <p className="text-xs text-stone-400">This floor has no parking spots created.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 border border-[#FF4C4C]/25 flex items-center justify-center">
          <LayoutGrid size={20} className="text-[#FF4C4C]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-stone-900">Select Zone</h2>
          <p className="text-xs text-stone-500">
            Step 5 of 6 — Zones available on this floor
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {zones.map((zone, idx) => {
          const selected = state.zone === zone;
          const color = zoneColors[idx % zoneColors.length];
          const zoneSlotsCount = slots.filter(s => getZoneName(s.slotNumber) === zone).length;
          return (
            <button
              key={zone}
              onClick={() => setState((s) => ({ ...s, zone, slot: null, slotId: null }))}
              className={`flex flex-col items-center gap-3 py-6 rounded-2xl border-2 transition-all ${selected
                  ? 'border-[#FF4C4C] shadow-sm'
                  : 'bg-white border-gray-200/80 hover:bg-gray-50 hover:border-gray-300'
                }`}
              style={
                selected
                  ? { background: `${color}0C` }
                  : {}
              }
            >
              {/* Zone letter badge */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black"
                style={{
                  background: selected ? `${color}1A` : '#F3F3F5',
                  color: selected ? color : '#78716c',
                  border: `2px solid ${selected ? color + '40' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                {zone.replace('Zone ', '')}
              </div>
              <div className="text-center">
                <p className={`font-bold text-sm ${selected ? 'text-[#FF4C4C]' : 'text-stone-800'}`}>
                  {zone}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">{zoneSlotsCount} spots</p>
              </div>
              {selected && <CheckCircle2 size={16} className="text-[#FF4C4C]" />}
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
  slots,
  vehicles,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  slots: ParkingSlotDetail[];
  vehicles: ApiVehicleType[];
}) {
  const selectedVehicle = vehicles.find((v) => v.id === state.vehicleType);
  const isMotorbike = selectedVehicle?.name.toLowerCase().includes('moto') ||
    selectedVehicle?.name.toLowerCase().includes('xe máy') ||
    selectedVehicle?.name.toLowerCase().includes('bike') ||
    selectedVehicle?.name.toLowerCase().includes('xe hai bánh') ||
    false;
  const VehicleIcon = isMotorbike ? Bike : Car;

  // Lọc slots theo zone đã chọn và loại xe đã chọn
  const zoneSlots = slots.filter(
    (s) => getZoneName(s.slotNumber) === state.zone && s.vehicleTypeId === state.vehicleType
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 border border-[#FF4C4C]/25 flex items-center justify-center">
          <ParkingSquare size={20} className="text-[#FF4C4C]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-stone-900">Select Slot</h2>
          <p className="text-xs text-stone-500">
            Step 6 of 6 — Pick an available parking spot
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs font-medium">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-md bg-emerald-50 border border-emerald-200" />
          <span className="text-stone-500">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-md bg-[#FF4C4C]/10 border-2 border-[#FF4C4C]" />
          <span className="text-stone-500">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-md bg-red-50 border border-red-200" />
          <span className="text-stone-500">Occupied</span>
        </div>
      </div>

      {zoneSlots.length === 0 ? (
        <div className="py-10 text-center bg-gray-50 rounded-2xl border border-gray-150 p-4">
          <p className="text-sm text-stone-400 font-medium">No suitable slots found for your vehicle type in this zone.</p>
        </div>
      ) : (
        /* Slot grid */
        <div className="grid grid-cols-5 gap-2">
          {zoneSlots.map((slot) => {
            const isAvailable = slot.status === 'Available' || slot.status === '0' || (slot.status as unknown as number) === 0;
            const selected = state.slot === slot.slotNumber;
            return (
              <button
                key={slot.id}
                disabled={!isAvailable}
                onClick={() => isAvailable && setState((s) => ({ ...s, slot: slot.slotNumber, slotId: slot.id }))}
                className={`aspect-square rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center justify-center gap-1 ${!isAvailable
                    ? 'bg-red-50 border-red-200/60 text-red-400/50 cursor-not-allowed'
                    : selected
                      ? 'bg-[#FF4C4C]/10 border-[#FF4C4C] text-[#FF4C4C] shadow-sm shadow-[#FF4C4C]/10 scale-105'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-400 hover:scale-105'
                  }`}
              >
                <VehicleIcon size={14} />
                <span className="text-[10px] leading-none">{slot.slotNumber}</span>
              </button>
            );
          })}
        </div>
      )}
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

type PopupPhase = 'confirm' | 'payment' | 'qr';

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash', icon: '💵' },
  { key: 'card', label: 'Credit Card', icon: '💳' },
  { key: 'momo', label: 'MoMo', icon: '🟣' },
  { key: 'vnpay', label: 'VNPay', icon: '🔵' },
];

function ConfirmationPopup({
  lot,
  state,
  onClose,
  onDone,
  vehicles,
  floorLabel,
}: {
  lot: ParkingLot;
  state: WizardState;
  onClose: () => void;
  onDone: () => void;
  vehicles: ApiVehicleType[];
  floorLabel: string;
}) {
  const [phase, setPhase] = useState<PopupPhase>('confirm');
  const [payMethod, setPayMethod] = useState<string>('cash');
  const [createdReservation, setCreatedReservation] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    slot: `${floorLabel}/${state.zone}/${state.slot}`,
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

      const payload = {
        parkingSlotId: state.slotId!,
        vehicleTypeId: state.vehicleType!,
        licensePlate: state.licensePlate,
        startTime: entry.toISOString(),
        endTime: exit.toISOString(),
      };

      const res = await createReservation(payload, token);
      setCreatedReservation(res);
      setPhase('qr');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Reservation failed. Please check your information.');
    } finally {
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
    { label: 'Location', value: `${floorLabel} › ${state.zone} › Slot ${state.slot}` },
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
                <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Payment Method</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(({ key, label, icon }) => (
                    <button
                      key={key}
                      onClick={() => setPayMethod(key)}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${payMethod === key
                          ? 'bg-[#FF4C4C]/5 border-[#FF4C4C] text-stone-800'
                          : 'bg-white border-gray-200/80 text-stone-500 hover:border-gray-300 hover:text-stone-855'
                        }`}
                    >
                      <span className="text-xl">{icon}</span>
                      <span className="text-xs font-bold">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-150 text-red-500 text-xs px-4 py-3 rounded-2xl text-center font-bold">
                  ⚠️ {error}
                </div>
              )}

              <p className="text-xs text-stone-400 font-medium text-center">
                By confirming, you agree to the terms of service.
              </p>
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
  const [slots, setSlots] = useState<ParkingSlotDetail[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [state, setState] = useState<WizardState>({
    vehicleType: null,
    licensePlate: '',
    entryDate: todayDateStr(),
    entryTime: nowTimeStr(),
    duration: 2,
    floor: null,
    zone: null,
    slot: null,
    slotId: null,
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

  const selectedFloorObj = floors.find(f => f.id === state.floor);
  const floorLabel = selectedFloorObj?.name ?? 'Not selected';

  const renderStep = () => {
    switch (step) {
      case 1: return <StepVehicleType state={state} setState={setState} vehicles={vehicles} loading={loadingVehicles} />;
      case 2: return <StepLicensePlate state={state} setState={setState} vehicles={vehicles} />;
      case 3: return <StepDateTime state={state} setState={setState} vehicles={vehicles} />;
      case 4: return <StepSelectFloor state={state} setState={setState} floors={floors} loading={loadingFloors} />;
      case 5: return <StepSelectZone state={state} setState={setState} slots={slots} loading={loadingSlots} />;
      case 6: return <StepSelectSlot state={state} setState={setState} slots={slots} vehicles={vehicles} />;
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

            {step < 6 ? (
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
        />
      )}
    </>
  );
}
