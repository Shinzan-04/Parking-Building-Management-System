/**
 * Manager/ParkingLots.tsx
 * Trang quản lý bãi đỗ xe cho Manager
 * Tính năng:
 *  - Xem danh sách tòa nhà với thống kê real-time
 *  - Xem chi tiết sơ đồ slot theo tầng (phân màu theo trạng thái)
 *  - Thêm/Sửa/Xoá tòa nhà
 *  - Thêm/Xoá tầng với tự động tạo slot
 *  - Thêm/Xoá slot đơn lẻ
 *  - Cập nhật trạng thái slot (Available / Maintenance / v.v.)
 */

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import {
  Building2, ParkingSquare, CircleCheck, Wrench,
  Plus, Search, Pencil, Trash2, MapPin,
  X, AlertTriangle, Eye, Loader2, Car, Save,
  Layers, Info, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getBuildings, getFloors,
  createBuilding, updateBuilding, deleteBuilding,
  createFloor, updateFloor, deleteFloor, getFloorsByBuilding,
  getVehicleTypes,
} from '../../services/buildingsService';
import type { FloorResponse, VehicleTypeResponse } from '../../services/buildingsService';
import {
  getAllSlots, getSlotsByFloor, createSlot, updateSlotStatus,
  SLOT_STATUS_LABELS, SLOT_STATUS_COLORS,
} from '../../services/parkingService';
import type { ParkingSlotDetail, SlotStatus } from '../../services/parkingService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BuildingVM {
  id: string;
  name: string;
  address: string;
  floorCount: number;
  totalCapacity: number;
  occupiedCount: number;
  reservedCount: number;
  maintenanceCount: number;
}

const emptyBuildingForm = { name: '', address: '', totalCapacity: '' };

const COLS = 8;

// ─── Occupancy bar ────────────────────────────────────────────────────────────

