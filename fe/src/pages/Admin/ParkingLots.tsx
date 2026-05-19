import { useState } from 'react';
import {
  Building2, ParkingSquare, CircleCheck, Wrench,
  Plus, Search, Pencil, Trash2, MapPin,
  X, AlertTriangle, Car, Clock, Eye,
} from 'lucide-react';

interface ParkingLot {
  id: number;
  name: string;
  address: string;
  floor: string;
  totalSpots: number;
  usedSpots: number;
  status: 'active' | 'maintenance' | 'full';
}

const initialLots: ParkingLot[] = [
  { id: 1, name: 'Khu A', address: 'Tầng 1 - Cánh Bắc', floor: 'T1', totalSpots: 120, usedSpots: 98,  status: 'active' },
  { id: 2, name: 'Khu B', address: 'Tầng 2 - Cánh Bắc', floor: 'T2', totalSpots: 120, usedSpots: 75,  status: 'active' },
  { id: 3, name: 'Khu C', address: 'Tầng 3 - Cánh Nam',  floor: 'T3', totalSpots: 100, usedSpots: 100, status: 'full' },
  { id: 4, name: 'Khu D', address: 'Tầng 4 - Cánh Nam',  floor: 'T4', totalSpots: 100, usedSpots: 42,  status: 'active' },
  { id: 5, name: 'Khu E', address: 'Tầng hầm B1',        floor: 'B1', totalSpots: 80,  usedSpots: 0,   status: 'maintenance' },
  { id: 6, name: 'Khu F', address: 'Tầng hầm B2',        floor: 'B2', totalSpots: 80,  usedSpots: 27,  status: 'active' },
];

// Mock vehicles currently parked per lot (for detail view)
const parkedVehicles: Record<string, { plate: string; entry: string; type: 'car' | 'motorbike' }[]> = {
  'Khu A': [
    { plate: '51G-123.45', entry: '08:23', type: 'car' },
    { plate: '30A-456.78', entry: '09:10', type: 'motorbike' },
    { plate: '43C-789.01', entry: '07:45', type: 'car' },
    { plate: '15A-890.12', entry: '11:00', type: 'car' },
    { plate: '51F-111.22', entry: '10:00', type: 'motorbike' },
  ],
  'Khu B': [
    { plate: '60H-567.89', entry: '08:30', type: 'motorbike' },
    { plate: '29B-678.90', entry: '09:30', type: 'car' },
    { plate: '30K-333.44', entry: '10:20', type: 'motorbike' },
  ],
  'Khu C': [
    { plate: '74D-321.65', entry: '07:00', type: 'car' },
    { plate: '92B-234.56', entry: '08:10', type: 'car' },
    { plate: '15B-246.80', entry: '11:30', type: 'car' },
    { plate: '60G-999.00', entry: '11:15', type: 'motorbike' },
    { plate: '43P-555.66', entry: '10:45', type: 'car' },
  ],
  'Khu D': [
    { plate: '74A-135.79', entry: '09:00', type: 'motorbike' },
    { plate: '92L-777.88', entry: '11:00', type: 'car' },
  ],
  'Khu E': [],
  'Khu F': [
    { plate: '29B-000.11', entry: '10:10', type: 'car' },
    { plate: '51K-222.33', entry: '09:45', type: 'motorbike' },
  ],
};

const statusConfig = {
  active:      { label: 'Hoạt động', bg: 'bg-[#3BFFA4]/10', text: 'text-[#3BFFA4]', dot: 'bg-[#3BFFA4]' },
  full:        { label: 'Đầy chỗ',   bg: 'bg-amber-400/10',  text: 'text-amber-400',  dot: 'bg-amber-400' },
  maintenance: { label: 'Bảo trì',   bg: 'bg-red-400/10',    text: 'text-red-400',    dot: 'bg-red-400' },
};

