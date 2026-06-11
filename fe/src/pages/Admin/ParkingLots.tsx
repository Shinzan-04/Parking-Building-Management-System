import { useState, useEffect } from 'react';
import {
  Building2, ParkingSquare, CircleCheck, Wrench,
  Plus, Search, Pencil, Trash2, MapPin,
  X, AlertTriangle, Eye, Loader2, Car, Save,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getBuildings, getFloors, getParkingSlots, isSlotOccupied,
  createBuilding, updateBuilding, deleteBuilding,
  createFloor, deleteFloor, getFloorsByBuilding,
  getVehicleTypes, createParkingSlot, updateFloor,
} from '../../services/buildingsService';
import type { FloorResponse, ParkingSlotSummary, VehicleTypeResponse } from '../../services/buildingsService';

interface ParkingLot {
  id: string;
  name: string;
  address: string;
  floorCount: number;
  totalSpots: number;
  usedSpots: number;
  status: 'active' | 'maintenance' | 'full';
}

const statusConfig = {
  active:      { label: 'Hoạt động', bg: 'bg-[#3BFFA4]/10', text: 'text-[#3BFFA4]', dot: 'bg-[#3BFFA4]' },
  full:        { label: 'Đầy chỗ',   bg: 'bg-amber-400/10',  text: 'text-amber-400',  dot: 'bg-amber-400' },
  maintenance: { label: 'Bảo trì',   bg: 'bg-red-400/10',    text: 'text-red-400',    dot: 'bg-red-400' },
};

const emptyForm = { name: '', address: '', totalSpots: '', status: 'active' as ParkingLot['status'] };

const COLS = 8;