function OccupancyBar({ used, total }: { used: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((used / total) * 100);
  const color = pct >= 90 ? '#F87171' : pct >= 70 ? '#F59E0B' : '#F97316';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-white/40">Tỷ lệ lấp đầy</span>
        <span className="font-semibold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ─── Slot Map Component ───────────────────────────────────────────────────────

function SlotMap({
  floors, buildingId, selectedSlotId, onSelectSlot, onStatusChange,
}: {
  floors: FloorResponse[];
  buildingId: string;
  selectedSlotId: string | null;
  onSelectSlot: (id: string | null) => void;
  onStatusChange: (slot: ParkingSlotDetail) => void;
  token?: string | null;
}) {
  const buildingFloors = floors
    .filter(f => f.buildingId === buildingId)
    .sort((a, b) => a.floorIndex - b.floorIndex);

  const [activeFloorId, setActiveFloorId] = useState<string>(buildingFloors[0]?.id ?? '');
  const [floorSlots, setFloorSlots] = useState<ParkingSlotDetail[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (buildingFloors.length && !buildingFloors.find(f => f.id === activeFloorId)) {
      setActiveFloorId(buildingFloors[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  useEffect(() => {
    if (!activeFloorId) return;
    setLoadingSlots(true);
    getSlotsByFloor(activeFloorId)
      .then(setFloorSlots)
      .catch(() => setFloorSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [activeFloorId]);

  if (buildingFloors.length === 0) {
    return <p className="text-sm text-white/40 text-center py-6">Chưa có tầng nào cho tòa nhà này.</p>;
  }

  const rows: ParkingSlotDetail[][] = [];
  for (let i = 0; i < floorSlots.length; i += COLS) {
    rows.push(floorSlots.slice(i, i + COLS));
  }

  const activeFloor = buildingFloors.find(f => f.id === activeFloorId);
  const availableCount = floorSlots.filter(s => s.status === 'Available').length;
  const occupiedCount  = floorSlots.filter(s => s.status === 'Occupied').length;
  const reservedCount  = floorSlots.filter(s => s.status === 'Reserved').length;
  const maintCount     = floorSlots.filter(s => s.status === 'Maintenance').length;

  const slotColorClass = (status: SlotStatus, isSelected: boolean) => {
    if (isSelected) return 'bg-white border-white text-[#121214] scale-110 z-10 shadow-lg shadow-white/20';
    switch (status) {
      case 'Available':   return 'bg-orange-500/10 border-orange-500/30 text-orange-500/80 hover:bg-orange-500/20 cursor-pointer';
      case 'Occupied':    return 'bg-amber-500/15 border-amber-500/40 text-amber-500/80 cursor-default';
      case 'Reserved':    return 'bg-amber-400/15 border-amber-400/40 text-amber-400/80 cursor-default';
      case 'Maintenance': return 'bg-red-400/15 border-red-400/40 text-red-400/80 cursor-default';
    }
  };

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
                ? 'bg-orange-500 text-[#121214]'
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Stats mini */}
      <div className="flex gap-3 flex-wrap text-xs">
        {[
          { label: 'Trống',    count: availableCount, color: '#F97316' },
          { label: 'Có xe',   count: occupiedCount,   color: '#F59E0B' },
          { label: 'Đặt trước', count: reservedCount, color: '#F59E0B' },
          { label: 'Bảo trì', count: maintCount,      color: '#F87171' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-white/50">{s.label}</span>
            <span className="font-bold text-white">{s.count}</span>
          </div>
        ))}
        <span className="ml-auto text-white/30">{activeFloor?.name} · {floorSlots.length} chỗ</span>
      </div>

      {/* Slot grid */}
      {loadingSlots ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="text-orange-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Column headers */}
          <div className="grid gap-1" style={{ gridTemplateColumns: `1.5rem repeat(${COLS}, minmax(0,1fr))` }}>
            <div />
            {Array.from({ length: COLS }, (_, c) => (
              <div key={c} className="text-center text-[10px] text-white/25 font-semibold">
                {String.fromCharCode(65 + c)}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            {rows.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-4">Tầng này chưa có chỗ đỗ.</p>
            ) : (
              rows.map((row, rowIdx) => (
                <div key={rowIdx} className="grid gap-1 items-center"
                  style={{ gridTemplateColumns: `1.5rem repeat(${COLS}, minmax(0,1fr))` }}>
                  <div className="text-center text-[10px] text-white/25 font-semibold">{rowIdx + 1}</div>
                  {row.map((slot) => {
                    const isSelected = slot.id === selectedSlotId;
                    const colIdx = floorSlots.indexOf(slot) % COLS;
                    const colLetter = String.fromCharCode(65 + colIdx);
                    const rowNum = Math.floor(floorSlots.indexOf(slot) / COLS) + 1;
                    return (
                      <button
                        key={slot.id}
                        title={`${colLetter}${rowNum} · ${slot.slotNumber} · ${SLOT_STATUS_LABELS[slot.status]} · ${slot.vehicleTypeName}`}
                        onClick={() => {
                          onSelectSlot(isSelected ? null : slot.id);
                          if (!isSelected) onStatusChange(slot);
                        }}
                        className={`h-10 rounded-md flex flex-col items-center justify-center gap-0.5 border text-[8px] font-bold transition-all select-none ${slotColorClass(slot.status, isSelected)}`}
                      >
                        {slot.status === 'Occupied' && <Car size={8} />}
                        {slot.status === 'Maintenance' && <Wrench size={8} />}
                        <span>{slot.slotNumber}</span>
                      </button>
                    );
                  })}
                  {row.length < COLS && Array.from({ length: COLS - row.length }, (_, k) => (
                    <div key={`pad-${k}`} className="h-10" />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center flex-wrap gap-4 pt-2 border-t border-white/5 text-xs text-white/40">
            {(Object.entries(SLOT_STATUS_COLORS) as [SlotStatus, typeof SLOT_STATUS_COLORS[SlotStatus]][]).map(([status, cfg]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded ${cfg.bg} border border-white/10`} />
                {SLOT_STATUS_LABELS[status]}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Status Change Panel ──────────────────────────────────────────────────────

function SlotStatusPanel({
  slot, onClose, onUpdated, token,
}: {
  slot: ParkingSlotDetail;
  onClose: () => void;
  onUpdated: (updated: ParkingSlotDetail) => void;
  token: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleChangeStatus = async (newStatus: SlotStatus) => {
    if (newStatus === slot.status) { onClose(); return; }
    setLoading(true); setError('');
    try {
      const updated = await updateSlotStatus(slot.id, newStatus, token);
      onUpdated(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi cập nhật trạng thái.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#121214] border border-white/10 rounded-xl p-4 space-y-3 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Slot {slot.slotNumber}</p>
          <p className="text-xs text-white/40">{slot.floorName} · {slot.vehicleTypeName}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all">
          <X size={14} />
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-white/50 mb-2">Chuyển trạng thái sang:</p>
        {(['Available', 'Maintenance'] as SlotStatus[]).map(s => {
          const cfg = SLOT_STATUS_COLORS[s];
          const isCurrent = slot.status === s;
          return (
            <button
              key={s}
              disabled={loading || isCurrent}
              onClick={() => handleChangeStatus(s)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isCurrent
                  ? `${cfg.bg} ${cfg.text} cursor-default`
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {SLOT_STATUS_LABELS[s]}
              {isCurrent && <span className="ml-auto text-xs opacity-60">(hiện tại)</span>}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1.5">
          <AlertTriangle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ManagerParkingLots() {
  const { token } = useAuth();

  // Buildings
  const [buildings, setBuildings]   = useState<BuildingVM[]>([]);
  const [allFloors, setAllFloors]   = useState<FloorResponse[]>([]);
  const [allSlots, setAllSlots]     = useState<ParkingSlotDetail[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeResponse[]>([]);
  const [loading, setLoading]       = useState(true);
  const [apiError, setApiError]     = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // UI state
  const [search, setSearch]         = useState('');
  const [modalType, setModalType]   = useState<'add' | 'detail' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected]     = useState<BuildingVM | null>(null);
  const [form, setForm]             = useState(emptyBuildingForm);
  const [formError, setFormError]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detail / slot view
  const [selectedSlotId, setSelectedSlotId]   = useState<string | null>(null);
  const [activeSlot, setActiveSlot]           = useState<ParkingSlotDetail | null>(null);

  // Floor management (in edit modal)
  const [editFloors, setEditFloors]             = useState<FloorResponse[]>([]);
  const [floorLoading, setFloorLoading]         = useState(false);
  const [newFloorName, setNewFloorName]         = useState('');
  const [newFloorSlotCount, setNewFloorSlotCount] = useState('');
  const [newFloorVehicleTypeId, setNewFloorVehicleTypeId] = useState('');
  const [floorError, setFloorError]             = useState('');

  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [editFloorName, setEditFloorName]   = useState('');
  const [editFloorAddedSlots, setEditFloorAddedSlots] = useState('');
  const [editFloorVehicleTypeId, setEditFloorVehicleTypeId] = useState('');

  // ─── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setApiError('');
    try {
      const [rawBuildings, floors, slots, vts] = await Promise.all([
        getBuildings(), getFloors(), getAllSlots(), getVehicleTypes(),
      ]);

      setAllFloors(floors);
      setAllSlots(slots);
      setVehicleTypes(vts);

      // Build floorId → buildingId map
      const floorBuildingMap: Record<string, string> = {};
      floors.forEach(f => { floorBuildingMap[f.id] = f.buildingId; });

      // Count slots per building per status
      const counts: Record<string, { occupied: number; reserved: number; maintenance: number }> = {};
      rawBuildings.forEach(b => { counts[b.id] = { occupied: 0, reserved: 0, maintenance: 0 }; });
      slots.forEach(s => {
        const bid = floorBuildingMap[s.floorId];
        if (!bid || !counts[bid]) return;
        if (s.status === 'Occupied')    counts[bid].occupied++;
        if (s.status === 'Reserved')    counts[bid].reserved++;
        if (s.status === 'Maintenance') counts[bid].maintenance++;
      });

      setBuildings(rawBuildings.map(b => ({
        id:               b.id,
        name:             b.name,
        address:          b.address,
        floorCount:       b.floorCount,
        totalCapacity:    b.totalCapacity,
        occupiedCount:    counts[b.id]?.occupied    ?? 0,
        reservedCount:    counts[b.id]?.reserved    ?? 0,
        maintenanceCount: counts[b.id]?.maintenance ?? 0,
      })));
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Modal helpers ───────────────────────────────────────────────────────────

  const closeModal = () => {
    setModalType(null); setSelected(null); setFormError(''); setSubmitting(false);
    setSelectedSlotId(null); setActiveSlot(null);
    setEditFloors([]); setNewFloorName(''); setNewFloorSlotCount('');
    setNewFloorVehicleTypeId(''); setFloorError('');
    setEditingFloorId(null);
  };

  const openAdd = () => { setForm(emptyBuildingForm); setFormError(''); setModalType('add'); };

  const openDetail = (b: BuildingVM) => {
    setSelected(b); setSelectedSlotId(null); setActiveSlot(null); setModalType('detail');
  };

  const openEdit = (b: BuildingVM) => {
    setSelected(b);
    setForm({ name: b.name, address: b.address, totalCapacity: String(b.totalCapacity) });
    setFormError(''); setNewFloorName(''); setFloorError('');
    setEditingFloorId(null);
    setFloorLoading(true); setModalType('edit');
    getFloorsByBuilding(b.id)
      .then(f => setEditFloors(f.sort((a, b) => a.floorIndex - b.floorIndex)))
      .catch(() => setFloorError('Không thể tải danh sách tầng.'))
      .finally(() => setFloorLoading(false));
  };

  const openDelete = (b: BuildingVM) => { setSelected(b); setModalType('delete'); };

  // ─── Floor handlers ──────────────────────────────────────────────────────────

  const handleAddFloor = async () => {
    if (!selected || !token) return;
    const name = newFloorName.trim();
    if (!name) { setFloorError('Vui lòng nhập tên tầng.'); return; }
    const slotCount = Number(newFloorSlotCount);
    if (newFloorSlotCount && (isNaN(slotCount) || slotCount < 0 || slotCount > 100)) {
      setFloorError('Số chỗ phải từ 0 đến 100.'); return;
    }
    if (slotCount > 0 && !newFloorVehicleTypeId) {
      setFloorError('Vui lòng chọn loại xe khi thêm chỗ đỗ.'); return;
    }
    setFloorLoading(true); setFloorError('');
    try {
      const nextIndex = editFloors.length > 0
        ? Math.max(...editFloors.map(f => f.floorIndex)) + 1 : 0;
      const created = await createFloor({ buildingId: selected.id, name, floorIndex: nextIndex }, token);

      if (slotCount > 0) {
        await Promise.all(
          Array.from({ length: slotCount }, (_, i) =>
            createSlot({
              floorId: created.id,
              vehicleTypeId: newFloorVehicleTypeId,
              slotNumber: String(i + 1).padStart(3, '0'),
            }, token)
          )
        );
        created.slotCount = slotCount;
      }

      setEditFloors(prev => [...prev, created].sort((a, b) => a.floorIndex - b.floorIndex));
      setAllFloors(prev => [...prev, created]);
      setBuildings(prev => prev.map(b => b.id === selected.id ? { ...b, floorCount: b.floorCount + 1 } : b));
      setNewFloorName(''); setNewFloorSlotCount(''); setNewFloorVehicleTypeId('');
    } catch (e) {
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
  };

  const saveFloorEdit = async (f: FloorResponse) => {
    if (!token || !selected) return;
    setFloorLoading(true); setFloorError('');
    try {
      if (editFloorName.trim() && editFloorName.trim() !== f.name) {
        await updateFloor(f.id, { name: editFloorName.trim(), floorIndex: f.floorIndex }, token);
      }
      
      const addedSlots = Number(editFloorAddedSlots);
      if (editFloorAddedSlots && (isNaN(addedSlots) || addedSlots < 0)) {
        setFloorError('Số chỗ thêm phải là số nguyên không âm.');
        setFloorLoading(false);
        return;
      }
      
      if (addedSlots > 0) {
        if (f.slotCount + addedSlots > 100) {
          setFloorError(`Tổng số chỗ không được vượt quá 100 (hiện tại: ${f.slotCount}).`);
          setFloorLoading(false);
          return;
        }
        if (!editFloorVehicleTypeId) {
          setFloorError('Vui lòng chọn loại xe cho các chỗ mới.');
          setFloorLoading(false);
          return;
        }
        await Promise.all(
          Array.from({ length: addedSlots }, (_, i) =>
            createSlot({
              floorId: f.id,
              vehicleTypeId: editFloorVehicleTypeId,
              slotNumber: String(f.slotCount + i + 1).padStart(3, '0'),
            }, token)
          )
        );
      }

      const updatedFloor = { 
        ...f, 
        name: editFloorName.trim() || f.name, 
        slotCount: f.slotCount + (isNaN(addedSlots) ? 0 : addedSlots) 
      };
      
      setEditFloors(prev => prev.map(floor => floor.id === f.id ? updatedFloor : floor));
      setAllFloors(prev => prev.map(floor => floor.id === f.id ? updatedFloor : floor));
      setEditingFloorId(null);
    } catch (e) {
      setFloorError(e instanceof Error ? e.message : 'Đã xảy ra lỗi khi sửa tầng.');
    } finally {
      setFloorLoading(false);
    }
  };

  const handleDeleteFloor = async (floorId: string) => {
    if (!token) return;
    setFloorLoading(true); setFloorError('');
    try {
      await deleteFloor(floorId, token);
      setEditFloors(prev => prev.filter(f => f.id !== floorId));
      setAllFloors(prev => prev.filter(f => f.id !== floorId));
      if (selected) setBuildings(prev => prev.map(b => b.id === selected.id ? { ...b, floorCount: b.floorCount - 1 } : b));
    } catch (e) {
      setFloorError(e instanceof Error ? e.message : 'Không thể xoá tầng.');
    } finally {
      setFloorLoading(false);
    }
  };

  // ─── Building CRUD ───────────────────────────────────────────────────────────

  const validateForm = () => {
    if (!form.name.trim())       return 'Vui lòng nhập tên tòa nhà.';
    if (!form.address.trim())    return 'Vui lòng nhập địa chỉ.';
    if (!form.totalCapacity || isNaN(Number(form.totalCapacity)) || Number(form.totalCapacity) <= 0)
      return 'Sức chứa phải là số nguyên dương.';
    return '';
  };

  const handleAdd = async () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    if (!token) return;
    setSubmitting(true);
    try {
      const created = await createBuilding({
        name: form.name.trim(),
        address: form.address.trim(),
        totalCapacity: Number(form.totalCapacity),
      }, token);
      setBuildings(prev => [...prev, {
        id: created.id, name: created.name, address: created.address,
        floorCount: created.floorCount, totalCapacity: created.totalCapacity,
        occupiedCount: 0, reservedCount: 0, maintenanceCount: 0,
      }]);
      closeModal();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    if (!selected || !token) return;
    setSubmitting(true);
    try {
      const updated = await updateBuilding(selected.id, {
        name: form.name.trim(),
        address: form.address.trim(),
        totalCapacity: Number(form.totalCapacity),
      }, token);
      setBuildings(prev => prev.map(b => b.id !== selected.id ? b : {
        ...b, name: updated.name, address: updated.address,
        totalCapacity: updated.totalCapacity, floorCount: updated.floorCount,
      }));
      closeModal();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected || !token) return;
    setSubmitting(true);
    try {
      await deleteBuilding(selected.id, token);
      setBuildings(prev => prev.filter(b => b.id !== selected.id));
      closeModal();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Không thể xoá tòa nhà.');
      setSubmitting(false);
    }
  };

  // ─── Slot status updated callback ────────────────────────────────────────────

  const handleSlotStatusUpdated = (updated: ParkingSlotDetail) => {
    setAllSlots(prev => prev.map(s => s.id === updated.id ? updated : s));
    // Reload building counts silently
    loadData(true);
  };

  // ─── Computed ────────────────────────────────────────────────────────────────

  const filtered = buildings.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.address.toLowerCase().includes(search.toLowerCase())
  );

  const totalCapacity   = buildings.reduce((s, b) => s + b.totalCapacity, 0);
  const totalOccupied   = buildings.reduce((s, b) => s + b.occupiedCount, 0);
  const totalAvailable  = totalCapacity - buildings.reduce((s, b) => s + b.occupiedCount + b.reservedCount + b.maintenanceCount, 0);
  const totalMaintenance = buildings.reduce((s, b) => s + b.maintenanceCount, 0);

  const summaryStats = [
    { label: 'Tổng sức chứa',    value: totalCapacity,    unit: 'chỗ', icon: ParkingSquare, color: '#A78BFA', bg: 'from-violet-400/20 to-violet-400/5' },
    { label: 'Đang sử dụng',     value: totalOccupied,    unit: 'chỗ', icon: Car,           color: '#F59E0B', bg: 'from-amber-500/20 to-amber-500/5' },
    { label: 'Còn trống',        value: totalAvailable,   unit: 'chỗ', icon: CircleCheck,   color: '#F97316', bg: 'from-orange-500/20 to-orange-500/5' },
    { label: 'Đang bảo trì',     value: totalMaintenance, unit: 'chỗ', icon: Wrench,        color: '#F87171', bg: 'from-red-400/20 to-red-400/5' },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="text-orange-500 animate-spin" />
        <p className="text-sm text-white/40">Đang tải dữ liệu bãi đỗ xe...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Quản lý bãi đỗ xe</h2>
          <p className="text-sm text-white/40 mt-0.5">
            {buildings.length} tòa nhà · {allFloors.length} tầng · {allSlots.length} chỗ đỗ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-black font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            Thêm tòa nhà
          </button>
        </div>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{apiError}</p>
        </div>
      )}

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryStats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="glass-card p-5 rounded-2xl">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.bg} flex items-center justify-center mb-3`}>
                <Icon size={19} style={{ color: s.color }} />
              </div>
              <p className="text-2xl font-bold text-white">
                {s.value.toLocaleString('vi-VN')}
                <span className="text-sm font-normal text-white/40 ml-1">{s.unit}</span>
              </p>
              <p className="text-sm text-white/50 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="Tìm kiếm tòa nhà..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 transition-colors"
        />
      </div>

      {/* ── Building cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <p className="col-span-3 text-center py-12 text-white/30 text-sm">Không tìm thấy tòa nhà nào.</p>
        )}
        {filtered.map(b => {
          const available = b.totalCapacity - b.occupiedCount - b.reservedCount - b.maintenanceCount;
          const usedForBar = b.occupiedCount + b.reservedCount;
          return (
            <div key={b.id} className="glass-card p-5 rounded-2xl flex flex-col gap-4 hover:border-white/20 transition-all">
              {/* Title */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center">
                    <Building2 size={18} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{b.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={11} className="text-white/30" />
                      <span className="text-xs text-white/40 truncate max-w-[160px]">{b.address}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs bg-white/5 px-2.5 py-1 rounded-full text-white/50">
                  <Layers size={11} />
                  {b.floorCount} tầng
                </div>
              </div>

              <OccupancyBar used={usedForBar} total={b.totalCapacity} />

              {/* Slot counts */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Tổng',     value: b.totalCapacity,    color: 'text-white' },
                  { label: 'Trống',    value: available,           color: 'text-orange-500' },
                  { label: 'Có xe',    value: b.occupiedCount,     color: 'text-amber-500' },
                  { label: 'Bảo trì', value: b.maintenanceCount,  color: 'text-red-400' },
                ].map(item => (
                  <div key={item.label} className="bg-white/5 rounded-xl px-2 py-2 text-center">
                    <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                <button
                  onClick={() => openDetail(b)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
                >
                  <Eye size={13} /> Sơ đồ
                </button>
                <button
                  onClick={() => openEdit(b)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-orange-500/70 hover:text-orange-500 hover:bg-orange-500/10 transition-all"
                >
                  <Pencil size={13} /> Sửa
                </button>
                <button
                  onClick={() => openDelete(b)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all"
                >
                  <Trash2 size={13} /> Xoá
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════
          DETAIL MODAL — Sơ đồ slot + đổi trạng thái
      ══════════════════════════════════════════════ */}
      {modalType === 'detail' && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Building2 size={17} className="text-orange-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{selected.name}</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={11} className="text-white/30" />
                    <span className="text-xs text-white/40">{selected.address}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { closeModal(); openEdit(selected); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 transition-all"
                >
                  <Pencil size={12} /> Chỉnh sửa
                </button>
                <button onClick={closeModal} className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Sức chứa',   value: selected.totalCapacity,    color: 'text-white' },
                  { label: 'Còn trống',  value: selected.totalCapacity - selected.occupiedCount - selected.reservedCount - selected.maintenanceCount, color: 'text-orange-500' },
                  { label: 'Đang dùng',  value: selected.occupiedCount,     color: 'text-amber-500' },
                  { label: 'Bảo trì',   value: selected.maintenanceCount,  color: 'text-red-400' },
                ].map(item => (
                  <div key={item.label} className="bg-white/5 rounded-xl p-3 text-center">
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-white/40 mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>

              <OccupancyBar used={selected.occupiedCount + selected.reservedCount} total={selected.totalCapacity} />

              {/* Tip */}
              <div className="flex items-start gap-2.5 px-4 py-3 bg-orange-500/5 border border-orange-500/15 rounded-xl">
                <Info size={14} className="text-orange-500 shrink-0 mt-0.5" />
                <p className="text-xs text-white/60">
                  Click vào ô slot <span className="text-orange-500">còn trống</span> để xem tùy chọn đổi trạng thái (chuyển sang Bảo trì hoặc ngược lại).
                </p>
              </div>

              {/* Slot map */}
              <div>
                <p className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <ParkingSquare size={15} className="text-orange-500" />
                  Sơ đồ chỗ đỗ xe
                </p>
                <div className="bg-white/[0.03] rounded-xl p-4 space-y-4">
                  <SlotMap
                    floors={allFloors}
                    buildingId={selected.id}
                    selectedSlotId={selectedSlotId}
                    onSelectSlot={setSelectedSlotId}
                    onStatusChange={setActiveSlot}
                    token={token}
                  />

                  {/* Slot action panel */}
                  {activeSlot && token && (
                    <SlotStatusPanel
                      slot={activeSlot}
                      onClose={() => { setActiveSlot(null); setSelectedSlotId(null); }}
                      onUpdated={handleSlotStatusUpdated}
                      token={token}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          ADD / EDIT MODAL
      ══════════════════════════════════════════════ */}
      {(modalType === 'add' || modalType === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-base font-semibold text-white">
                {modalType === 'add' ? 'Thêm tòa nhà mới' : `Chỉnh sửa · ${selected?.name}`}
              </h3>
              <button onClick={closeModal} className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {/* Basic fields */}
              {[
                { key: 'name' as const,          label: 'Tên tòa nhà',         placeholder: 'Ví dụ: Tòa A',            type: 'text'   },
                { key: 'address' as const,       label: 'Địa chỉ',             placeholder: 'Ví dụ: 123 Lê Lợi, Q.1',  type: 'text'   },
                { key: 'totalCapacity' as const, label: 'Sức chứa tối đa (chỗ)', placeholder: 'Ví dụ: 200',             type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>
              ))}

              {/* Floor management — only in edit mode */}
              {modalType === 'edit' && (
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">
                    Quản lý tầng ({editFloors.length} tầng)
                  </label>

                  {/* Existing floors list */}
                  <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto">
                    {floorLoading && editFloors.length === 0 ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-white/30">
                        <Loader2 size={12} className="animate-spin" /> Đang tải...
                      </div>
                    ) : editFloors.length === 0 ? (
                      <p className="text-xs text-white/30 py-2">Chưa có tầng nào.</p>
                    ) : (
                      editFloors.map(f => (
                        <div key={f.id} className="flex flex-col gap-2 px-3 py-2 bg-white/5 rounded-lg">
                          {editingFloorId === f.id ? (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editFloorName}
                                  onChange={e => { setEditFloorName(e.target.value); setFloorError(''); }}
                                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                                  placeholder="Tên tầng"
                                />
                                <input
                                  type="number"
                                  placeholder="+ thêm chỗ"
                                  min={0}
                                  max={100 - f.slotCount}
                                  value={editFloorAddedSlots}
                                  onChange={e => { setEditFloorAddedSlots(e.target.value); setFloorError(''); }}
                                  className="w-24 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                                />
                              </div>
                              <div className="flex gap-2">
                                <select
                                  value={editFloorVehicleTypeId}
                                  onChange={e => { setEditFloorVehicleTypeId(e.target.value); setFloorError(''); }}
                                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50 appearance-none"
                                >
                                  <option value="" className="bg-[#121214]">-- Loại xe (nếu thêm chỗ) --</option>
                                  {vehicleTypes.map(vt => (
                                    <option key={vt.id} value={vt.id} className="bg-[#121214]">{vt.name}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => saveFloorEdit(f)}
                                  disabled={floorLoading}
                                  className="p-1.5 rounded-lg text-orange-500 hover:bg-orange-500/10 transition-all disabled:opacity-30"
                                >
                                  <Save size={14} />
                                </button>
                                <button
                                  onClick={() => { setEditingFloorId(null); setFloorError(''); }}
                                  disabled={floorLoading}
                                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-white">{f.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-white/30">{f.slotCount} / 100 chỗ</span>
                                <button
                                  onClick={() => startEditFloor(f)}
                                  disabled={floorLoading}
                                  className="p-1 rounded-lg text-amber-500/50 hover:text-amber-500 hover:bg-amber-500/10 transition-all disabled:opacity-30"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeleteFloor(f.id)}
                                  disabled={floorLoading}
                                  className="p-1 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-30"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add new floor row */}
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <p className="text-xs text-white/40">Thêm tầng mới:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Tên tầng (vd: Tầng B1)"
                        value={newFloorName}
                        onChange={e => { setNewFloorName(e.target.value); setFloorError(''); }}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                      />
                      <input
                        type="number"
                        placeholder="Số chỗ (tối đa 100)"
                        min={0}
                        max={100}
                        value={newFloorSlotCount}
                        onChange={e => { setNewFloorSlotCount(e.target.value); setFloorError(''); }}
                        className="w-32 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                      />
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={newFloorVehicleTypeId}
                        onChange={e => { setNewFloorVehicleTypeId(e.target.value); setFloorError(''); }}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors appearance-none"
                      >
                        <option value="" className="bg-[#121214]">-- Loại xe (nếu có chỗ) --</option>
                        {vehicleTypes.map(vt => (
                          <option key={vt.id} value={vt.id} className="bg-[#121214]">{vt.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleAddFloor}
                        disabled={floorLoading || !newFloorName.trim()}
                        className="px-3 py-2 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-500 hover:bg-orange-500/30 transition-all disabled:opacity-40 flex items-center gap-1.5 text-sm font-medium whitespace-nowrap"
                      >
                        {floorLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        Thêm tầng
                      </button>
                    </div>
                    {floorError && (
                      <p className="text-xs text-red-400 flex items-center gap-1.5">
                        <AlertTriangle size={11} /> {floorError}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {formError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-400/10 border border-red-400/20 rounded-xl">
                  <AlertTriangle size={13} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{formError}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={modalType === 'add' ? handleAdd : handleEdit}
                disabled={submitting || editingFloorId !== null}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {editingFloorId !== null ? 'Đang sửa tầng...' : (modalType === 'add' ? 'Tạo tòa nhà' : 'Lưu thay đổi')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          DELETE CONFIRM MODAL
      ══════════════════════════════════════════════ */}
      {modalType === 'delete' && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#121214] border border-red-400/20 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Xoá tòa nhà</h3>
                <p className="text-xs text-white/40 mt-0.5">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <p className="text-sm text-white/70">
              Bạn sắp xoá tòa nhà <span className="font-semibold text-white">"{selected.name}"</span>.
              Tất cả tầng và chỗ đỗ xe liên quan sẽ bị xoá vĩnh viễn.
            </p>

            {formError && <p className="text-xs text-red-400">{formError}</p>}

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Xác nhận xoá
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
