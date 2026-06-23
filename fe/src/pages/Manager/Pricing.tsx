/**
 * Manager/Pricing.tsx
 * Quản lý bảng giá Block Ngày/Đêm (dùng cho Booking)
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Pencil, Trash2, X,
  AlertTriangle, Loader2, RefreshCw,
  Sun, Moon, TrendingUp, Tag, Zap,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getVehicleTypes } from '../../services/buildingsService';
import type { VehicleTypeResponse } from '../../services/buildingsService';
import {
  getAllPolicies, createPolicy, updatePolicy, deletePolicy,
} from '../../services/pricingService';
import type {
  PricingPolicyResponse,
  CreatePricingPolicyRequest,
  UpdatePricingPolicyRequest,
} from '../../services/pricingService';

const vnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

const emptyForm = {
  vehicleTypeId: '',
  blockDurationHours: '4',
  dayBlockRate: '',
  nightBlockRate: '',
  nightStartHour: '22',
  nightEndHour: '6',
  dailyRate: '',
  overtimeMultiplier: '1.5',
};

type PolicyForm = typeof emptyForm;
type ModalMode  = 'add' | 'edit' | 'delete' | null;

export default function ManagerPricing() {
  const { token } = useAuth();

  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeResponse[]>([]);
  const [policies, setPolicies]         = useState<PricingPolicyResponse[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [apiError, setApiError]         = useState('');

  const [modal, setModal]           = useState<ModalMode>(null);
  const [selected, setSelected]     = useState<PricingPolicyResponse | null>(null);
  const [form, setForm]             = useState<PolicyForm>(emptyForm);
  const [formError, setFormError]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setApiError('');
    const errors: string[] = [];
    const [vts, allPolicies] = await Promise.all([
      getVehicleTypes().catch(() => { errors.push('loại xe'); return [] as VehicleTypeResponse[]; }),
      getAllPolicies(token).catch(() => { errors.push('chính sách giá'); return [] as PricingPolicyResponse[]; }),
    ]);
    setVehicleTypes(vts);
    setPolicies(allPolicies);
    if (errors.length) setApiError(`Không thể tải: ${errors.join(', ')}.`);
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const closeModal = () => {
    setModal(null); setSelected(null); setFormError(''); setSubmitting(false);
  };

  const openAdd = () => {
    setForm({ ...emptyForm, vehicleTypeId: vehicleTypes[0]?.id ?? '' });
    setFormError('');
    setModal('add');
  };

  const openEdit = (p: PricingPolicyResponse) => {
    setSelected(p);
    setForm({
      vehicleTypeId:      p.vehicleTypeId,
      blockDurationHours: String(p.blockDurationHours),
      dayBlockRate:       String(p.dayBlockRate),
      nightBlockRate:     String(p.nightBlockRate),
      nightStartHour:     String(p.nightStartHour),
      nightEndHour:       String(p.nightEndHour),
      dailyRate:          String(p.dailyRate),
      overtimeMultiplier: String(p.overtimeMultiplier),
    });
    setFormError('');
    setModal('edit');
  };

  const validate = (): string => {
    if (modal === 'add' && !form.vehicleTypeId) return 'Vui lòng chọn loại xe.';
    if (Number(form.blockDurationHours) <= 0) return 'Thời lượng block phải > 0 giờ.';
    if (Number(form.dayBlockRate) < 0) return 'Giá block ban ngày phải >= 0.';
    if (Number(form.nightBlockRate) < 0) return 'Giá block ban đêm phải >= 0.';
    if (Number(form.dailyRate) < 0) return 'Giá trọn ngày phải >= 0.';
    if (Number(form.overtimeMultiplier) <= 0) return 'Hệ số overtime phải > 0.';
    const ns = Number(form.nightStartHour);
    const ne = Number(form.nightEndHour);
    if (isNaN(ns) || ns < 0 || ns > 23) return 'Giờ bắt đầu đêm phải từ 0–23.';
    if (isNaN(ne) || ne < 0 || ne > 23) return 'Giờ kết thúc đêm phải từ 0–23.';
    return '';
  };

  const buildPayload = () => ({
    blockPrice: 0,
    hourlyRate: 0,
    dailyMaxRate: 0,
    blockDurationHours: Number(form.blockDurationHours),
    dayBlockRate:       Number(form.dayBlockRate),
    nightBlockRate:     Number(form.nightBlockRate),
    nightStartHour:     Number(form.nightStartHour),
    nightEndHour:       Number(form.nightEndHour),
    dailyRate:          Number(form.dailyRate),
    overtimeMultiplier: Number(form.overtimeMultiplier),
  });

  const handleAdd = async () => {
    const err = validate();
    if (err) { setFormError(err); return; }
    if (!token) return;
    setSubmitting(true);
    try {
      const payload: CreatePricingPolicyRequest = { vehicleTypeId: form.vehicleTypeId, ...buildPayload() };
      const created = await createPolicy(payload, token);
      setPolicies(prev => [...prev, created]);
      closeModal();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    const err = validate();
    if (err) { setFormError(err); return; }
    if (!selected || !token) return;
    setSubmitting(true);
    try {
      const payload: UpdatePricingPolicyRequest = buildPayload();
      const updated = await updatePolicy(selected.id, payload, token);
      setPolicies(prev => prev.map(p => p.id === selected.id ? updated : p));
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
      await deletePolicy(selected.id, token);
      setPolicies(prev => prev.filter(p => p.id !== selected.id));
      closeModal();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Không thể xoá.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
        <p className="text-sm text-white/40">Đang tải bảng giá...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Bảng giá & Chính sách phí</h2>
          <p className="text-sm text-white/40 mt-0.5">{policies.length} chính sách</p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{apiError}</p>
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Bảng giá Block Ngày / Đêm</h3>
          <p className="text-xs text-white/40 mt-0.5">Cấu hình giá theo từng block thời gian ban ngày và ban đêm (dùng cho Booking)</p>
        </div>
        <button
          onClick={openAdd}
          disabled={vehicleTypes.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF4C4C] hover:bg-[#ff3333] text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Plus size={15} /> Thêm chính sách
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {policies.length === 0 && (
          <p className="col-span-3 text-center py-12 text-white/30 text-sm">Chưa có chính sách giá nào.</p>
        )}
        {policies.map(p => (
          <div key={p.id} className="glass-card p-5 rounded-2xl space-y-4 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Tag size={16} className="text-amber-500" />
                </div>
                <p className="text-xs text-white/40">Block {p.blockDurationHours}h · đêm {p.nightStartHour}h–{p.nightEndHour}h</p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold">
                {p.vehicleTypeName || vehicleTypes.find(v => v.id === p.vehicleTypeId)?.name || p.vehicleTypeId}
              </span>
            </div>

            <div className="space-y-2.5">
              {[
                { icon: Sun,        label: 'Ban ngày / block',  value: vnd(p.dayBlockRate),        color: '#F59E0B' },
                { icon: Moon,       label: 'Ban đêm / block',   value: vnd(p.nightBlockRate),      color: '#A78BFA' },
                { icon: TrendingUp, label: 'Giá trọn ngày',     value: vnd(p.dailyRate),           color: '#F87171' },
                { icon: Zap,        label: 'Hệ số overtime',    value: `×${p.overtimeMultiplier}`, color: '#34D399' },
              ].map(row => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className="flex items-center justify-between px-3 py-2 bg-white/[0.04] rounded-xl">
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <Icon size={12} style={{ color: row.color }} />
                      {row.label}
                    </div>
                    <span className="text-sm font-semibold text-white">{row.value}</span>
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-white/30 pt-1 border-t border-white/5">
              Tạo: {new Date(p.createdAt).toLocaleDateString('vi-VN')}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => openEdit(p)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-amber-500/70 hover:text-amber-500 hover:bg-amber-500/10 transition-all"
              >
                <Pencil size={13} /> Sửa
              </button>
              <button
                onClick={() => { setSelected(p); setModal('delete'); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all"
              >
                <Trash2 size={13} /> Xoá
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ══ Add / Edit Modal ══ */}
      {(modal === 'add' || modal === 'edit') && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-md shadow-2xl bg-white dark:bg-[#0E0E10] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 shrink-0">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                {modal === 'add' ? 'Thêm chính sách giá' : `Sửa chính sách · ${selected?.vehicleTypeName}`}
              </h3>
              <button onClick={closeModal} className="p-1.5 rounded-xl text-gray-400 dark:text-white/40 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">

              {modal === 'add' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">Loại xe <span className="text-red-400">*</span></label>
                  <select
                    value={form.vehicleTypeId}
                    onChange={e => setForm(f => ({ ...f, vehicleTypeId: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-[#FF4C4C]/50 transition-colors appearance-none"
                  >
                    <option value="">-- Chọn loại xe --</option>
                    {vehicleTypes.map(vt => (
                      <option key={vt.id} value={vt.id}>{vt.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">Thời lượng 1 block (giờ)</label>
                <input
                  type="number" min={1} placeholder="4"
                  value={form.blockDurationHours}
                  onChange={e => setForm(p => ({ ...p, blockDurationHours: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">
                    <Sun size={11} className="inline mr-1 text-amber-400" />Giá block ban ngày (đ)
                  </label>
                  <input
                    type="number" min={0} placeholder="VD: 30000"
                    value={form.dayBlockRate}
                    onChange={e => setForm(p => ({ ...p, dayBlockRate: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">
                    <Moon size={11} className="inline mr-1 text-violet-400" />Giá block ban đêm (đ)
                  </label>
                  <input
                    type="number" min={0} placeholder="VD: 20000"
                    value={form.nightBlockRate}
                    onChange={e => setForm(p => ({ ...p, nightBlockRate: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">
                    <Moon size={11} className="inline mr-1 text-violet-400" />Giờ bắt đầu đêm
                  </label>
                  <input
                    type="number" min={0} max={23} placeholder="22"
                    value={form.nightStartHour}
                    onChange={e => setForm(p => ({ ...p, nightStartHour: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">
                    <Sun size={11} className="inline mr-1 text-amber-400" />Giờ kết thúc đêm
                  </label>
                  <input
                    type="number" min={0} max={23} placeholder="6"
                    value={form.nightEndHour}
                    onChange={e => setForm(p => ({ ...p, nightEndHour: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">Giá trọn ngày (đ)</label>
                  <input
                    type="number" min={0} placeholder="VD: 150000"
                    value={form.dailyRate}
                    onChange={e => setForm(p => ({ ...p, dailyRate: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">
                    <Zap size={11} className="inline mr-1 text-emerald-400" />Hệ số overtime
                  </label>
                  <input
                    type="number" min={1} step={0.1} placeholder="1.5"
                    value={form.overtimeMultiplier}
                    onChange={e => setForm(p => ({ ...p, overtimeMultiplier: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                  />
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-400/10 border border-red-400/20 rounded-xl">
                  <AlertTriangle size={13} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{formError}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex justify-end gap-3 shrink-0">
              <button onClick={closeModal} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-white/60 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">Hủy</button>
              <button
                onClick={modal === 'add' ? handleAdd : handleEdit}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black bg-[#FF4C4C] hover:bg-[#ff3333] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {modal === 'add' ? 'Tạo chính sách' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ══ Delete Modal ══ */}
      {modal === 'delete' && selected && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-red-400/20 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5 bg-white dark:bg-[#0E0E10]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-white">Xoá chính sách giá</h3>
                <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">Hành động không thể hoàn tác</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-white/70">
              Xoá chính sách giá cho <span className="font-semibold text-gray-800 dark:text-white">{selected.vehicleTypeName}</span>?
            </p>
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <div className="flex gap-3">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-white/60 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">Hủy</button>
              <button onClick={handleDelete} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
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
