/**
 * Manager/VehicleTypes.tsx
 * Branch: Feature/ManageVehicleTypes-Manager
 * Vehicle type management and parking slot allocation by vehicle type
 *
 * Features:
 *  - View vehicle type list with slot statistics
 *  - Add / Edit / Delete vehicle types
 *  - View slot distribution Available / Occupied / Reserved / Maintenance per type
 */

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import {
  Car, Plus, Search, Pencil, Trash2, X,
  AlertTriangle, Loader2, RefreshCw,
  CircleCheck, ParkingSquare, LayoutGrid,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getVehicleTypes,
} from '../../services/buildingsService';
import type { VehicleTypeResponse } from '../../services/buildingsService';
import { getAllSlots } from '../../services/parkingService';
import type { ParkingSlotDetail, SlotStatus } from '../../services/parkingService';
import { SLOT_STATUS_LABELS, SLOT_STATUS_COLORS, SLOT_STATUS_FROM_ENUM } from '../../services/parkingService';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('sp_token');
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text.trim()) { if (res.ok) return undefined as T; throw new Error(`Error ${res.status}.`); }
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('Invalid response.'); }
  if (!res.ok) throw new Error((data as { message?: string }).message ?? `Error ${res.status}.`);
  return data as T;
}

const createVehicleType = (payload: { name: string; description?: string }) =>
  apiFetch<VehicleTypeResponse>('/api/VehicleTypes', { method: 'POST', body: JSON.stringify(payload) });

