/**
 * Admin/Pricing.tsx
 * Manages Day/Night Block pricing (used for Booking)
 * Supports Pricing Policy Versioning from the AddPricingPolicyVersioning migration
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Pencil, Trash2, X,
  AlertTriangle, Loader2, RefreshCw,
  Sun, Moon, TrendingUp, Tag, Zap,
  CheckCircle2, Clock, GitBranch, History, Calendar,
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
import {
  getAllPolicies as getAllMonthlyPolicies,
  createMonthlyPassPolicy,
  updateMonthlyPassPolicy,
} from '../../services/subscriptionService';
import type { MonthlyPassPolicyResponse } from '../../services/subscriptionService';

const vnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

const emptyForm = {
  vehicleTypeId: '',
  blockDurationHours: '',
  dayBlockRate: '',
  nightBlockRate: '',
  nightStartHour: '',
  nightEndHour: '',
  dailyRate: '',
  overtimeMultiplier: '',
  monthlyPrice: '',
};

type PolicyForm = typeof emptyForm;
type ModalMode  = 'add' | 'edit' | 'delete' | 'history' | null;

// ── Group policies by vehicle type, get the active version + history list ──────────
interface PolicyGroup {
  vehicleTypeId: string;
  vehicleTypeName: string;
  active: PricingPolicyResponse | null;
  history: PricingPolicyResponse[];
  monthly: MonthlyPassPolicyResponse | null;
}

function groupPolicies(
  vehicleTypes: VehicleTypeResponse[],
  policies: PricingPolicyResponse[],
  monthlyPolicies: MonthlyPassPolicyResponse[]
): PolicyGroup[] {
  return vehicleTypes.map(vt => {
    const vtPolicies = policies
      .filter(p => p.vehicleTypeId === vt.id)
      .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
    
    const active = vtPolicies.find(p => p.isActive) || null;
    const history = vtPolicies.filter(p => p !== active);
    const monthly = monthlyPolicies.find(m => m.vehicleTypeId === vt.id && m.isActive) || null;
    
    return {
      vehicleTypeId: vt.id,
      vehicleTypeName: vt.name,
      active,
      history,
      monthly
    };
  });
}

export default function AdminPricing() {
  const { token } = useAuth();

  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeResponse[]>([]);
  const [policies, setPolicies]         = useState<PricingPolicyResponse[]>([]);
  const [monthlyPolicies, setMonthlyPolicies] = useState<MonthlyPassPolicyResponse[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [apiError, setApiError]         = useState('');

  const [modal, setModal]         = useState<ModalMode>(null);
  const [selected, setSelected]   = useState<PricingPolicyResponse | null>(null);
  const [selectedMonthly, setSelectedMonthly] = useState<MonthlyPassPolicyResponse | null>(null);
  const [historyGroup, setHistoryGroup] = useState<PolicyGroup | null>(null);
  const [form, setForm]           = useState<PolicyForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setApiError('');
    const errors: string[] = [];
    const [vts, allPolicies, allMonthly] = await Promise.all([
      getVehicleTypes().catch(() => { errors.push('vehicle types'); return [] as VehicleTypeResponse[]; }),
      getAllPolicies(token).catch(() => { errors.push('pricing policies'); return [] as PricingPolicyResponse[]; }),
      getAllMonthlyPolicies().catch(() => { errors.push('monthly pass'); return [] as MonthlyPassPolicyResponse[]; })
    ]);
    setVehicleTypes(vts);
    setPolicies(allPolicies);
    setMonthlyPolicies(allMonthly);
    if (errors.length) setApiError(`Failed to load: ${errors.join(', ')}.`);
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const groups = useMemo(() => groupPolicies(vehicleTypes, policies, monthlyPolicies), [vehicleTypes, policies, monthlyPolicies]);

  const closeModal = () => {
    setModal(null); setSelected(null); setSelectedMonthly(null); setHistoryGroup(null); setFormError(''); setSubmitting(false);
  };

  const openAdd = (group?: PolicyGroup) => {
    setForm({ 
      ...emptyForm, 
      vehicleTypeId: group ? group.vehicleTypeId : (vehicleTypes.length > 0 ? vehicleTypes[0].id : ''), 
      monthlyPrice: (group && group.monthly) ? String(group.monthly.monthlyPrice) : '' 
    });
    setSelectedMonthly(group ? group.monthly : null);
    setFormError('');
    setModal('add');
  };

  const openEdit = (group: PolicyGroup) => {
    const p = group.active!;
    setSelected(p);
    setSelectedMonthly(group.monthly);
    setForm({
      vehicleTypeId:      p.vehicleTypeId,
      blockDurationHours: String(p.blockDurationHours),
      dayBlockRate:       String(p.dayBlockRate),
      nightBlockRate:     String(p.nightBlockRate),
      nightStartHour:     String(p.nightStartHour),
      nightEndHour:       String(p.nightEndHour),
      dailyRate:          String(p.dailyRate),
      overtimeMultiplier: String(p.overtimeMultiplier),
      monthlyPrice:       group.monthly ? String(group.monthly.monthlyPrice) : '',
    });
    setFormError('');
    setModal('edit');
  };

  const parseNum = (val: string) => Number(val.replace(/,/g, '.'));

  const validate = (): string => {
    if (form.monthlyPrice !== '') {
      if (parseNum(form.monthlyPrice) < 0) return 'Monthly price must be >= 0.';
    }
    
    if (modal === 'add' && !form.vehicleTypeId) return 'Please select a vehicle type.';
    if (parseNum(form.blockDurationHours) <= 0) return 'Block duration must be > 0 hours.';
    if (parseNum(form.dayBlockRate) < 0) return 'Day block rate must be >= 0.';
    if (parseNum(form.nightBlockRate) < 0) return 'Night block rate must be >= 0.';
    if (parseNum(form.dailyRate) < 0) return 'Full-day rate must be >= 0.';
    
    const ot = parseNum(form.overtimeMultiplier);
    if (isNaN(ot) || ot <= 0) return 'Overtime multiplier must be > 0 (e.g. 1.5).';
    
    const ns = parseNum(form.nightStartHour);
    const ne = parseNum(form.nightEndHour);
    if (isNaN(ns) || ns < 0 || ns > 23) return 'Night start hour must be from 0-23.';
    if (isNaN(ne) || ne < 0 || ne > 23) return 'Night end hour must be from 0-23.';
    return '';
  };

  const buildPayload = () => ({
    blockPrice: 0,
    hourlyRate: 0,
    dailyMaxRate: 0,
    blockDurationHours: parseNum(form.blockDurationHours),
    dayBlockRate:       parseNum(form.dayBlockRate),
    nightBlockRate:     parseNum(form.nightBlockRate),
    nightStartHour:     parseNum(form.nightStartHour),
    nightEndHour:       parseNum(form.nightEndHour),
    dailyRate:          parseNum(form.dailyRate),
    overtimeMultiplier: parseNum(form.overtimeMultiplier),
  });

  const handleAdd = async () => {
    const err = validate();
    if (err) { setFormError(err); return; }
    if (!token) return;
    setSubmitting(true);
    try {
      const payload: CreatePricingPolicyRequest = { vehicleTypeId: form.vehicleTypeId, ...buildPayload() };
      const created = await createPolicy(payload);
      setPolicies(prev => [...prev, created]);
      
      if (form.monthlyPrice !== '') {
        const mp = parseNum(form.monthlyPrice);
        if (selectedMonthly) {
          const m = await updateMonthlyPassPolicy(selectedMonthly.id, { monthlyPrice: mp, isActive: true });
          setMonthlyPolicies(prev => prev.map(x => x.id === m.id ? m : x));
        } else {
          const m = await createMonthlyPassPolicy({ vehicleTypeId: form.vehicleTypeId, monthlyPrice: mp });
          setMonthlyPolicies(prev => [...prev, m]);
        }
      }
      closeModal();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'An error occurred.');
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
      const updated = await updatePolicy(selected.id, payload);
      setPolicies(prev => prev.map(p => p.id === selected.id ? updated : p));
      
      if (form.monthlyPrice !== '') {
        const mp = parseNum(form.monthlyPrice);
        if (selectedMonthly) {
          const m = await updateMonthlyPassPolicy(selectedMonthly.id, { monthlyPrice: mp, isActive: true });
          setMonthlyPolicies(prev => prev.map(x => x.id === m.id ? m : x));
        } else {
          const m = await createMonthlyPassPolicy({ vehicleTypeId: selected.vehicleTypeId, monthlyPrice: mp });
          setMonthlyPolicies(prev => [...prev, m]);
        }
      }
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
      await deletePolicy(selected.id);
      setPolicies(prev => prev.filter(p => p.id !== selected.id));
      closeModal();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'An error occurred.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
        <p className="text-sm text-white/40">Loading pricing...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Pricing &amp; Fee Policies</h2>
          <p className="text-sm text-white/40 mt-0.5">
            {groups.length} vehicle types · {policies.filter(p => p.isActive).length} active policies
          </p>
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
          <h3 className="text-base font-semibold text-white">Day/Night Block Pricing</h3>
          <p className="text-xs text-white/40 mt-0.5">Each update creates a new version, keeping history for accurate reporting</p>
        </div>
        <button
          onClick={() => openAdd()}
          disabled={vehicleTypes.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF4C4C] hover:bg-[#ff3333] text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Plus size={15} /> Add Policy
        </button>
      </div>

      {/* Policy Groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.length === 0 && (
          <p className="col-span-3 text-center py-12 text-white/30 text-sm">No pricing policies yet.</p>
        )}

        {groups.map(group => {
          const p = group.active;
          return (
            <div key={group.vehicleTypeId} className="glass-card p-5 rounded-2xl space-y-4 hover:border-white/20 transition-all">
              {/* Card header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Tag size={16} className="text-amber-500" />
                  </div>
                  <div>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold">
                      {group.vehicleTypeName}
                    </span>
                  </div>
                </div>

                {/* Version & Status badge */}
                <div className="flex items-center gap-1.5">
                  {p ? (
                    <>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
                        <CheckCircle2 size={10} />
                        Active
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-white/40">
                        <GitBranch size={10} />
                        v{p.version ?? 1}
                      </span>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-white/30">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {/* Effective date */}
              {p?.effectiveDate && (
                <div className="flex items-center gap-1.5 text-xs text-white/30">
                  <Clock size={11} />
                  Effective from: {new Date(p.effectiveDate).toLocaleDateString('vi-VN')}
                  {p.previousVersionId && (
                    <span className="ml-1 text-white/20">(has history)</span>
                  )}
                </div>
              )}

              {/* Block info */}
              {p && <p className="text-xs text-white/30">Block {p.blockDurationHours}h · Night {p.nightStartHour}h-{p.nightEndHour}h</p>}

              {/* Rate rows */}
              <div className="space-y-2.5">
                {[
                  ...(p ? [
                    { icon: Sun,        label: 'Day / block',       value: vnd(p.dayBlockRate),        color: '#F59E0B' },
                    { icon: Moon,       label: 'Night / block',     value: vnd(p.nightBlockRate),      color: '#A78BFA' },
                    { icon: TrendingUp, label: 'Full-day rate',     value: vnd(p.dailyRate),           color: '#F87171' },
                    { icon: Zap,        label: 'Overtime multiplier', value: `×${p.overtimeMultiplier}`, color: '#34D399' }
                  ] : []),
                  { icon: Calendar,   label: 'Monthly Pass',      value: group.monthly ? vnd(group.monthly.monthlyPrice) : 'Not set', color: '#EC4899' },
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

              {/* Footer meta */}
              {p && (
                <div className="text-xs text-white/30 pt-1 border-t border-white/5">
                  Created: {new Date(p.createdAt).toLocaleDateString('vi-VN')}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-white/5">
                <button
                  onClick={() => p ? openEdit(group) : openAdd(group)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-all"
                >
                  <Pencil size={13} /> {p ? 'Update Policy' : 'Configure Policy'}
                </button>
                {group.history.length > 0 && (
                  <button
                    onClick={() => { setHistoryGroup(group); setModal('history'); }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 text-white/50 hover:text-white/80 hover:bg-white/10 transition-all"
                    title={`${group.history.length} previous versions`}
                  >
                    <History size={13} />
                    {group.history.length}
                  </button>
                )}
                {p && (
                  <button
                    onClick={() => { setSelected(p); setModal('delete'); }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ══ Add / Edit Modal ══ */}
      {(modal === 'add' || modal === 'edit') && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-md shadow-2xl bg-white dark:bg-[#0E0E10] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                  {modal === 'add' ? 'Configure Policy' : `Update Price · ${selected?.vehicleTypeName}`}
                </h3>
                {modal === 'edit' && (
                  <p className="text-xs text-white/40 mt-0.5 flex items-center gap-1">
                    <GitBranch size={10} />
                    Will create new version v{(selected?.version ?? 0) + 1} — history is preserved
                  </p>
                )}
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-xl text-gray-400 dark:text-white/40 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">

              {modal === 'add' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">Vehicle Type <span className="text-red-400">*</span></label>
                  <select
                    value={form.vehicleTypeId}
                    onChange={e => setForm(f => ({ ...f, vehicleTypeId: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-[#FF4C4C]/50 transition-colors appearance-none"
                  >
                    <option value="">-- Select vehicle type --</option>
                    {vehicleTypes.map(vt => (
                      <option key={vt.id} value={vt.id}>{vt.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">Block duration (hours)</label>
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
                    <Sun size={11} className="inline mr-1 text-amber-400" />Day block rate (VND)
                  </label>
                  <input
                    type="number" min={0} placeholder="e.g. 30000"
                    value={form.dayBlockRate}
                    onChange={e => setForm(p => ({ ...p, dayBlockRate: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">
                    <Moon size={11} className="inline mr-1 text-violet-400" />Night block rate (VND)
                  </label>
                  <input
                    type="number" min={0} placeholder="e.g. 20000"
                    value={form.nightBlockRate}
                    onChange={e => setForm(p => ({ ...p, nightBlockRate: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">
                    <Moon size={11} className="inline mr-1 text-violet-400" />Night start hour
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
                    <Sun size={11} className="inline mr-1 text-amber-400" />Night end hour
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
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">Full-day rate (VND)</label>
                  <input
                    type="number" min={0} placeholder="e.g. 150000"
                    value={form.dailyRate}
                    onChange={e => setForm(p => ({ ...p, dailyRate: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">
                    <Zap size={11} className="inline mr-1 text-emerald-400" />Overtime multiplier
                  </label>
                  <input
                    type="number" min={1} step={0.1} placeholder="1.5"
                    value={form.overtimeMultiplier}
                    onChange={e => setForm(p => ({ ...p, overtimeMultiplier: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2 mt-4 border-t border-gray-200 dark:border-white/10">
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5 flex items-center gap-1.5">
                  <Calendar size={13} className="text-[#EC4899]" />
                  Monthly Pass Price (VND) <span className="text-gray-400 dark:text-white/30 font-normal ml-auto">(Leave empty to skip)</span>
                </label>
                <input
                  type="number" min={0} placeholder="e.g. 150000"
                  value={form.monthlyPrice}
                  onChange={e => setForm(f => ({ ...f, monthlyPrice: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors appearance-none"
                />
              </div>

              {formError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-400/10 border border-red-400/20 rounded-xl">
                  <AlertTriangle size={13} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{formError}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex justify-end gap-3 shrink-0">
              <button onClick={closeModal} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-white/60 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
              <button
                onClick={modal === 'add' ? handleAdd : handleEdit}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black bg-[#FF4C4C] hover:bg-[#ff3333] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {modal === 'add' ? 'Create Policy' : 'Save & Create New Version'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ══ History Modal ══ */}
      {modal === 'history' && historyGroup && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl bg-[#0E0E10] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <History size={16} className="text-white/40" />
                  Version History · {historyGroup.vehicleTypeName}
                </h3>
                <p className="text-xs text-white/30 mt-0.5">{historyGroup.history.length} previous versions</p>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4 space-y-3">
              {historyGroup.history.map(p => (
                <div key={p.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-white/40">
                        <GitBranch size={10} /> v{p.version ?? '?'}
                      </span>
                      <span className="text-xs text-white/30">
                        {p.effectiveDate ? new Date(p.effectiveDate).toLocaleDateString('vi-VN') : '—'}
                      </span>
                    </div>
                    <span className="text-xs text-white/20">Created: {new Date(p.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-white/[0.03] rounded-lg">
                      <span className="text-white/40 flex items-center gap-1"><Sun size={10} className="text-amber-400" /> Day</span>
                      <span className="text-white/70 font-medium">{vnd(p.dayBlockRate)}</span>
                    </div>
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-white/[0.03] rounded-lg">
                      <span className="text-white/40 flex items-center gap-1"><Moon size={10} className="text-violet-400" /> Night</span>
                      <span className="text-white/70 font-medium">{vnd(p.nightBlockRate)}</span>
                    </div>
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-white/[0.03] rounded-lg">
                      <span className="text-white/40 flex items-center gap-1"><TrendingUp size={10} className="text-red-400" /> Full day</span>
                      <span className="text-white/70 font-medium">{vnd(p.dailyRate)}</span>
                    </div>
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-white/[0.03] rounded-lg">
                      <span className="text-white/40 flex items-center gap-1"><Zap size={10} className="text-emerald-400" /> Overtime</span>
                      <span className="text-white/70 font-medium">×{p.overtimeMultiplier}</span>
                    </div>
                  </div>
                </div>
              ))}
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
                <h3 className="text-base font-semibold text-gray-800 dark:text-white">Delete Pricing Policy</h3>
                <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-white/70">
              Delete policy <span className="font-semibold text-white">v{selected.version ?? '?'}</span> for <span className="font-semibold text-gray-800 dark:text-white">{selected.vehicleTypeName}</span>?
            </p>
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <div className="flex gap-3">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-white/60 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
