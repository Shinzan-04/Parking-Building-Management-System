import { useState, useEffect } from 'react';
import {
  Building2, ParkingSquare, CircleCheck, Wrench,
  Plus, Search, Pencil, Trash2, MapPin,
  X, AlertTriangle, Clock, Eye, Loader2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getBuildings, getFloors, getParkingSlots, isSlotOccupied,
  createBuilding, updateBuilding, deleteBuilding,
} from '../../services/buildingsService';

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

function SpotGrid({ lot }: { lot: ParkingLot }) {
  const maxShow = 60;
  const showCount = Math.min(lot.totalSpots, maxShow);
  const overflow = lot.totalSpots - maxShow;
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: showCount }, (_, i) => (
          <div
            key={i}
            title={i < lot.usedSpots ? `Chỗ ${i + 1}: Đã dùng` : `Chỗ ${i + 1}: Còn trống`}
            className={`w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-bold border transition-colors ${
              i < lot.usedSpots
                ? 'bg-[#00C2FF]/20 border-[#00C2FF]/50 text-[#00C2FF]'
                : 'bg-white/5 border-white/10 text-white/20'
            }`}
          >
            {i < lot.usedSpots ? 'P' : (i + 1)}
          </div>
        ))}
        {overflow > 0 && (
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-bold bg-white/5 border border-dashed border-white/20 text-white/30">
            +{overflow}
          </div>
        )}
      </div>
      <div className="flex items-center gap-5 mt-3 text-xs text-white/40">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-[#00C2FF]/20 border border-[#00C2FF]/50" />
          Đã dùng ({lot.usedSpots})
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-white/5 border border-white/10" />
          Còn trống ({lot.totalSpots - lot.usedSpots})
        </div>
      </div>
    </div>
  );
}


export default function ParkingLots() {
  const { token } = useAuth();

  const [lots, setLots]           = useState<ParkingLot[]>([]);
  const [loading, setLoading]     = useState(true);
  const [apiError, setApiError]   = useState('');
  const [search, setSearch]       = useState('');
  const [modalType, setModalType] = useState<'add' | 'detail' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected]   = useState<ParkingLot | null>(null);
  const [form, setForm]           = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    try {
      const [buildings, floors, slots] = await Promise.all([
        getBuildings(), getFloors(), getParkingSlots(),
      ]);

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

  useEffect(() => { loadData(); }, []);

  const openAdd    = () => { setForm(emptyForm); setFormError(''); setModalType('add'); };
  const openDetail = (lot: ParkingLot) => { setSelected(lot); setModalType('detail'); };
  const openEdit   = (lot: ParkingLot) => {
    setSelected(lot);
    setForm({ name: lot.name, address: lot.address, totalSpots: String(lot.totalSpots), status: lot.status });
    setFormError('');
    setModalType('edit');
  };
  const openDelete = (lot: ParkingLot) => { setSelected(lot); setModalType('delete'); };
  const closeModal = () => { setModalType(null); setSelected(null); setFormError(''); setSubmitting(false); };

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
    { key: 'name',       label: 'Tên tòa nhà',       placeholder: 'Ví dụ: Tòa A',               type: 'text'   },
    { key: 'address',    label: 'Địa chỉ',            placeholder: 'Ví dụ: 123 Đường Lê Lợi',    type: 'text'   },
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
          <div className="bg-[#0F1B2D] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
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
                  { label: 'Sức chứa',   value: selected.totalSpots,                       color: 'text-white' },
                  { label: 'Đã dùng',    value: selected.usedSpots,                         color: 'text-[#00C2FF]' },
                  { label: 'Còn trống',  value: selected.totalSpots - selected.usedSpots,   color: 'text-[#3BFFA4]' },
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
                  <SpotGrid lot={selected} />
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
                <Clock size={15} className="text-white/40 shrink-0" />
                <p className="text-sm text-white/50">
                  {selected.floorCount} tầng · Để xem danh sách xe đang đỗ, vui lòng kiểm tra tại màn hình check-in.
                </p>
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