/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2, ParkingSquare, CircleCheck, Wrench,
  Plus, Search, Pencil, Trash2, MapPin,
  X, AlertTriangle, Eye, Loader2, Car, Save,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getBuildings, getFloors, getParkingSlots, isSlotOccupied, isSlotMaintenance,
  createBuilding, updateBuilding, deleteBuilding,
  createFloor, deleteFloor, getFloorsByBuilding,
  getVehicleTypes, createParkingSlot, updateFloor,
} from '../../services/buildingsService';
import type { FloorResponse, ParkingSlotSummary, VehicleTypeResponse } from '../../services/buildingsService';
import { getSlotsByFloor, updateSlotStatus } from '../../services/parkingService';
import type { ParkingSlotDetail } from '../../services/parkingService';

interface ParkingLot {
  id: string;
  name: string;
  address: string;
  floorCount: number;
  totalSpots: number;   // totalCapacity from API (registered max)
  actualSlots: number;  // real active slots created across all floors
  usedSpots: number;
  status: 'active' | 'maintenance' | 'full';
}

const statusConfig = {
  active:      { label: 'Hoạt động', bg: 'bg-[#FF4C4C]/10', text: 'text-[#FF4C4C]', dot: 'bg-[#FF4C4C]' },
  full:        { label: 'Đầy chỗ',   bg: 'bg-amber-400/10',  text: 'text-amber-400',  dot: 'bg-amber-400' },
  maintenance: { label: 'Bảo trì',   bg: 'bg-red-400/10',    text: 'text-red-400',    dot: 'bg-red-400' },
};

const emptyForm = { name: '', address: '', totalSpots: '', status: 'active' as ParkingLot['status'] };

const COLS = 8;

function floorPrefix(floorName: string): string {
  const parts = floorName.trim().split(/\s+/);
  return parts[parts.length - 1].toUpperCase();
}