const emptyForm = { name: '', address: '', floor: '', totalSpots: '', status: 'active' as ParkingLot['status'] };

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
  const [lots, setLots] = useState<ParkingLot[]>(initialLots);
  const [search, setSearch] = useState('');
  const [modalType, setModalType] = useState<'add' | 'detail' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<ParkingLot | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const openAdd    = () => { setForm(emptyForm); setFormError(''); setModalType('add'); };
  const openDetail = (lot: ParkingLot) => { setSelected(lot); setModalType('detail'); };
  const openEdit   = (lot: ParkingLot) => {
    setSelected(lot);
    setForm({ name: lot.name, address: lot.address, floor: lot.floor, totalSpots: String(lot.totalSpots), status: lot.status });
    setFormError('');
    setModalType('edit');
  };
  const openDelete = (lot: ParkingLot) => { setSelected(lot); setModalType('delete'); };
  const closeModal = () => { setModalType(null); setSelected(null); setFormError(''); };

  const validateForm = () => {
    if (!form.name.trim()) return 'Vui lòng nhập tên khu.';
    if (!form.address.trim()) return 'Vui lòng nhập địa điểm / tầng.';
    if (!form.floor.trim()) return 'Vui lòng nhập ký hiệu tầng (T1, B1…).';
    if (!form.totalSpots || isNaN(Number(form.totalSpots)) || Number(form.totalSpots) <= 0)
      return 'Tổng số chỗ phải là số nguyên dương.';
    return '';
  };

  const handleAdd = () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    setLots(prev => [...prev, {
      id: Date.now(),
      name: form.name.trim(),
      address: form.address.trim(),
      floor: form.floor.trim(),
      totalSpots: Number(form.totalSpots),
      usedSpots: 0,
      status: 'active',
    }]);
    closeModal();
  };

  const handleEdit = () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    if (!selected) return;
    setLots(prev => prev.map(l => l.id !== selected.id ? l : {
      ...l,
      name: form.name.trim(),
      address: form.address.trim(),
      floor: form.floor.trim(),
      totalSpots: Number(form.totalSpots),
      status: form.status,
    }));
    closeModal();
  };

  const handleDelete = () => {
    if (!selected) return;
    setLots(prev => prev.filter(l => l.id !== selected.id));
    closeModal();
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
    { label: 'Tổng số khu',   value: lots.length,          unit: 'khu',  icon: Building2,     color: '#00C2FF', bg: 'from-[#00C2FF]/20 to-[#00C2FF]/5' },
    { label: 'Tổng chỗ đỗ',   value: totalSpots,            unit: 'chỗ',  icon: ParkingSquare, color: '#A78BFA', bg: 'from-violet-400/20 to-violet-400/5' },
    { label: 'Đang còn trống', value: totalSpots - usedSpots, unit: 'chỗ', icon: CircleCheck,   color: '#3BFFA4', bg: 'from-[#3BFFA4]/20 to-[#3BFFA4]/5' },
    { label: 'Đang bảo trì',  value: inMaintenance,         unit: 'khu',  icon: Wrench,        color: '#F87171', bg: 'from-red-400/20 to-red-400/5' },
  ];

  // Shared form fields config
  const formFields = [
    { key: 'name',       label: 'Tên khu',           placeholder: 'Ví dụ: Khu G',              type: 'text' },
    { key: 'address',    label: 'Địa điểm / Tầng',   placeholder: 'Ví dụ: Tầng 5 - Cánh Đông', type: 'text' },
    { key: 'floor',      label: 'Ký hiệu tầng',      placeholder: 'Ví dụ: T5 hoặc B3',         type: 'text' },
    { key: 'totalSpots', label: 'Tổng số chỗ đỗ',    placeholder: 'Ví dụ: 100',                type: 'number' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Bãi đỗ xe</h2>
          <p className="text-sm text-white/40 mt-0.5">
            Quản lý {lots.length} khu đỗ xe · {activeLots} đang hoạt động
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00C2FF] to-[#3BFFA4] text-[#101A31] font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Thêm khu mới
        </button>
      </div>

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
          placeholder="Tìm kiếm khu đỗ xe..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00C2FF]/50 transition-colors"
        />
      </div>

      {/* Lot cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <p className="col-span-3 text-center py-12 text-white/30 text-sm">Không tìm thấy khu đỗ xe nào.</p>
        )}
        {filtered.map((lot) => {
          const cfg = statusConfig[lot.status];
          const available = lot.totalSpots - lot.usedSpots;
          return (
            <div key={lot.id} className="glass-card p-5 rounded-2xl flex flex-col gap-4 hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-white/70">{lot.floor}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-white">{lot.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={11} className="text-white/30" />
                      <span className="text-xs text-white/40">{lot.address}</span>
                    </div>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
              </div>

              <OccupancyBar used={lot.usedSpots} total={lot.totalSpots} />

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Tổng chỗ',  value: lot.totalSpots, color: 'text-white' },
                  { label: 'Đã dùng',   value: lot.usedSpots,  color: 'text-[#00C2FF]' },
                  { label: 'Còn trống', value: available,      color: 'text-[#3BFFA4]' },
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
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-white/70">{selected.floor}</span>
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
              {/* Occupancy stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Tổng chỗ',  value: selected.totalSpots,                       color: 'text-white' },
                  { label: 'Đã dùng',   value: selected.usedSpots,                         color: 'text-[#00C2FF]' },
                  { label: 'Còn trống', value: selected.totalSpots - selected.usedSpots,   color: 'text-[#3BFFA4]' },
                ].map(item => (
                  <div key={item.label} className="bg-white/5 rounded-xl p-3 text-center">
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-white/40 mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>

              <OccupancyBar used={selected.usedSpots} total={selected.totalSpots} />

              {/* Spot grid */}
              <div>
                <p className="text-sm font-medium text-white mb-3">Sơ đồ chỗ đỗ</p>
                <div className="bg-white/5 rounded-xl p-4">
                  <SpotGrid lot={selected} />
                </div>
              </div>

              {/* Currently parked vehicles */}
              {(parkedVehicles[selected.name]?.length ?? 0) > 0 && (
                <div>
                  <p className="text-sm font-medium text-white mb-3">
                    Xe đang đỗ
                    <span className="ml-2 text-xs text-white/30 font-normal">
                      ({parkedVehicles[selected.name].length} xe)
                    </span>
                  </p>
                  <div className="space-y-2">
                    {parkedVehicles[selected.name].map((v, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Car size={14} className={v.type === 'car' ? 'text-[#00C2FF]' : 'text-[#3BFFA4]'} />
                          <span className="text-sm font-mono font-semibold text-white">{v.plate}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-white/40">
                          <Clock size={11} />
                          Vào lúc {v.entry}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.status === 'maintenance' && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl">
                  <AlertTriangle size={16} className="text-red-400 shrink-0" />
                  <p className="text-sm text-red-400">Khu này đang trong quá trình bảo trì, không nhận xe.</p>
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
                Chỉnh sửa khu này
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
                {modalType === 'add' ? 'Thêm khu đỗ xe mới' : `Chỉnh sửa · ${selected?.name}`}
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
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors">
                Huỷ
              </button>
              <button
                onClick={modalType === 'add' ? handleAdd : handleEdit}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#101A31] bg-gradient-to-r from-[#00C2FF] to-[#3BFFA4] hover:opacity-90 transition-opacity"
              >
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
              <h3 className="text-base font-semibold text-white">Xoá khu đỗ xe?</h3>
              <p className="text-sm text-white/50 mt-2 leading-relaxed">
                Bạn sắp xoá <span className="text-white font-medium">{selected.name}</span> ({selected.address}).
                <br />Hành động này không thể hoàn tác.
              </p>
              {selected.usedSpots > 0 && (
                <div className="flex items-center gap-2 mt-3 px-3 py-2.5 bg-amber-400/10 border border-amber-400/20 rounded-xl text-left">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-400">
                    Khu này hiện có <strong>{selected.usedSpots} xe đang đỗ</strong>. Hãy chắc chắn trước khi xoá.
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors">
                Huỷ
              </button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
                Xác nhận xoá
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