const updateVehicleType = (id: string, payload: { name: string; description?: string }) =>
  apiFetch<VehicleTypeResponse>(`/api/VehicleTypes/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

const deleteVehicleType = (id: string) =>
  apiFetch<void>(`/api/VehicleTypes/${id}`, { method: 'DELETE' });

// ─── Types ────────────────────────────────────────────────────────────────────

interface VehicleTypeVM extends VehicleTypeResponse {
  slotCounts: Record<SlotStatus, number>;
  totalSlots: number;
}

const emptyForm = { name: '', description: '' };

// ─── Slot distribution bar ────────────────────────────────────────────────────

function DistributionBar({ counts, total }: { counts: Record<SlotStatus, number>; total: number }) {
  if (total === 0) return <p className="text-xs text-white/30 py-1">No parking slots yet</p>;
  const statuses: SlotStatus[] = ['Available', 'Occupied', 'Reserved', 'Maintenance', 'TemporaryHeld'];
  const colors: Record<SlotStatus, string> = {
    Available:   '#FF4C4C',
    Occupied:    '#F59E0B',
    Reserved:    '#F59E0B',
    Maintenance: '#F87171',
    TemporaryHeld: '#9CA3AF'
  };
  return (
    <div className="space-y-2">
      <div className="h-2 rounded-full bg-white/10 overflow-hidden flex">
        {statuses.map(s => {
          const pct = total > 0 ? (counts[s] / total) * 100 : 0;
          return pct > 0 ? (
            <div key={s} style={{ width: `${pct}%`, backgroundColor: colors[s] }} className="h-full transition-all duration-500" />
          ) : null;
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        {statuses.map(s => (
          <div key={s} className="flex items-center gap-1.5 text-xs text-white/50">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[s] }} />
            {SLOT_STATUS_LABELS[s]}: <span className="font-semibold text-white">{counts[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ManagerVehicleTypes() {
  const { token } = useAuth();

  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeVM[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [apiError, setApiError]         = useState('');
  const [search, setSearch]             = useState('');

  const [modalType, setModalType] = useState<'add' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected]   = useState<VehicleTypeVM | null>(null);
  const [form, setForm]           = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ─── Load ────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setApiError('');
    try {
      const [vts, slots] = await Promise.all([getVehicleTypes(), getAllSlots()]);

      // Group slots by vehicleTypeId
      const slotsByType: Record<string, ParkingSlotDetail[]> = {};
      slots.forEach(s => {
        if (!slotsByType[s.vehicleTypeId]) slotsByType[s.vehicleTypeId] = [];
        slotsByType[s.vehicleTypeId].push(s);
      });

      const vms: VehicleTypeVM[] = vts.map(vt => {
        const typeSlots = slotsByType[vt.id] ?? [];
        const counts: Record<SlotStatus, number> = {
          Available: 0, Occupied: 0, Reserved: 0, Maintenance: 0, TemporaryHeld: 0
        };
        typeSlots.forEach(s => {
          const statusStr = typeof s.status === 'number' ? SLOT_STATUS_FROM_ENUM[s.status] : s.status;
          if (statusStr && counts[statusStr as SlotStatus] !== undefined) {
            counts[statusStr as SlotStatus]++;
          }
        });
        return {
          ...vt,
          slotCounts: counts,
          totalSlots: typeSlots.length,
        };
      });

      setVehicleTypes(vms);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unable to load data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const closeModal = () => {
    setModalType(null); setSelected(null); setFormError(''); setSubmitting(false);
  };

  const openAdd  = () => { setForm(emptyForm); setFormError(''); setModalType('add'); };
  const openEdit = (vt: VehicleTypeVM) => {
    setSelected(vt);
    setForm({ name: vt.name, description: vt.description ?? '' });
    setFormError(''); setModalType('edit');
  };
  const openDelete = (vt: VehicleTypeVM) => { setSelected(vt); setModalType('delete'); };

  const validateForm = () => {
    if (!form.name.trim()) return 'Please enter vehicle type name.';
    return '';
  };

  const handleAdd = async () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    if (!token) return;
    setSubmitting(true);
    try {
      const created = await createVehicleType({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      });
      setVehicleTypes(prev => [...prev, {
        ...created,
        slotCounts: { Available: 0, Occupied: 0, Reserved: 0, Maintenance: 0, TemporaryHeld: 0 },
        totalSlots: 0,
      }]);
      closeModal();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'An error occurred.');
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    if (!selected || !token) return;
    setSubmitting(true);
    try {
      const updated = await updateVehicleType(selected.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      });
      setVehicleTypes(prev => prev.map(vt => vt.id !== selected.id ? vt : {
        ...vt, name: updated.name, description: updated.description,
      }));
      closeModal();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'An error occurred.');
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected || !token) return;
    setSubmitting(true);
    try {
      await deleteVehicleType(selected.id);
      setVehicleTypes(prev => prev.filter(vt => vt.id !== selected.id));
      closeModal();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Unable to delete this vehicle type. There may be slots linked to it.');
      setSubmitting(false);
    }
  };

  // ─── Computed ────────────────────────────────────────────────────────────────

  const filtered = vehicleTypes.filter(vt =>
    vt.name.toLowerCase().includes(search.toLowerCase()) ||
    (vt.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalSlots     = vehicleTypes.reduce((s, vt) => s + vt.totalSlots, 0);
  const totalAvailable = vehicleTypes.reduce((s, vt) => s + vt.slotCounts.Available, 0);
  const totalOccupied  = vehicleTypes.reduce((s, vt) => s + vt.slotCounts.Occupied, 0);

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
        <p className="text-sm text-white/40">Loading vehicle data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Vehicle Types</h2>
          <p className="text-sm text-white/40 mt-0.5">
            {vehicleTypes.length} vehicle types · {totalSlots} total parking slots
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white"
            title="Refresh"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF4C4C] hover:bg-[#ff3333] text-black font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            Add Vehicle Type
          </button>
        </div>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{apiError}</p>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Slots',  value: totalSlots,     icon: ParkingSquare, color: '#A78BFA', bg: 'from-violet-400/20 to-violet-400/5' },
          { label: 'Available Slots', value: totalAvailable, icon: CircleCheck,   color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5' },
          { label: 'Occupied',    value: totalOccupied,  icon: Car,           color: '#F59E0B', bg: 'from-amber-500/20 to-amber-500/5' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="glass-card p-5 rounded-2xl">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.bg} flex items-center justify-center mb-3`}>
                <Icon size={19} style={{ color: s.color }} />
              </div>
              <p className="text-2xl font-bold text-white">{s.value.toLocaleString('vi-VN')}</p>
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
          placeholder="Search vehicle type..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
        />
      </div>

      {/* Vehicle type cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <p className="col-span-3 text-center py-12 text-white/30 text-sm">No vehicle types found.</p>
        )}
        {filtered.map(vt => {
          const availPct = vt.totalSlots > 0 ? Math.round((vt.slotCounts.Available / vt.totalSlots) * 100) : 0;
          return (
            <div key={vt.id} className="glass-card p-5 rounded-2xl flex flex-col gap-4 hover:border-white/20 transition-all">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#FF4C4C]/10 flex items-center justify-center">
                    <Car size={20} className="text-[#FF4C4C]" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{vt.name}</p>
                    <p className="text-xs text-white/40 mt-0.5 line-clamp-1">
                      {vt.description || 'No description yet'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#FF4C4C]">{availPct}%</p>
                  <p className="text-[10px] text-white/30">available</p>
                </div>
              </div>

              {/* Slot counts */}
              <div className="grid grid-cols-4 gap-1.5">
                {(['Available', 'Occupied', 'Reserved', 'Maintenance'] as SlotStatus[]).map(s => {
                  const cfg = SLOT_STATUS_COLORS[s];
                  return (
                    <div key={s} className={`${cfg.bg} rounded-xl p-2 text-center`}>
                      <p className={`text-base font-bold ${cfg.text}`}>{vt.slotCounts[s]}</p>
                      <p className="text-[9px] text-white/40 mt-0.5 leading-tight">{SLOT_STATUS_LABELS[s]}</p>
                    </div>
                  );
                })}
              </div>

              {/* Distribution bar */}
              <DistributionBar counts={vt.slotCounts} total={vt.totalSlots} />

              {/* Total */}
              <div className="flex items-center justify-between text-xs text-white/40 pt-1 border-t border-white/5">
                <span className="flex items-center gap-1.5">
                  <LayoutGrid size={11} />
                  {vt.totalSlots} slots
                </span>
                <span>Created: {vt.createdAt ? new Date(vt.createdAt).toLocaleDateString('vi-VN') : 'Unknown'}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(vt)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-[#FF4C4C]/70 hover:text-[#FF4C4C] hover:bg-[#FF4C4C]/10 transition-all"
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  onClick={() => openDelete(vt)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══ ADD / EDIT MODAL ══ */}
      {(modalType === 'add' || modalType === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-white/10 rounded-2xl w-full max-w-md shadow-2xl" style={{ backgroundColor: 'var(--admin-bg-surface)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-base font-semibold text-white">
                {modalType === 'add' ? 'Add Vehicle Type' : `Edit · ${selected?.name}`}
              </h3>
              <button onClick={closeModal} className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Vehicle Type Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  placeholder="e.g.: Motorbike, Car, Truck..."
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Description</label>
                <textarea
                  rows={3}
                  placeholder="Description of this vehicle type..."
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors resize-none"
                />
              </div>

              {formError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-400/10 border border-red-400/20 rounded-xl">
                  <AlertTriangle size={13} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{formError}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
              <button onClick={closeModal} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors">
                Cancel
              </button>
              <button
                onClick={modalType === 'add' ? handleAdd : handleEdit}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black bg-[#FF4C4C] hover:bg-[#ff3333] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {modalType === 'add' ? 'Add Vehicle Type' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DELETE MODAL ══ */}
      {modalType === 'delete' && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-red-400/20 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5" style={{ backgroundColor: 'var(--admin-bg-surface)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Delete Vehicle Type</h3>
                <p className="text-xs text-white/40 mt-0.5">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-white/70">
              Delete vehicle type <span className="font-semibold text-white">"{selected.name}"</span>?{' '}
              {selected.totalSlots > 0 && (
                <span className="text-amber-400">
                  ⚠ This vehicle type has {selected.totalSlots} linked parking slots!
                </span>
              )}
            </p>
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <div className="flex gap-3">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