function OccupancyBar({ used, total }: { used: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((used / total) * 100);
  const color = pct >= 90 ? '#F87171' : '#FF4C4C';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-white/40">Tỷ lệ lấp đầy</span>
        <span className="font-semibold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function SlotMap({
  floors, slots, buildingId, selectedSlotId, onSelectSlot, onConfirm,
}: {
  floors: FloorResponse[];
  slots: ParkingSlotSummary[];
  buildingId: string;
  selectedSlotId: string | null;
  onSelectSlot: (id: string | null) => void;
  onConfirm?: (slotId: string, action: 'occupy' | 'release') => void | Promise<void>;
}) {
  const buildingFloors = floors
    .filter(f => f.buildingId === buildingId)
    .sort((a, b) => a.floorIndex - b.floorIndex);

  const [activeFloorId, setActiveFloorId] = useState<string>(buildingFloors[0]?.id ?? '');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (buildingFloors.length && !buildingFloors.find(f => f.id === activeFloorId)) {
      setActiveFloorId(buildingFloors[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  if (buildingFloors.length === 0) {
    return <p className="text-sm text-white/40 text-center py-6">Chưa có tầng nào cho tòa nhà này.</p>;
  }

  const floorSlots = slots
    .filter(s => s.floorId === activeFloorId && !isSlotMaintenance(s.status))
    .sort((a, b) => (a.slotNumber ?? '').localeCompare(b.slotNumber ?? '', undefined, { numeric: true, sensitivity: 'base' }))
    .map((s, i) => ({ ...s, index: i }));

  const rows: (typeof floorSlots[0])[][] = [];
  for (let i = 0; i < floorSlots.length; i += COLS) {
    rows.push(floorSlots.slice(i, i + COLS));
  }

  const activeFloor = buildingFloors.find(f => f.id === activeFloorId);
  const occupiedCount = floorSlots.filter(s => isSlotOccupied(s.status)).length;
  const freeCount = floorSlots.length - occupiedCount;
  const selectedSlot = floorSlots.find(s => s.id === selectedSlotId);
  const selectedIsOccupied = selectedSlot ? isSlotOccupied(selectedSlot.status) : false;

  return (
    <div className="space-y-4">
      {/* Floor tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {buildingFloors.map(f => (
          <button
            key={f.id}
            onClick={() => { setActiveFloorId(f.id); onSelectSlot(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              f.id === activeFloorId
                ? 'bg-[#FF4C4C] text-white'
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Column headers A, B, C… */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `1.5rem repeat(${COLS}, minmax(0, 1fr))` }}
      >
        <div />
        {Array.from({ length: COLS }, (_, c) => (
          <div key={c} className="text-center text-[10px] text-white/30 font-semibold">
            {String.fromCharCode(65 + c)}
          </div>
        ))}
      </div>

      {/* Slot rows */}
      <div className="space-y-1">
        {rows.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-4">Tầng này chưa có chỗ đỗ.</p>
        ) : (
          rows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className="grid gap-1 items-center"
              style={{ gridTemplateColumns: `1.5rem repeat(${COLS}, minmax(0, 1fr))` }}
            >
              {/* Row number */}
              <div className="text-center text-[10px] text-white/30 font-semibold">{rowIdx + 1}</div>

              {row.map((slot) => {
                const occupied = isSlotOccupied(slot.status);
                const isSelected = slot.id === selectedSlotId;
                const colLetter = String.fromCharCode(65 + (slot.index % COLS));
                const rowNum = Math.floor(slot.index / COLS) + 1;
                return (
                  <button
                    key={slot.id}
                    title={
                      occupied && isSelected ? `${colLetter}${rowNum}: Giải phóng chỗ này`
                      : occupied             ? `${colLetter}${rowNum}: Đang có xe — click để giải phóng`
                      : isSelected           ? `${colLetter}${rowNum}: Đang chọn`
                      :                        `${colLetter}${rowNum}: Chọn để phân bổ`
                    }
                    onClick={() => onSelectSlot(isSelected ? null : slot.id)}
                    className={`
                      h-9 rounded-md flex flex-col items-center justify-center gap-0.5
                      border text-[8px] font-bold transition-all select-none cursor-pointer
                      ${occupied && isSelected
                        ? 'bg-amber-400 border-amber-400 text-[#121214] shadow-md shadow-amber-400/30 scale-105 z-10'
                        : occupied
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-500/80 hover:bg-amber-400/20 hover:border-amber-400/60 hover:text-amber-300'
                          : isSelected
                            ? 'bg-[#FF4C4C] border-[#FF4C4C] text-white shadow-md shadow-[#FF4C4C]/30 scale-105 z-10'
                            : 'bg-white/5 border-white/10 text-white/30 hover:bg-[#FF4C4C]/10 hover:border-[#FF4C4C]/50 hover:text-[#FF4C4C]'
                      }
                    `}
                  >
                    {(occupied || isSelected) && <Car size={9} />}
                    <span>{slot.slotNumber ?? `${colLetter}${rowNum}`}</span>
                  </button>
                );
              })}

              {/* Fill empty cells on last row */}
              {row.length < COLS && Array.from({ length: COLS - row.length }, (_, k) => (
                <div key={`pad-${k}`} className="h-9" />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center flex-wrap gap-4 pt-2 border-t border-white/5 text-xs text-white/40">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-amber-500/15 border border-amber-500/40" />
          Đã dùng ({occupiedCount})
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-white/5 border border-white/10" />
          Còn trống ({freeCount})
        </div>
        {selectedSlotId && (
          <div className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded border ${selectedIsOccupied ? 'bg-amber-400 border-amber-400' : 'bg-[#FF4C4C] border-[#FF4C4C]'}`} />
            Đang chọn
          </div>
        )}
        <span className="ml-auto">{activeFloor?.name} · {floorSlots.length} chỗ</span>
      </div>

      {/* Selected slot banner */}
      {selectedSlotId && (
        selectedIsOccupied ? (
          /* ── Release banner ── */
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-400/10 border border-amber-400/30 rounded-xl">
            <div className="flex items-center gap-2 text-sm text-amber-400">
              <Car size={14} />
              <span>Chỗ đang có xe · Giải phóng?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={confirming}
                onClick={async () => {
                  if (!selectedSlotId) return;
                  setConfirming(true);
                  await onConfirm?.(selectedSlotId, 'release');
                  setConfirming(false);
                  onSelectSlot(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 text-[#121214] text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {confirming ? <Loader2 size={12} className="animate-spin" /> : <CircleCheck size={12} />}
                Giải phóng chỗ
              </button>
              <button
                onClick={() => onSelectSlot(null)}
                className="p-1.5 rounded-lg text-amber-400/60 hover:text-amber-400 hover:bg-amber-400/10 transition-all"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ) : (
          /* ── Assign banner ── */
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#FF4C4C]/10 border border-[#FF4C4C]/30 rounded-xl">
            <div className="flex items-center gap-2 text-sm text-[#FF4C4C]">
              <Car size={14} />
              <span>Chỗ trống · Phân bổ cho xe?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={confirming}
                onClick={async () => {
                  if (!selectedSlotId) return;
                  setConfirming(true);
                  await onConfirm?.(selectedSlotId, 'occupy');
                  setConfirming(false);
                  onSelectSlot(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF4C4C] text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {confirming ? <Loader2 size={12} className="animate-spin" /> : <CircleCheck size={12} />}
                Xác nhận phân bổ
              </button>
              <button
                onClick={() => onSelectSlot(null)}
                className="p-1.5 rounded-lg text-[#FF4C4C]/60 hover:text-[#FF4C4C] hover:bg-[#FF4C4C]/10 transition-all"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}


function getActiveToken(_reactToken?: string | null): string | null {
  try {
    const raw = localStorage.getItem('sp_user');
    const parsed = JSON.parse(raw ?? '{}');
    const t = parsed?.accessToken ?? parsed?.token ?? null;
    console.log('[getActiveToken] result:', t?.slice(0, 30));
    return t;
  } catch { return null; }
}

export default function ParkingLots() {
  const { token } = useAuth();

  const [lots, setLots]           = useState<ParkingLot[]>([]);
  const [allFloors, setAllFloors] = useState<FloorResponse[]>([]);
  const [allSlots, setAllSlots]   = useState<ParkingSlotSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [apiError, setApiError]   = useState('');
  const [search, setSearch]       = useState('');
  const [modalType, setModalType] = useState<'add' | 'detail' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected]   = useState<ParkingLot | null>(null);
  const [form, setForm]           = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [editFloors, setEditFloors]         = useState<FloorResponse[]>([]);
  const [floorLoading, setFloorLoading]     = useState(false);
  const [newFloorName, setNewFloorName]     = useState('');
  const [newFloorSlotCount, setNewFloorSlotCount] = useState('');
  const [newFloorVehicleTypeId, setNewFloorVehicleTypeId] = useState('');
  const [floorError, setFloorError]         = useState('');
  const [vehicleTypes, setVehicleTypes]     = useState<VehicleTypeResponse[]>([]);
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [editFloorName, setEditFloorName]   = useState('');
  const [editFloorAddedSlots, setEditFloorAddedSlots] = useState('');
  const [editFloorVehicleTypeId, setEditFloorVehicleTypeId] = useState('');
  const [editFloorActualCount, setEditFloorActualCount] = useState<number | null>(null);
  const [editFloorError, setEditFloorError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  async function loadData() {
    try {
      const [buildings, floors, slots] = await Promise.all([
        getBuildings(), getFloors(), getParkingSlots(),
      ]);

      setAllFloors(floors);
      const statusMap: Record<string | number, string> = { 0: 'Available', 1: 'Occupied', 2: 'Reserved', 3: 'Maintenance' };
      setAllSlots(slots.map(s => ({ ...s, status: statusMap[s.status] ?? s.status })));

      const fbMap: Record<string, string> = {};
      floors.forEach(f => { fbMap[f.id] = f.buildingId; });

      const occupiedCountPerBuilding: Record<string, number> = {};
      const actualSlotsPerBuilding: Record<string, number> = {};
      buildings.forEach(b => { occupiedCountPerBuilding[b.id] = 0; actualSlotsPerBuilding[b.id] = 0; });
      slots
        .filter(s => !isSlotMaintenance(s.status))
        .forEach(s => {
          const bid = fbMap[s.floorId];
          if (bid) {
            actualSlotsPerBuilding[bid] = (actualSlotsPerBuilding[bid] ?? 0) + 1;
            if (isSlotOccupied(s.status)) {
              occupiedCountPerBuilding[bid] = (occupiedCountPerBuilding[bid] ?? 0) + 1;
            }
          }
        });

      setLots(buildings.map(b => {
        const used = occupiedCountPerBuilding[b.id] ?? 0;
        const actual = actualSlotsPerBuilding[b.id] ?? 0;
        const pct = actual > 0 ? used / actual : 0;
        return {
          id: b.id,
          name: b.name,
          address: b.address,
          floorCount: b.floorCount,
          totalSpots: b.totalCapacity,
          actualSlots: actual,
          usedSpots: used,
          status: pct >= 1 ? 'full' : 'active',
        };
      }));
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    getVehicleTypes().then(setVehicleTypes).catch(() => {});
  }, []);

  const openAdd    = () => { setForm(emptyForm); setFormError(''); setModalType('add'); };
  const openDetail = (lot: ParkingLot) => { setSelected(lot); setSelectedSlotId(null); setModalType('detail'); };
  const openEdit   = (lot: ParkingLot) => {
    setSelected(lot);
    setForm({ name: lot.name, address: lot.address, totalSpots: String(lot.totalSpots), status: lot.status });
    setFormError('');
    setNewFloorName('');
    setFloorError('');
    setFloorLoading(true);
    setModalType('edit');
    getFloorsByBuilding(lot.id)
      .then(async floors => {
        const sorted = floors.sort((a, b) => a.floorIndex - b.floorIndex);
        const synced = await Promise.all(sorted.map(async fl => {
          try {
            const slots = await getSlotsByFloor(fl.id);
            return { ...fl, slotCount: slots.filter(s => !isSlotMaintenance(s.status)).length };
          } catch {
            return fl;
          }
        }));
        setEditFloors(synced);
        setFloorLoading(false);
      })
      .catch(() => {
        setFloorError('Không thể tải danh sách tầng.');
        setFloorLoading(false);
      });
  };
  const openDelete = (lot: ParkingLot) => { setSelected(lot); setModalType('delete'); };
  const closeModal = () => {
    setModalType(null); setSelected(null); setFormError(''); setSubmitting(false);
    setSelectedSlotId(null); setEditFloors([]); setNewFloorName('');
    setNewFloorSlotCount(''); setNewFloorVehicleTypeId(''); setFloorError('');
    setEditingFloorId(null);
  };

  const usedCapacity = editFloors.reduce((s, f) => s + (f.slotCount ?? 0), 0);
  const remainingCapacity = selected ? selected.totalSpots - usedCapacity : 0;

  const handleAddFloor = async () => {
    if (!selected || !token) return;
    const name = newFloorName.trim();
    if (!name) { setFloorError('Vui lòng nhập tên tầng.'); return; }
    const slotCount = Number(newFloorSlotCount);
    if (!newFloorSlotCount || isNaN(slotCount) || slotCount < 20) {
      setFloorError('Số chỗ mỗi tầng phải ít nhất 20.'); return;
    }
    if (slotCount > 100) {
      setFloorError('Số chỗ mỗi tầng không vượt quá 100.'); return;
    }
    if (slotCount > remainingCapacity) {
      setFloorError(`Vượt quá sức chứa còn lại (${remainingCapacity} chỗ).`); return;
    }
    if (!newFloorVehicleTypeId) {
      setFloorError('Vui lòng chọn loại xe cho các chỗ đỗ.'); return;
    }
    setFloorLoading(true); setFloorError('');
    try {
      const nextIndex = editFloors.length > 0 ? Math.max(...editFloors.map(f => f.floorIndex)) + 1 : 0;
      const created = await createFloor({ buildingId: selected.id, name, floorIndex: nextIndex }, token);

      const prefix = floorPrefix(created.name);
      await Promise.all(
        Array.from({ length: slotCount }, (_, i) =>
          createParkingSlot({
            floorId: created.id,
            vehicleTypeId: newFloorVehicleTypeId,
            slotNumber: `${prefix}-${String(i + 1).padStart(3, '0')}`,
          }, token)
        )
      );
      created.slotCount = slotCount;

      setEditFloors(prev => [...prev, created].sort((a, b) => a.floorIndex - b.floorIndex));
      setAllFloors(prev => [...prev, created]);
      setLots(prev => prev.map(l => l.id === selected.id ? { ...l, floorCount: l.floorCount + 1 } : l));
      setNewFloorName('');
      setNewFloorSlotCount('');
      setNewFloorVehicleTypeId('');
      getParkingSlots().then(setAllSlots).catch(() => {});
    } catch (e: unknown) {
      setFloorError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
    } finally {
      setFloorLoading(false);
    }
  };

  const startEditFloor = (f: FloorResponse) => {
    setEditingFloorId(f.id);
    setEditFloorName(f.name);
    setEditFloorAddedSlots('');
    setEditFloorVehicleTypeId('');
    setEditFloorActualCount(null);
    setEditFloorError('');
    getSlotsByFloor(f.id).then(slots => {
      const actual = slots.filter(s => !isSlotMaintenance(s.status)).length;
      setEditFloorActualCount(actual);
      setEditFloors(prev => prev.map(fl => fl.id === f.id ? { ...fl, slotCount: actual } : fl));
      setAllFloors(prev => prev.map(fl => fl.id === f.id ? { ...fl, slotCount: actual } : fl));
    }).catch(() => { setEditFloorActualCount(f.slotCount); });
  };

  const saveFloorEdit = async (f: FloorResponse) => {
    const activeToken = getActiveToken(token);
    if (!activeToken) { setEditFloorError('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.'); return; }
    if (!selected) return;
    const newName = editFloorName.trim();
    const targetCount = Number(editFloorAddedSlots);
    const isChangingSlots = editFloorAddedSlots !== '';
    setFloorLoading(true); setFloorError(''); setEditFloorError('');
    try {
      // ── Rename ──
      if (newName && newName !== f.name) {
        await updateFloor(f.id, { name: newName, floorIndex: f.floorIndex }, activeToken);
      }

      // ── Adjust slot count ──
      if (isChangingSlots) {
        if (isNaN(targetCount) || targetCount < 20) {
          setEditFloorError('Số chỗ tối thiểu mỗi tầng là 20.'); setFloorLoading(false); return;
        }
        if (targetCount > 100) {
          setEditFloorError('Số chỗ tối đa mỗi tầng là 100.'); setFloorLoading(false); return;
        }
        const currentSlots: ParkingSlotDetail[] = await getSlotsByFloor(f.id);
        const activeSlots = currentSlots.filter(s => !isSlotMaintenance(s.status));
        const activeCount = activeSlots.length;
        const diff = targetCount - activeCount;

        if (diff > 0) {
          const maintenanceSlots = currentSlots.filter(s => isSlotMaintenance(s.status));
          const toRestore = maintenanceSlots.slice(0, diff);
          const toCreate = diff - toRestore.length;

          const otherActual = editFloors.reduce((s, fl) => fl.id === f.id ? s : s + (fl.slotCount ?? 0), 0);
          const remaining = selected.totalSpots - otherActual - activeCount;
          if (diff > remaining) {
            setEditFloorError(`Chỉ còn ${remaining} chỗ có thể thêm cho tầng này.`); setFloorLoading(false); return;
          }
          if (toCreate > 0 && !editFloorVehicleTypeId) {
            setEditFloorError('Vui lòng chọn loại xe để thêm chỗ mới.'); setFloorLoading(false); return;
          }
          if (toRestore.length > 0) {
            const BATCH = 10;
            for (let i = 0; i < toRestore.length; i += BATCH) {
              await Promise.all(toRestore.slice(i, i + BATCH).map(s => updateSlotStatus(s.id, 'Available', activeToken)));
            }
          }
          if (toCreate > 0) {
            const totalExisting = currentSlots.length;
            const prefix = floorPrefix(f.name);
            await Promise.all(
              Array.from({ length: toCreate }, (_, i) =>
                createParkingSlot({
                  floorId: f.id,
                  vehicleTypeId: editFloorVehicleTypeId,
                  slotNumber: `${prefix}-${String(totalExisting + i + 1).padStart(3, '0')}`,
                }, activeToken)
              )
            );
          }
        } else if (diff < 0) {
          const freeSlots = activeSlots.filter(s => !isSlotOccupied(s.status));
          const toDisable = freeSlots.slice(0, Math.abs(diff));
          if (toDisable.length < Math.abs(diff)) {
            const inUse = Math.abs(diff) - toDisable.length;
            setEditFloorError(`Không thể giảm xuống ${targetCount} chỗ — còn ${inUse} chỗ đang được sử dụng.`);
            setFloorLoading(false); return;
          }
          const BATCH = 10;
          for (let i = 0; i < toDisable.length; i += BATCH) {
            await Promise.all(toDisable.slice(i, i + BATCH).map(s => updateSlotStatus(s.id, 'Maintenance', activeToken)));
          }
        }
      }

      const updatedFloor = {
        ...f,
        name: newName || f.name,
        slotCount: isChangingSlots ? targetCount : f.slotCount,
      };
      setEditFloors(prev => prev.map(fl => fl.id === f.id ? updatedFloor : fl));
      setAllFloors(prev => prev.map(fl => fl.id === f.id ? updatedFloor : fl));
      setEditingFloorId(null);
      setEditFloorAddedSlots('');
      setEditFloorVehicleTypeId('');
      getParkingSlots().then(setAllSlots).catch(() => {});
      showToast('success', `Đã lưu tầng "${newName || f.name}" · ${isChangingSlots ? targetCount : f.slotCount} chỗ`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Đã xảy ra lỗi khi sửa tầng.';
      setEditFloorError(msg);
      showToast('error', msg);
    } finally {
      setFloorLoading(false);
    }
  };

  const handleDeleteFloor = async (floorId: string) => {
    const activeToken = getActiveToken(token);
    if (!activeToken) return;
    setFloorLoading(true); setFloorError('');
    try {
      await deleteFloor(floorId, activeToken);
      setEditFloors(prev => prev.filter(f => f.id !== floorId));
      setAllFloors(prev => prev.filter(f => f.id !== floorId));
      if (selected) setLots(prev => prev.map(l => l.id === selected.id ? { ...l, floorCount: l.floorCount - 1 } : l));
      getParkingSlots().then(setAllSlots).catch(() => {});
    } catch (e: unknown) {
      setFloorError(e instanceof Error ? e.message : 'Không thể xoá tầng.');
    } finally {
      setFloorLoading(false);
    }
  };

  const validateForm = () => {
    if (!form.name.trim()) return 'Vui lòng nhập tên tòa nhà.';
    if (!form.address.trim()) return 'Vui lòng nhập địa chỉ.';
    if (!form.totalSpots || isNaN(Number(form.totalSpots)) || Number(form.totalSpots) <= 0)
      return 'Tổng sức chứa phải là số nguyên dương.';
    return '';
  };

  const handleAdd = async () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    const activeToken = getActiveToken(token);
    if (!activeToken) return;
    setSubmitting(true);
    try {
      const created = await createBuilding({
        name: form.name.trim(),
        address: form.address.trim(),
        totalCapacity: Number(form.totalSpots),
      }, activeToken);
      setLots(prev => [...prev, {
        id: created.id,
        name: created.name,
        address: created.address,
        floorCount: created.floorCount,
        totalSpots: created.totalCapacity,
        actualSlots: 0,
        usedSpots: 0,
        status: 'active',
      }]);
      closeModal();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    const activeToken = getActiveToken(token);
    if (!selected || !activeToken) return;
    setSubmitting(true);
    try {
      const updated = await updateBuilding(selected.id, {
        name: form.name.trim(),
        address: form.address.trim(),
        totalCapacity: Number(form.totalSpots),
      }, activeToken);
      setLots(prev => prev.map(l => l.id !== selected.id ? l : {
        ...l,
        name: updated.name,
        address: updated.address,
        totalSpots: updated.totalCapacity,
        floorCount: updated.floorCount,
        status: form.status,
      }));
      closeModal();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const activeToken = getActiveToken(token);
    if (!selected || !activeToken) return;
    setSubmitting(true);
    try {
      await deleteBuilding(selected.id, activeToken);
      setLots(prev => prev.filter(l => l.id !== selected.id));
      closeModal();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
      setSubmitting(false);
    }
  };

  const totalSpots    = lots.reduce((s, l) => s + l.totalSpots, 0);
  const totalActual   = lots.reduce((s, l) => s + l.actualSlots, 0);
  const usedSpots     = lots.reduce((s, l) => s + l.usedSpots, 0);
  const activeLots    = lots.filter(l => l.status === 'active').length;
  const inMaintenance = lots.filter(l => l.status === 'maintenance').length;

  const filtered = lots.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.address.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: 'Tổng số tòa',    value: lots.length,           unit: 'tòa', icon: Building2,     color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5' },
    { label: 'Tổng sức chứa',  value: totalSpots,             unit: 'chỗ', icon: ParkingSquare, color: '#A78BFA', bg: 'from-violet-400/20 to-violet-400/5' },
    { label: 'Đang còn trống', value: totalActual - usedSpots, unit: 'chỗ', icon: CircleCheck,   color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5' },
    { label: 'Đang bảo trì',   value: inMaintenance,          unit: 'tòa', icon: Wrench,        color: '#F87171', bg: 'from-red-400/20 to-red-400/5' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Bãi đỗ xe</h2>
          <p className="text-sm text-white/40 mt-0.5">
            Quản lý {lots.length} tòa nhà · {activeLots} đang hoạt động
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r bg-[#FF4C4C] text-black font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Thêm tòa nhà
        </button>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{apiError}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="glass-card p-5 rounded-2xl">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.bg} flex items-center justify-center mb-3`}>
                <Icon size={19} style={{ color: s.color }} />
              </div>
              <p className="text-2xl font-bold text-white">
                {s.value}
                <span className="text-sm font-normal text-white/40 ml-1">{s.unit}</span>
              </p>
              <p className="text-sm text-white/50 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="Tìm kiếm tòa nhà..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
        />
      </div>

      {/* Lot cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <p className="col-span-3 text-center py-12 text-white/30 text-sm">Không tìm thấy tòa nhà nào.</p>
        )}
        {filtered.map((lot) => {
          const cfg = statusConfig[lot.status];
          const available = lot.actualSlots - lot.usedSpots;
          return (
            <div key={lot.id} className="glass-card p-5 rounded-2xl flex flex-col gap-4 hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-white/70">{lot.floorCount}F</span>
                  </div>
                  <div>
                    <p className="font-semibold text-white">{lot.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={11} className="text-white/30" />
                      <span className="text-xs text-white/40 truncate max-w-[160px]">{lot.address}</span>
                    </div>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text} shrink-0`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
              </div>

              <OccupancyBar used={lot.usedSpots} total={lot.actualSlots} />

              {/* Slot stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 rounded-xl px-3 py-2 text-center col-span-2">
                  <p className="text-xs text-white/30 mb-1">Sức chứa tối đa</p>
                  <p className="text-lg font-bold text-white">{lot.totalSpots} <span className="text-xs font-normal text-white/30">chỗ</span></p>
                </div>
                <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
                  <p className="text-xs text-white/30 mb-1">Đã tạo</p>
                  <p className="text-lg font-bold text-white/70">{lot.actualSlots}</p>
                </div>
                <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
                  <p className="text-xs text-white/30 mb-1">Chưa tạo</p>
                  <p className="text-lg font-bold text-white/40">{lot.totalSpots - lot.actualSlots}</p>
                </div>
                <div className="bg-[#FF4C4C]/5 border border-[#FF4C4C]/15 rounded-xl px-3 py-2 text-center">
                  <p className="text-xs text-white/30 mb-1">Đang đỗ</p>
                  <p className="text-lg font-bold text-[#FF4C4C]">{lot.usedSpots}</p>
                </div>
                <div className="bg-[#FF4C4C]/5 border border-[#FF4C4C]/15 rounded-xl px-3 py-2 text-center">
                  <p className="text-xs text-white/30 mb-1">Còn trống</p>
                  <p className="text-lg font-bold text-[#FF4C4C]">{available}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                <button
                  onClick={() => openDetail(lot)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
                >
                  <Eye size={13} />
                  Chi tiết
                </button>
                <button
                  onClick={() => openEdit(lot)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-[#FF4C4C]/70 hover:text-[#FF4C4C] hover:bg-[#FF4C4C]/10 transition-all"
                >
                  <Pencil size={13} />
                  Chỉnh sửa
                </button>
                <button
                  onClick={() => openDelete(lot)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all"
                >
                  <Trash2 size={13} />
                  Xoá
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── DETAIL MODAL ── */}
      {modalType === 'detail' && selected && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col bg-white dark:bg-[#0E0E10]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-gray-700 dark:text-white/70">{selected.floorCount}F</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-800 dark:text-white">{selected.name}</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={11} className="text-gray-400 dark:text-white/30" />
                    <span className="text-xs text-gray-400 dark:text-white/40">{selected.address}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[selected.status].bg} ${statusConfig[selected.status].text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[selected.status].dot}`} />
                  {statusConfig[selected.status].label}
                </span>
                <button onClick={closeModal} className="p-1.5 rounded-xl text-gray-400 dark:text-white/40 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Capacity summary */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 text-center col-span-2">
                  <p className="text-xs text-gray-400 dark:text-white/30 mb-1">Sức chứa tối đa đăng ký</p>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">{selected.totalSpots} <span className="text-sm font-normal text-gray-400 dark:text-white/30">chỗ</span></p>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 dark:text-white/30 mb-1">Đã tạo slot</p>
                  <p className="text-xl font-bold text-gray-700 dark:text-white/70">{selected.actualSlots}</p>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 dark:text-white/30 mb-1">Chưa tạo</p>
                  <p className="text-xl font-bold text-gray-400 dark:text-white/40">{selected.totalSpots - selected.actualSlots}</p>
                </div>
                <div className="bg-[#FF4C4C]/5 border border-[#FF4C4C]/15 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 dark:text-white/30 mb-1">Đang đỗ</p>
                  <p className="text-xl font-bold text-[#FF4C4C]">{selected.usedSpots}</p>
                </div>
                <div className="bg-[#FF4C4C]/5 border border-[#FF4C4C]/15 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 dark:text-white/30 mb-1">Còn trống</p>
                  <p className="text-xl font-bold text-[#FF4C4C]">{selected.actualSlots - selected.usedSpots}</p>
                </div>
              </div>

              <OccupancyBar used={selected.usedSpots} total={selected.actualSlots} />

              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-white mb-3">Sơ đồ chỗ đỗ</p>
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4">
                  <SlotMap
                    floors={allFloors}
                    slots={allSlots}
                    buildingId={selected.id}
                    selectedSlotId={selectedSlotId}
                    onSelectSlot={setSelectedSlotId}
                    onConfirm={async (slotId, action) => {
                      const activeToken = getActiveToken(token);
                      if (!activeToken) { showToast('error', 'Phiên đăng nhập hết hạn.'); return; }
                      const newStatus = action === 'release' ? 'Available' : 'Occupied';
                      try {
                        await updateSlotStatus(slotId, newStatus, activeToken);
                        const updatedSlots = allSlots.map(s => s.id === slotId ? { ...s, status: newStatus } : s);
                        setAllSlots(updatedSlots);
                        // Recalculate usedSpots for this building
                        const fbMap: Record<string, string> = {};
                        allFloors.forEach(f => { fbMap[f.id] = f.buildingId; });
                        const usedByBuilding: Record<string, number> = {};
                        updatedSlots.filter(s => isSlotOccupied(s.status)).forEach(s => {
                          const bid = fbMap[s.floorId];
                          if (bid) usedByBuilding[bid] = (usedByBuilding[bid] ?? 0) + 1;
                        });
                        setLots(prev => prev.map(l => ({
                          ...l,
                          usedSpots: usedByBuilding[l.id] ?? 0,
                          status: (usedByBuilding[l.id] ?? 0) >= l.actualSlots ? 'full' : l.status === 'full' ? 'active' : l.status,
                        })));
                        if (selected) setSelected(s => s ? { ...s, usedSpots: usedByBuilding[s.id] ?? 0 } : s);
                        showToast('success', action === 'release' ? 'Đã giải phóng chỗ đỗ!' : 'Đã phân bổ chỗ đỗ thành công!');
                      } catch (e) {
                        showToast('error', e instanceof Error ? e.message : 'Không thể cập nhật chỗ đỗ.');
                      }
                    }}
                  />
                </div>
              </div>

              {selected.status === 'maintenance' && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl">
                  <AlertTriangle size={16} className="text-red-400 shrink-0" />
                  <p className="text-sm text-red-400">Tòa nhà này đang trong quá trình bảo trì, không nhận xe.</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex justify-end gap-3">
              <button onClick={closeModal} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-white/60 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                Đóng
              </button>
              <button
                onClick={() => { closeModal(); openEdit(selected); }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r bg-[#FF4C4C] hover:opacity-90 transition-opacity"
              >
                Chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── ADD / EDIT MODAL ── */}
      {(modalType === 'add' || modalType === 'edit') && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] bg-white dark:bg-[#0E0E10]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FF4C4C]/10 flex items-center justify-center">
                  <Building2 size={17} className="text-[#FF4C4C]" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-gray-800 dark:text-white leading-tight">
                    {modalType === 'add' ? 'Thêm tòa nhà mới' : 'Chỉnh sửa tòa nhà'}
                  </h3>
                  {modalType === 'edit' && selected && (
                    <p className="text-[11px] text-gray-400 dark:text-white/35 mt-0.5">{selected.name}</p>
                  )}
                </div>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-xl text-gray-400 dark:text-white/35 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

              {/* ── Section: Thông tin cơ bản ── */}
              <div className="space-y-3">
                <p className="text-[10px] font-semibold text-gray-400 dark:text-white/25 uppercase tracking-widest">Thông tin cơ bản</p>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-white/45 mb-1.5">Tên tòa nhà</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Tòa A"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-white/45 mb-1.5">Địa chỉ</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 123 Đường Lê Lợi"
                    value={form.address}
                    onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                  />
                </div>
                <div className={`grid gap-3 ${modalType === 'edit' ? 'grid-cols-2' : ''}`}>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-white/45 mb-1.5">Tổng sức chứa (chỗ)</label>
                    <input
                      type="number"
                      placeholder="Ví dụ: 300"
                      value={form.totalSpots}
                      onChange={e => setForm(prev => ({ ...prev, totalSpots: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                    />
                  </div>
                  {modalType === 'edit' && (
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-white/45 mb-1.5">Trạng thái</label>
                      <select
                        value={form.status}
                        onChange={e => setForm(prev => ({ ...prev, status: e.target.value as ParkingLot['status'] }))}
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-[#FF4C4C]/50 transition-colors appearance-none"
                      >
                        <option value="active">Hoạt động</option>
                        <option value="maintenance">Bảo trì</option>
                        <option value="full">Đầy chỗ</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Section: Quản lý tầng (edit only) ── */}
              {modalType === 'edit' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-white/25 uppercase tracking-widest">Quản lý tầng</p>
                    <span className={`text-xs font-semibold ${remainingCapacity === 0 ? 'text-red-400' : 'text-gray-400 dark:text-white/40'}`}>
                      {usedCapacity} / {selected?.totalSpots ?? 0}
                      <span className="font-normal text-gray-400 dark:text-white/30"> chỗ phân bổ</span>
                    </span>
                  </div>

                  {/* Capacity bar */}
                  <div className="space-y-1">
                    <div className="h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, selected ? (usedCapacity / selected.totalSpots) * 100 : 0)}%`,
                          backgroundColor: remainingCapacity === 0 ? '#F87171'
                            : remainingCapacity < (selected?.totalSpots ?? 0) * 0.15 ? '#F59E0B'
                            : '#FF4C4C',
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 dark:text-white/25">
                      <span>0</span>
                      {remainingCapacity > 0
                        ? <span className="text-[#FF4C4C]/60">còn {remainingCapacity} chỗ</span>
                        : <span className="text-red-400/70">đã phân bổ đầy</span>}
                      <span>{selected?.totalSpots ?? 0}</span>
                    </div>
                  </div>

                  {/* Floor list */}
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {floorLoading && editFloors.length === 0 ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-400 dark:text-white/25">
                        <Loader2 size={13} className="animate-spin" /> Đang tải danh sách tầng...
                      </div>
                    ) : editFloors.length === 0 ? (
                      <div className="py-5 text-center text-xs text-gray-400 dark:text-white/25">Chưa có tầng nào</div>
                    ) : (
                      editFloors.map(f => (
                        <div
                          key={f.id}
                          className={`rounded-xl border transition-all ${
                            editingFloorId === f.id
                              ? 'border-[#FF4C4C]/25 bg-[#FF4C4C]/5'
                              : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/5'
                          }`}
                        >
                          {editingFloorId === f.id ? (
                            /* ── Inline edit panel ── */
                            <div className="p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-[#FF4C4C] flex items-center gap-1.5">
                                  <Pencil size={10} /> Chỉnh sửa tầng
                                </span>
                                <span className="text-[11px] text-gray-400 dark:text-white/35">
                                  {editFloorActualCount === null
                                    ? <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" />đang tải...</span>
                                    : `Hiện có ${editFloorActualCount} chỗ`}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-[11px] text-gray-400 dark:text-white/35 mb-1">Tên tầng</p>
                                  <input
                                    type="text"
                                    value={editFloorName}
                                    onChange={e => { setEditFloorName(e.target.value); setEditFloorError(''); }}
                                    className="w-full bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg px-2.5 py-2 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                                    placeholder="Tên tầng"
                                  />
                                </div>
                                {editFloorActualCount !== null && (() => {
                                  const cur = editFloorActualCount;
                                  const maxSlots = Math.min(100, cur + remainingCapacity);
                                  return (
                                    <div>
                                      <p className="text-[11px] text-gray-400 dark:text-white/35 mb-1">Số chỗ <span className="text-gray-300 dark:text-white/20">(20–{maxSlots})</span></p>
                                      <input
                                        type="number"
                                        placeholder={String(cur)}
                                        min={20}
                                        max={maxSlots}
                                        value={editFloorAddedSlots}
                                        onChange={e => { setEditFloorAddedSlots(e.target.value); setEditFloorError(''); }}
                                        className="w-full bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg px-2.5 py-2 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                                      />
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Vehicle type — only when adding slots */}
                              {editFloorActualCount !== null
                                && editFloorAddedSlots !== ''
                                && Number(editFloorAddedSlots) > editFloorActualCount && (
                                <div>
                                  <p className="text-[11px] text-gray-400 dark:text-white/35 mb-1">Loại xe (cho chỗ mới)</p>
                                  <select
                                    value={editFloorVehicleTypeId}
                                    onChange={e => { setEditFloorVehicleTypeId(e.target.value); setEditFloorError(''); }}
                                    className="w-full bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg px-2.5 py-2 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-[#FF4C4C]/50 transition-colors appearance-none"
                                  >
                                    <option value="">-- Chọn loại xe --</option>
                                    {vehicleTypes.map(vt => (
                                      <option key={vt.id} value={vt.id}>{vt.name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Change preview */}
                              {editFloorActualCount !== null && editFloorAddedSlots !== '' && Number(editFloorAddedSlots) !== editFloorActualCount && (
                                <div className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
                                  Number(editFloorAddedSlots) > editFloorActualCount
                                    ? 'bg-[#FF4C4C]/5 text-[#FF4C4C]/70'
                                    : 'bg-amber-400/6 text-amber-400/70'
                                }`}>
                                  {Number(editFloorAddedSlots) > editFloorActualCount
                                    ? `+${Number(editFloorAddedSlots) - editFloorActualCount} chỗ sẽ được thêm`
                                    : `-${editFloorActualCount - Number(editFloorAddedSlots)} chỗ trống sẽ bị vô hiệu hoá`}
                                </div>
                              )}

                              {/* Error */}
                              {editFloorError && (
                                <div className="flex items-start gap-2 px-3 py-2 bg-red-400/8 border border-red-400/18 rounded-lg">
                                  <AlertTriangle size={11} className="text-red-400 mt-0.5 shrink-0" />
                                  <p className="text-xs text-red-400 leading-relaxed">{editFloorError}</p>
                                </div>
                              )}

                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveFloorEdit(f)}
                                  disabled={floorLoading || !editFloorName.trim()}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#FF4C4C]/10 border border-[#FF4C4C]/20 text-[#FF4C4C] text-xs font-semibold hover:bg-[#FF4C4C]/20 transition-all disabled:opacity-40"
                                >
                                  {floorLoading ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                                  Lưu thay đổi
                                </button>
                                <button
                                  onClick={() => { setEditingFloorId(null); setFloorError(''); setEditFloorError(''); setEditFloorAddedSlots(''); setEditFloorActualCount(null); }}
                                  disabled={floorLoading}
                                  className="px-4 py-2 rounded-lg text-gray-400 dark:text-white/35 text-xs hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all disabled:opacity-30"
                                >
                                  Huỷ
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* ── Floor row (view) ── */
                            <div className="flex items-center justify-between px-3.5 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                                  <span className="text-[9px] font-bold text-gray-400 dark:text-white/40">{f.floorIndex + 1}F</span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-800 dark:text-white leading-tight">{f.name}</p>
                                  <p className="text-[11px] text-gray-400 dark:text-white/30 mt-0.5">{f.slotCount} chỗ đỗ</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => startEditFloor(f)}
                                  disabled={floorLoading}
                                  className="p-2 rounded-lg text-gray-400 dark:text-white/25 hover:text-[#FF4C4C] hover:bg-[#FF4C4C]/8 transition-all disabled:opacity-30"
                                  title="Chỉnh sửa"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteFloor(f.id)}
                                  disabled={floorLoading}
                                  className="p-2 rounded-lg text-gray-400 dark:text-white/25 hover:text-red-400 hover:bg-red-400/8 transition-all disabled:opacity-30"
                                  title="Xoá tầng"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add new floor */}
                  {remainingCapacity > 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/20 p-3.5 space-y-2.5">
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-white/25 uppercase tracking-widest flex items-center gap-1.5">
                        <Plus size={10} />
                        Thêm tầng mới
                        <span className="normal-case tracking-normal font-normal text-gray-300 dark:text-white/20">· còn {remainingCapacity} chỗ · 20–100/tầng</span>
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Tên tầng"
                          value={newFloorName}
                          onChange={e => { setNewFloorName(e.target.value); setFloorError(''); }}
                          className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-2 text-xs text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                        />
                        <input
                          type="number"
                          placeholder={`20–${Math.min(100, remainingCapacity)} chỗ`}
                          min={20}
                          max={Math.min(100, remainingCapacity)}
                          value={newFloorSlotCount}
                          onChange={e => { setNewFloorSlotCount(e.target.value); setFloorError(''); }}
                          className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-2 text-xs text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                        />
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={newFloorVehicleTypeId}
                          onChange={e => { setNewFloorVehicleTypeId(e.target.value); setFloorError(''); }}
                          className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-2 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-[#FF4C4C]/50 transition-colors appearance-none"
                        >
                          <option value="">-- Chọn loại xe --</option>
                          {vehicleTypes.map(vt => (
                            <option key={vt.id} value={vt.id}>{vt.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleAddFloor}
                          disabled={floorLoading || !newFloorName.trim()}
                          className="px-4 py-2 rounded-lg bg-[#FF4C4C]/10 border border-[#FF4C4C]/20 text-[#FF4C4C] text-xs font-semibold hover:bg-[#FF4C4C]/20 transition-all disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap"
                        >
                          {floorLoading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                          Thêm tầng
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 px-3.5 py-3 bg-red-400/6 border border-red-400/15 rounded-xl">
                      <AlertTriangle size={13} className="text-red-400 shrink-0" />
                      <p className="text-xs text-red-400">Đã phân bổ đủ {selected?.totalSpots} chỗ. Tăng tổng sức chứa để thêm tầng.</p>
                    </div>
                  )}

                  {floorError && (
                    <div className="flex items-center gap-1.5 text-xs text-red-400">
                      <AlertTriangle size={11} /> {floorError}
                    </div>
                  )}
                </div>
              )}

              {formError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-400/8 border border-red-400/15 rounded-xl text-xs text-red-400">
                  <AlertTriangle size={12} className="shrink-0" />
                  {formError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/10 shrink-0">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-white/45 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                onClick={modalType === 'add' ? handleAdd : handleEdit}
                disabled={submitting || (modalType === 'edit' && editingFloorId !== null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r bg-[#FF4C4C] hover:opacity-90 transition-opacity disabled:opacity-55 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {modalType === 'add' ? 'Thêm mới' : editingFloorId !== null ? 'Đang sửa tầng...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── TOAST NOTIFICATION ── */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium max-w-sm
          ${toast.type === 'success'
            ? 'border-[#FF4C4C]/40 text-[#FF4C4C]'
            : 'border-red-400/40 text-red-400'}`}
          style={{ backgroundColor: 'var(--admin-bg-surface)' }}
        >
          {toast.type === 'success' ? <CircleCheck size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
          <span className="flex-1">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-1 opacity-50 hover:opacity-100 transition-opacity">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {modalType === 'delete' && selected && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-sm shadow-2xl bg-white dark:bg-[#0E0E10]">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-400/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-white">Xoá tòa nhà?</h3>
              <p className="text-sm text-gray-500 dark:text-white/50 mt-2 leading-relaxed">
                Bạn sắp xoá <span className="text-gray-800 dark:text-white font-medium">{selected.name}</span> ({selected.address}).
                <br />Hành động này không thể hoàn tác.
              </p>
              {selected.usedSpots > 0 && (
                <div className="flex items-center gap-2 mt-3 px-3 py-2.5 bg-amber-400/10 border border-amber-400/20 rounded-xl text-left">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-400">
                    Tòa nhà này hiện có <strong>{selected.usedSpots} xe đang đỗ</strong>. Hãy chắc chắn trước khi xoá.
                  </p>
                </div>
              )}
              {formError && (
                <p className="text-xs text-red-400 flex items-center justify-center gap-1.5 mt-2">
                  <AlertTriangle size={12} />
                  {formError}
                </p>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeModal} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-white/60 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50">
                Huỷ
              </button>
              <button onClick={handleDelete} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Xác nhận xoá
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}