function OccupancyBar({ used, total }: { used: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((used / total) * 100);
  const color = pct >= 90 ? '#F87171' : pct >= 70 ? '#F59E0B' : '#3BFFA4';
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
  floors, slots, buildingId, selectedSlotId, onSelectSlot,
}: {
  floors: FloorResponse[];
  slots: ParkingSlotSummary[];
  buildingId: string;
  selectedSlotId: string | null;
  onSelectSlot: (id: string | null) => void;
}) {
  const buildingFloors = floors
    .filter(f => f.buildingId === buildingId)
    .sort((a, b) => a.floorIndex - b.floorIndex);

  const [activeFloorId, setActiveFloorId] = useState<string>(buildingFloors[0]?.id ?? '');

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
    .filter(s => s.floorId === activeFloorId)
    .map((s, i) => ({ ...s, index: i }));

  const rows: (typeof floorSlots[0])[][] = [];
  for (let i = 0; i < floorSlots.length; i += COLS) {
    rows.push(floorSlots.slice(i, i + COLS));
  }

  const activeFloor = buildingFloors.find(f => f.id === activeFloorId);
  const occupiedCount = floorSlots.filter(s => isSlotOccupied(s.status)).length;
  const freeCount = floorSlots.length - occupiedCount;

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
                ? 'bg-[#00C2FF] text-[#0F1B2D]'
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
                    disabled={occupied}
                    title={occupied ? `${colLetter}${rowNum}: Đã có xe` : `${colLetter}${rowNum}: Chọn chỗ này`}
                    onClick={() => onSelectSlot(isSelected ? null : slot.id)}
                    className={`
                      h-9 rounded-md flex flex-col items-center justify-center gap-0.5
                      border text-[8px] font-bold transition-all select-none
                      ${occupied
                        ? 'bg-[#00C2FF]/15 border-[#00C2FF]/40 text-[#00C2FF]/80 cursor-not-allowed'
                        : isSelected
                          ? 'bg-[#3BFFA4] border-[#3BFFA4] text-[#0F1B2D] shadow-md shadow-[#3BFFA4]/30 scale-105 z-10'
                          : 'bg-white/5 border-white/10 text-white/30 hover:bg-[#3BFFA4]/10 hover:border-[#3BFFA4]/50 hover:text-[#3BFFA4] cursor-pointer'
                      }
                    `}
                  >
                    {(occupied || isSelected) && <Car size={9} />}
                    <span>{colLetter}{rowNum}</span>
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
          <div className="w-4 h-4 rounded bg-[#00C2FF]/15 border border-[#00C2FF]/40" />
          Đã dùng ({occupiedCount})
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-white/5 border border-white/10" />
          Còn trống ({freeCount})
        </div>
        {selectedSlotId && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-[#3BFFA4] border border-[#3BFFA4]" />
            Đang chọn
          </div>
        )}
        <span className="ml-auto">{activeFloor?.name} · {floorSlots.length} chỗ</span>
      </div>

      {/* Selected slot banner */}
      {selectedSlotId && (
        <div className="flex items-center justify-between px-4 py-3 bg-[#3BFFA4]/10 border border-[#3BFFA4]/30 rounded-xl">
          <div className="flex items-center gap-2 text-sm text-[#3BFFA4]">
            <Car size={14} />
            <span>Đã chọn chỗ — sẵn sàng phân cho khách hàng</span>
          </div>
          <button
            onClick={() => onSelectSlot(null)}
            className="text-[#3BFFA4]/60 hover:text-[#3BFFA4] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
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

  async function loadData() {
    try {
      const [buildings, floors, slots] = await Promise.all([
        getBuildings(), getFloors(), getParkingSlots(),
      ]);

      setAllFloors(floors);
      setAllSlots(slots);

      const fbMap: Record<string, string> = {};
      floors.forEach(f => { fbMap[f.id] = f.buildingId; });

      const occupiedCountPerBuilding: Record<string, number> = {};
      buildings.forEach(b => { occupiedCountPerBuilding[b.id] = 0; });
      slots
        .filter(s => isSlotOccupied(s.status))
        .forEach(s => {
          const bid = fbMap[s.floorId];
          if (bid) occupiedCountPerBuilding[bid] = (occupiedCountPerBuilding[bid] ?? 0) + 1;
        });

      setLots(buildings.map(b => {
        const used = occupiedCountPerBuilding[b.id] ?? 0;
        const pct = b.totalCapacity > 0 ? used / b.totalCapacity : 0;
        return {
          id: b.id,
          name: b.name,
          address: b.address,
          floorCount: b.floorCount,
          totalSpots: b.totalCapacity,
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
      .then(f => setEditFloors(f.sort((a, b) => a.floorIndex - b.floorIndex)))
      .catch(() => setFloorError('Không thể tải danh sách tầng.'))
      .finally(() => setFloorLoading(false));
  };
  const openDelete = (lot: ParkingLot) => { setSelected(lot); setModalType('delete'); };
  const closeModal = () => {
    setModalType(null); setSelected(null); setFormError(''); setSubmitting(false);
    setSelectedSlotId(null); setEditFloors([]); setNewFloorName('');
    setNewFloorSlotCount(''); setNewFloorVehicleTypeId(''); setFloorError('');
    setEditingFloorId(null);
  };

  const handleAddFloor = async () => {
    if (!selected || !token) return;
    const name = newFloorName.trim();
    if (!name) { setFloorError('Vui lòng nhập tên tầng.'); return; }
    const slotCount = Number(newFloorSlotCount);
    if (newFloorSlotCount && (isNaN(slotCount) || slotCount < 0 || slotCount > 100)) {
      setFloorError('Số chỗ phải từ 0 đến 100.'); return;
    }
    if (slotCount > 0 && !newFloorVehicleTypeId) {
      setFloorError('Vui lòng chọn loại xe cho các chỗ đỗ.'); return;
    }
    setFloorLoading(true); setFloorError('');
    try {
      const nextIndex = editFloors.length > 0 ? Math.max(...editFloors.map(f => f.floorIndex)) + 1 : 0;
      const created = await createFloor({ buildingId: selected.id, name, floorIndex: nextIndex }, token);

      if (slotCount > 0) {
        await Promise.all(
          Array.from({ length: slotCount }, (_, i) =>
            createParkingSlot({
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
      setLots(prev => prev.map(l => l.id === selected.id ? { ...l, floorCount: l.floorCount + 1 } : l));
      setNewFloorName('');
      setNewFloorSlotCount('');
      setNewFloorVehicleTypeId('');
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
            createParkingSlot({
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
    } catch (e: unknown) {
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
      if (selected) setLots(prev => prev.map(l => l.id === selected.id ? { ...l, floorCount: l.floorCount - 1 } : l));
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
    if (!token) return;
    setSubmitting(true);
    try {
      const created = await createBuilding({
        name: form.name.trim(),
        address: form.address.trim(),
        totalCapacity: Number(form.totalSpots),
      }, token);
      setLots(prev => [...prev, {
        id: created.id,
        name: created.name,
        address: created.address,
        floorCount: created.floorCount,
        totalSpots: created.totalCapacity,
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
    if (!selected || !token) return;
    setSubmitting(true);
    try {
      const updated = await updateBuilding(selected.id, {
        name: form.name.trim(),
        address: form.address.trim(),
        totalCapacity: Number(form.totalSpots),
      }, token);
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
    if (!selected || !token) return;
    setSubmitting(true);
    try {
      await deleteBuilding(selected.id, token);
      setLots(prev => prev.filter(l => l.id !== selected.id));
      closeModal();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
      setSubmitting(false);
    }
  };

  const totalSpots    = lots.reduce((s, l) => s + l.totalSpots, 0);
  const usedSpots     = lots.reduce((s, l) => s + l.usedSpots, 0);
  const activeLots    = lots.filter(l => l.status === 'active').length;
  const inMaintenance = lots.filter(l => l.status === 'maintenance').length;

  const filtered = lots.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.address.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: 'Tổng số tòa',    value: lots.length,           unit: 'tòa', icon: Building2,     color: '#00C2FF', bg: 'from-[#00C2FF]/20 to-[#00C2FF]/5' },
    { label: 'Tổng sức chứa',  value: totalSpots,             unit: 'chỗ', icon: ParkingSquare, color: '#A78BFA', bg: 'from-violet-400/20 to-violet-400/5' },
    { label: 'Đang còn trống', value: totalSpots - usedSpots, unit: 'chỗ', icon: CircleCheck,   color: '#3BFFA4', bg: 'from-[#3BFFA4]/20 to-[#3BFFA4]/5' },
    { label: 'Đang bảo trì',   value: inMaintenance,          unit: 'tòa', icon: Wrench,        color: '#F87171', bg: 'from-red-400/20 to-red-400/5' },
  ];

  const formFields = [
    { key: 'name',       label: 'Tên tòa nhà',         placeholder: 'Ví dụ: Tòa A',             type: 'text'   },
    { key: 'address',    label: 'Địa chỉ',              placeholder: 'Ví dụ: 123 Đường Lê Lợi',  type: 'text'   },
    { key: 'totalSpots', label: 'Tổng sức chứa (chỗ)', placeholder: 'Ví dụ: 200',               type: 'number' },
  ] as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="text-[#00C2FF] animate-spin" />
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
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00C2FF] to-[#3BFFA4] text-[#101A31] font-semibold text-sm hover:opacity-90 transition-opacity"
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
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00C2FF]/50 transition-colors"
        />
      </div>

      {/* Lot cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <p className="col-span-3 text-center py-12 text-white/30 text-sm">Không tìm thấy tòa nhà nào.</p>
        )}
        {filtered.map((lot) => {
          const cfg = statusConfig[lot.status];
          const available = lot.totalSpots - lot.usedSpots;
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

              <OccupancyBar used={lot.usedSpots} total={lot.totalSpots} />

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Sức chứa', value: lot.totalSpots, color: 'text-white' },
                  { label: 'Đã dùng',  value: lot.usedSpots,  color: 'text-[#00C2FF]' },
                  { label: 'Trống',    value: available,      color: 'text-[#3BFFA4]' },
                ].map(item => (
                  <div key={item.label} className="bg-white/5 rounded-xl px-3 py-2 text-center">
                    <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-white/40 mt-0.5">{item.label}</p>
                  </div>
                ))}
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
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-[#00C2FF]/70 hover:text-[#00C2FF] hover:bg-[#00C2FF]/10 transition-all"
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
      {modalType === 'detail' && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0F1B2D] border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-white/70">{selected.floorCount}F</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{selected.name}</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={11} className="text-white/30" />
                    <span className="text-xs text-white/40">{selected.address}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[selected.status].bg} ${statusConfig[selected.status].text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[selected.status].dot}`} />
                  {statusConfig[selected.status].label}
                </span>
                <button onClick={closeModal} className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Sức chứa',  value: selected.totalSpots,                     color: 'text-white' },
                  { label: 'Đã dùng',   value: selected.usedSpots,                       color: 'text-[#00C2FF]' },
                  { label: 'Còn trống', value: selected.totalSpots - selected.usedSpots, color: 'text-[#3BFFA4]' },
                ].map(item => (
                  <div key={item.label} className="bg-white/5 rounded-xl p-3 text-center">
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-white/40 mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>

              <OccupancyBar used={selected.usedSpots} total={selected.totalSpots} />

              <div>
                <p className="text-sm font-medium text-white mb-3">Sơ đồ chỗ đỗ</p>
                <div className="bg-white/5 rounded-xl p-4">
                  <SlotMap
                    floors={allFloors}
                    slots={allSlots}
                    buildingId={selected.id}
                    selectedSlotId={selectedSlotId}
                    onSelectSlot={setSelectedSlotId}
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

            <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
              <button onClick={closeModal} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors">
                Đóng
              </button>
              <button
                onClick={() => { closeModal(); openEdit(selected); }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#101A31] bg-gradient-to-r from-[#00C2FF] to-[#3BFFA4] hover:opacity-90 transition-opacity"
              >
                Chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT MODAL ── */}
      {(modalType === 'add' || modalType === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0F1B2D] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-base font-semibold text-white">
                {modalType === 'add' ? 'Thêm tòa nhà mới' : `Chỉnh sửa · ${selected?.name}`}
              </h3>
              <button onClick={closeModal} className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {formFields.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#00C2FF]/50 transition-colors"
                  />
                </div>
              ))}

              {modalType === 'edit' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Trạng thái</label>
                    <select
                      value={form.status}
                      onChange={e => setForm(prev => ({ ...prev, status: e.target.value as ParkingLot['status'] }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00C2FF]/50 transition-colors appearance-none"
                    >
                      <option value="active"      className="bg-[#0F1B2D]">Hoạt động</option>
                      <option value="maintenance" className="bg-[#0F1B2D]">Bảo trì</option>
                      <option value="full"        className="bg-[#0F1B2D]">Đầy chỗ</option>
                    </select>
                  </div>

                  {/* Floor management */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">
                      Danh sách tầng ({editFloors.length} tầng)
                    </label>

                    {/* Existing floors */}
                    <div className="space-y-1.5 mb-2 max-h-36 overflow-y-auto">
                      {floorLoading && editFloors.length === 0 ? (
                        <div className="flex items-center gap-2 py-2 text-xs text-white/30">
                          <Loader2 size={12} className="animate-spin" /> Đang tải...
                        </div>
                      ) : editFloors.length === 0 ? (
                        <p className="text-xs text-white/30 py-2">Chưa có tầng nào.</p>
                        editFloors.map(f => (
                          <div key={f.id} className="flex flex-col gap-2 px-3 py-2 bg-white/5 rounded-lg">
                            {editingFloorId === f.id ? (
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={editFloorName}
                                    onChange={e => { setEditFloorName(e.target.value); setFloorError(''); }}
                                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00C2FF]/50"
                                    placeholder="Tên tầng"
                                  />
                                  <input
                                    type="number"
                                    placeholder="+ thêm chỗ"
                                    min={0}
                                    max={100 - f.slotCount}
                                    value={editFloorAddedSlots}
                                    onChange={e => { setEditFloorAddedSlots(e.target.value); setFloorError(''); }}
                                    className="w-24 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00C2FF]/50"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <select
                                    value={editFloorVehicleTypeId}
                                    onChange={e => { setEditFloorVehicleTypeId(e.target.value); setFloorError(''); }}
                                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00C2FF]/50 appearance-none"
                                  >
                                    <option value="" className="bg-[#0F1B2D]">-- Loại xe (nếu thêm chỗ) --</option>
                                    {vehicleTypes.map(vt => (
                                      <option key={vt.id} value={vt.id} className="bg-[#0F1B2D]">{vt.name}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => saveFloorEdit(f)}
                                    disabled={floorLoading}
                                    className="p-1.5 rounded-lg text-[#3BFFA4] hover:bg-[#3BFFA4]/10 transition-all disabled:opacity-30"
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
                                    className="p-1 rounded-lg text-[#00C2FF]/50 hover:text-[#00C2FF] hover:bg-[#00C2FF]/10 transition-all disabled:opacity-30"
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

                    {/* Add new floor */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Tên tầng (vd: Tầng 1)"
                          value={newFloorName}
                          onChange={e => { setNewFloorName(e.target.value); setFloorError(''); }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#00C2FF]/50 transition-colors"
                        />
                        <input
                          type="number"
                          placeholder="Số chỗ (tối đa 100)"
                          min={0}
                          max={100}
                          value={newFloorSlotCount}
                          onChange={e => { setNewFloorSlotCount(e.target.value); setFloorError(''); }}
                          className="w-32 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#00C2FF]/50 transition-colors"
                        />
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={newFloorVehicleTypeId}
                          onChange={e => { setNewFloorVehicleTypeId(e.target.value); setFloorError(''); }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00C2FF]/50 transition-colors appearance-none"
                        >
                          <option value="" className="bg-[#0F1B2D]">-- Loại xe (nếu có chỗ) --</option>
                          {vehicleTypes.map(vt => (
                            <option key={vt.id} value={vt.id} className="bg-[#0F1B2D]">{vt.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleAddFloor}
                          disabled={floorLoading || !newFloorName.trim()}
                          className="px-3 py-2 rounded-xl bg-[#00C2FF]/20 border border-[#00C2FF]/30 text-[#00C2FF] hover:bg-[#00C2FF]/30 transition-all disabled:opacity-40 flex items-center gap-1.5 text-sm font-medium whitespace-nowrap"
                        >
                          {floorLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                          Thêm tầng
                        </button>
                      </div>
                    </div>

                    {floorError && (
                      <p className="text-xs text-red-400 flex items-center gap-1.5 mt-1.5">
                        <AlertTriangle size={11} /> {floorError}
                      </p>
                    )}
                  </div>
                </>
              )}

              {formError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  {formError}
                </p>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-white/10">
              <button onClick={closeModal} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50">
                Huỷ
              </button>
              <button
                onClick={modalType === 'add' ? handleAdd : handleEdit}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#101A31] bg-gradient-to-r from-[#00C2FF] to-[#3BFFA4] hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {modalType === 'add' ? 'Thêm mới' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {modalType === 'delete' && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0F1B2D] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-400/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-white">Xoá tòa nhà?</h3>
              <p className="text-sm text-white/50 mt-2 leading-relaxed">
                Bạn sắp xoá <span className="text-white font-medium">{selected.name}</span> ({selected.address}).
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
              <button onClick={closeModal} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50">
                Huỷ
              </button>
              <button onClick={handleDelete} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
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