/**
 * Manager/Pricing.tsx
 * Nhánh: Feature/ManagePricing-Manager
 * Quản lý bảng giá và chính sách tính phí gửi xe
 *
 * Tính năng:
 *  - Tab 1: Chính sách giá (PricingPolicy) — giá theo block/giờ/ngày-tối-đa
 *  - Tab 2: Bảng giá vé (PriceSetting) — giá ngày/đêm, giờ bắt đầu
 *  - Thêm / Sửa / Xoá từng loại cấu hình
 *  - Hiển thị loại xe nào chưa có chính sách để nhắc nhở
 */

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Plus, Pencil, Trash2, X,
  AlertTriangle, Loader2, RefreshCw,
  Sun, Moon, Clock, TrendingUp, Tag, Info,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getVehicleTypes } from '../../services/buildingsService';
import type { VehicleTypeResponse } from '../../services/buildingsService';
import {
  getAllPolicies, createPolicy, updatePolicy, deletePolicy,
  getAllPriceSettings, createPriceSetting, updatePriceSetting, deletePriceSetting,
} from '../../services/pricingService';
import type {
  PricingPolicyResponse, PriceSettingResponse,
  CreatePricingPolicyRequest, UpdatePricingPolicyRequest,
  CreatePriceSettingRequest, UpdatePriceSettingRequest,
} from '../../services/pricingService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const vnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

// ─── Empty forms ──────────────────────────────────────────────────────────────

const emptyPolicyForm = {
  vehicleTypeId: '',
  blockPrice: '',
  blockMinutes: '30',
  hourlyRate: '',
  dailyMaxRate: '',
};

const emptySettingForm = {
  vehicleTypeId: '',
  dayPassPrice: '',
  nightPassPrice: '',
  dailyMaxPrice: '',
  dayStartHour: '6',
  nightStartHour: '18',
};

type PolicyForm   = typeof emptyPolicyForm;
type SettingForm  = typeof emptySettingForm;
type ActiveTab    = 'policy' | 'setting';
type PolicyModal  = 'add' | 'edit' | 'delete' | null;
type SettingModal = 'add' | 'edit' | 'delete' | null;

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ManagerPricing() {
  const { token } = useAuth();

  const [activeTab, setActiveTab]       = useState<ActiveTab>('policy');
  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeResponse[]>([]);
  const [policies, setPolicies]         = useState<PricingPolicyResponse[]>([]);
  const [settings, setSettings]         = useState<PriceSettingResponse[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [apiError, setApiError]         = useState('');

  // Policy modal
  const [policyModal, setPolicyModal]   = useState<PolicyModal>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<PricingPolicyResponse | null>(null);
  const [policyForm, setPolicyForm]     = useState<PolicyForm>(emptyPolicyForm);
  const [policyError, setPolicyError]   = useState('');
  const [policySubmitting, setPolicySubmitting] = useState(false);

  // Setting modal
  const [settingModal, setSettingModal]   = useState<SettingModal>(null);
  const [selectedSetting, setSelectedSetting] = useState<PriceSettingResponse | null>(null);
  const [settingForm, setSettingForm]     = useState<SettingForm>(emptySettingForm);
  const [settingError, setSettingError]   = useState('');
  const [settingSubmitting, setSettingSubmitting] = useState(false);

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setApiError('');
    try {
      const [vts, allPolicies, allSettings] = await Promise.all([
        getVehicleTypes(),
        getAllPolicies(),
        getAllPriceSettings(token),
      ]);
      setVehicleTypes(vts);
      setPolicies(allPolicies);
      setSettings(allSettings);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Vehicle types without policy / setting ────────────────────────────────

  const vtWithoutPolicy  = vehicleTypes.filter(vt => !policies.find(p => p.vehicleTypeId === vt.id));
  const vtWithoutSetting = vehicleTypes.filter(vt => !settings.find(s => s.vehicleTypeId === vt.id));

  // ─── Policy CRUD ───────────────────────────────────────────────────────────

  const closePolicyModal = () => {
    setPolicyModal(null); setSelectedPolicy(null); setPolicyError(''); setPolicySubmitting(false);
  };

  const openAddPolicy = () => {
    const firstVt = vtWithoutPolicy[0];
    setPolicyForm({ ...emptyPolicyForm, vehicleTypeId: firstVt?.id ?? '' });
    setPolicyError('');
    setPolicyModal('add');
  };

  const openEditPolicy = (p: PricingPolicyResponse) => {
    setSelectedPolicy(p);
    setPolicyForm({
      vehicleTypeId: p.vehicleTypeId,
      blockPrice: String(p.blockPrice),
      blockMinutes: String(p.blockMinutes),
      hourlyRate: String(p.hourlyRate),
      dailyMaxRate: String(p.dailyMaxRate),
    });
    setPolicyError('');
    setPolicyModal('edit');
  };

  const validatePolicyForm = (): string => {
    if (!policyForm.vehicleTypeId) return 'Vui lòng chọn loại xe.';
    if (!policyForm.blockPrice || Number(policyForm.blockPrice) < 0) return 'Giá block phải >= 0.';
    if (!policyForm.blockMinutes || Number(policyForm.blockMinutes) <= 0) return 'Block phải > 0 phút.';
    if (!policyForm.hourlyRate || Number(policyForm.hourlyRate) < 0) return 'Giá giờ phải >= 0.';
    if (!policyForm.dailyMaxRate || Number(policyForm.dailyMaxRate) < 0) return 'Giá ngày tối đa phải >= 0.';
    return '';
  };

  const handleAddPolicy = async () => {
    const err = validatePolicyForm();
    if (err) { setPolicyError(err); return; }
    if (!token) return;
    setPolicySubmitting(true);
    try {
      const payload: CreatePricingPolicyRequest = {
        vehicleTypeId: policyForm.vehicleTypeId,
        blockPrice:    Number(policyForm.blockPrice),
        blockMinutes:  Number(policyForm.blockMinutes),
        hourlyRate:    Number(policyForm.hourlyRate),
        dailyMaxRate:  Number(policyForm.dailyMaxRate),
      };
      const created = await createPolicy(payload, token);
      setPolicies(prev => [...prev, created]);
      closePolicyModal();
    } catch (e) {
      setPolicyError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
      setPolicySubmitting(false);
    }
  };

  const handleEditPolicy = async () => {
    const err = validatePolicyForm();
    if (err) { setPolicyError(err); return; }
    if (!selectedPolicy || !token) return;
    setPolicySubmitting(true);
    try {
      const payload: UpdatePricingPolicyRequest = {
        blockPrice:   Number(policyForm.blockPrice),
        blockMinutes: Number(policyForm.blockMinutes),
        hourlyRate:   Number(policyForm.hourlyRate),
        dailyMaxRate: Number(policyForm.dailyMaxRate),
      };
      const updated = await updatePolicy(selectedPolicy.id, payload, token);
      setPolicies(prev => prev.map(p => p.id === selectedPolicy.id ? updated : p));
      closePolicyModal();
    } catch (e) {
      setPolicyError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
      setPolicySubmitting(false);
    }
  };

  const handleDeletePolicy = async () => {
    if (!selectedPolicy || !token) return;
    setPolicySubmitting(true);
    try {
      await deletePolicy(selectedPolicy.id, token);
      setPolicies(prev => prev.filter(p => p.id !== selectedPolicy.id));
      closePolicyModal();
    } catch (e) {
      setPolicyError(e instanceof Error ? e.message : 'Không thể xoá.');
      setPolicySubmitting(false);
    }
  };

  // ─── PriceSetting CRUD ─────────────────────────────────────────────────────

  const closeSettingModal = () => {
    setSettingModal(null); setSelectedSetting(null); setSettingError(''); setSettingSubmitting(false);
  };

  const openAddSetting = () => {
    const firstVt = vtWithoutSetting[0];
    setSettingForm({ ...emptySettingForm, vehicleTypeId: firstVt?.id ?? '' });
    setSettingError('');
    setSettingModal('add');
  };

  const openEditSetting = (s: PriceSettingResponse) => {
    setSelectedSetting(s);
    setSettingForm({
      vehicleTypeId:  s.vehicleTypeId,
      dayPassPrice:   String(s.dayPassPrice),
      nightPassPrice: String(s.nightPassPrice),
      dailyMaxPrice:  String(s.dailyMaxPrice),
      dayStartHour:   String(s.dayStartHour),
      nightStartHour: String(s.nightStartHour),
    });
    setSettingError('');
    setSettingModal('edit');
  };

  const validateSettingForm = (): string => {
    if (!settingForm.vehicleTypeId) return 'Vui lòng chọn loại xe.';
    if (!settingForm.dayPassPrice   || Number(settingForm.dayPassPrice) < 0)   return 'Giá ngày >= 0.';
    if (!settingForm.nightPassPrice || Number(settingForm.nightPassPrice) < 0) return 'Giá đêm >= 0.';
    if (!settingForm.dailyMaxPrice  || Number(settingForm.dailyMaxPrice) < 0)  return 'Giá trần ngày >= 0.';
    const d = Number(settingForm.dayStartHour);
    const n = Number(settingForm.nightStartHour);
    if (isNaN(d) || d < 0 || d > 23) return 'Giờ ban ngày phải từ 0–23.';
    if (isNaN(n) || n < 0 || n > 23) return 'Giờ ban đêm phải từ 0–23.';
    return '';
  };

  const handleAddSetting = async () => {
    const err = validateSettingForm();
    if (err) { setSettingError(err); return; }
    if (!token) return;
    setSettingSubmitting(true);
    try {
      const payload: CreatePriceSettingRequest = {
        vehicleTypeId:  settingForm.vehicleTypeId,
        dayPassPrice:   Number(settingForm.dayPassPrice),
        nightPassPrice: Number(settingForm.nightPassPrice),
        dailyMaxPrice:  Number(settingForm.dailyMaxPrice),
        dayStartHour:   Number(settingForm.dayStartHour),
        nightStartHour: Number(settingForm.nightStartHour),
      };
      const created = await createPriceSetting(payload, token);
      setSettings(prev => [...prev, created]);
      closeSettingModal();
    } catch (e) {
      setSettingError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
      setSettingSubmitting(false);
    }
  };

  const handleEditSetting = async () => {
    const err = validateSettingForm();
    if (err) { setSettingError(err); return; }
    if (!selectedSetting || !token) return;
    setSettingSubmitting(true);
    try {
      const payload: UpdatePriceSettingRequest = {
        dayPassPrice:   Number(settingForm.dayPassPrice),
        nightPassPrice: Number(settingForm.nightPassPrice),
        dailyMaxPrice:  Number(settingForm.dailyMaxPrice),
        dayStartHour:   Number(settingForm.dayStartHour),
        nightStartHour: Number(settingForm.nightStartHour),
      };
      const updated = await updatePriceSetting(selectedSetting.vehicleTypeId, payload, token);
      setSettings(prev => prev.map(s => s.id === selectedSetting.id ? updated : s));
      closeSettingModal();
    } catch (e) {
      setSettingError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
      setSettingSubmitting(false);
    }
  };

  const handleDeleteSetting = async () => {
    if (!selectedSetting || !token) return;
    setSettingSubmitting(true);
    try {
      await deletePriceSetting(selectedSetting.vehicleTypeId, token);
      setSettings(prev => prev.filter(s => s.id !== selectedSetting.id));
      closeSettingModal();
    } catch (e) {
      setSettingError(e instanceof Error ? e.message : 'Không thể xoá.');
      setSettingSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="text-orange-500 animate-spin" />
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
          <p className="text-sm text-white/40 mt-0.5">
            {policies.length} chính sách · {settings.length} bảng giá vé
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

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit">
        {([
          { key: 'policy',  label: 'Chính sách tính giá', icon: Clock },
          { key: 'setting', label: 'Bảng giá vé ngày/đêm', icon: Tag },
        ] as { key: ActiveTab; label: string; icon: React.ElementType }[]).map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.key
                  ? 'bg-orange-500 text-black'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ══ TAB 1: Pricing Policy ══ */}
      {activeTab === 'policy' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Chính sách tính giá theo block/giờ</h3>
              <p className="text-xs text-white/40 mt-0.5">Cấu hình giá tính theo từng đơn vị thời gian cho mỗi loại xe</p>
            </div>
            <button
              onClick={openAddPolicy}
              disabled={vtWithoutPolicy.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
              title={vtWithoutPolicy.length === 0 ? 'Tất cả loại xe đã có chính sách' : ''}
            >
              <Plus size={15} /> Thêm chính sách
            </button>
          </div>

          {/* Warning: vehicle types without policy */}
          {vtWithoutPolicy.length > 0 && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-400/10 border border-amber-400/20 rounded-xl">
              <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400/80">
                Các loại xe chưa có chính sách giá: <span className="font-semibold text-amber-400">{vtWithoutPolicy.map(v => v.name).join(', ')}</span>
              </p>
            </div>
          )}

          {/* Policy cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {policies.length === 0 && (
              <p className="col-span-3 text-center py-12 text-white/30 text-sm">Chưa có chính sách giá nào.</p>
            )}
            {policies.map(p => (
              <div key={p.id} className="glass-card p-5 rounded-2xl space-y-4 hover:border-white/20 transition-all">
                {/* Vehicle type badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
                      <DollarSign size={16} className="text-orange-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{p.vehicleTypeName}</p>
                      <p className="text-xs text-white/40">Chính sách tính phí</p>
                    </div>
                  </div>
                </div>

                {/* Price rows */}
                <div className="space-y-2.5">
                  {[
                    { icon: Clock,     label: `Mỗi ${p.blockMinutes} phút`, value: vnd(p.blockPrice),    color: '#F97316' },
                    { icon: TrendingUp, label: 'Theo giờ',                  value: vnd(p.hourlyRate),    color: '#F59E0B' },
                    { icon: Sun,       label: 'Tối đa / ngày',              value: vnd(p.dailyMaxRate),  color: '#F59E0B' },
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

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditPolicy(p)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-orange-500/70 hover:text-orange-500 hover:bg-orange-500/10 transition-all"
                  >
                    <Pencil size={13} /> Sửa
                  </button>
                  <button
                    onClick={() => { setSelectedPolicy(p); setPolicyModal('delete'); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all"
                  >
                    <Trash2 size={13} /> Xoá
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ TAB 2: Price Setting ══ */}
      {activeTab === 'setting' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Bảng giá vé ngày / đêm</h3>
              <p className="text-xs text-white/40 mt-0.5">Cấu hình giá theo khung giờ ban ngày và ban đêm</p>
            </div>
            <button
              onClick={openAddSetting}
              disabled={vtWithoutSetting.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
              title={vtWithoutSetting.length === 0 ? 'Tất cả loại xe đã có bảng giá' : ''}
            >
              <Plus size={15} /> Thêm bảng giá
            </button>
          </div>

          {vtWithoutSetting.length > 0 && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-400/10 border border-amber-400/20 rounded-xl">
              <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400/80">
                Chưa có bảng giá: <span className="font-semibold text-amber-400">{vtWithoutSetting.map(v => v.name).join(', ')}</span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {settings.length === 0 && (
              <p className="col-span-3 text-center py-12 text-white/30 text-sm">Chưa có bảng giá nào.</p>
            )}
            {settings.map(s => (
              <div key={s.id} className="glass-card p-5 rounded-2xl space-y-4 hover:border-white/20 transition-all">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Tag size={16} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{s.vehicleTypeName}</p>
                    <p className="text-xs text-white/40">Giờ ngày: {s.dayStartHour}h–{s.nightStartHour}h · Giờ đêm: {s.nightStartHour}h–{s.dayStartHour}h</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {[
                    { icon: Sun,   label: `Ban ngày (${s.dayStartHour}h–${s.nightStartHour}h)`,   value: vnd(s.dayPassPrice),   color: '#F59E0B' },
                    { icon: Moon,  label: `Ban đêm (${s.nightStartHour}h–${s.dayStartHour}h)`,    value: vnd(s.nightPassPrice), color: '#A78BFA' },
                    { icon: TrendingUp, label: 'Giá trần cả ngày',                                 value: vnd(s.dailyMaxPrice),  color: '#F87171' },
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

                {s.updatedByName && (
                  <p className="text-xs text-white/30 border-t border-white/5 pt-2">
                    Cập nhật bởi: <span className="text-white/50">{s.updatedByName}</span>
                    {s.updatedAt && ` · ${new Date(s.updatedAt).toLocaleDateString('vi-VN')}`}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => openEditSetting(s)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-amber-500/70 hover:text-amber-500 hover:bg-amber-500/10 transition-all"
                  >
                    <Pencil size={13} /> Sửa
                  </button>
                  <button
                    onClick={() => { setSelectedSetting(s); setSettingModal('delete'); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all"
                  >
                    <Trash2 size={13} /> Xoá
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════ POLICY MODALS ══════════ */}

      {/* Add/Edit Policy */}
      {(policyModal === 'add' || policyModal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-base font-semibold text-white">
                {policyModal === 'add' ? 'Thêm chính sách giá' : `Sửa chính sách · ${selectedPolicy?.vehicleTypeName}`}
              </h3>
              <button onClick={closePolicyModal} className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {policyModal === 'add' && (
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Loại xe <span className="text-red-400">*</span></label>
                  <select
                    value={policyForm.vehicleTypeId}
                    onChange={e => setPolicyForm(p => ({ ...p, vehicleTypeId: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors appearance-none"
                  >
                    <option value="" className="bg-[#121214]">-- Chọn loại xe --</option>
                    {vtWithoutPolicy.map(vt => (
                      <option key={vt.id} value={vt.id} className="bg-[#121214]">{vt.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {[
                { key: 'blockMinutes' as const, label: 'Thời lượng block (phút)', placeholder: 'VD: 30', type: 'number' },
                { key: 'blockPrice'   as const, label: 'Giá mỗi block (đ)',       placeholder: 'VD: 5000', type: 'number' },
                { key: 'hourlyRate'   as const, label: 'Giá theo giờ (đ)',        placeholder: 'VD: 10000', type: 'number' },
                { key: 'dailyMaxRate' as const, label: 'Giá tối đa / ngày (đ)',   placeholder: 'VD: 80000', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    min={0}
                    placeholder={f.placeholder}
                    value={policyForm[f.key]}
                    onChange={e => setPolicyForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>
              ))}

              {policyError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-400/10 border border-red-400/20 rounded-xl">
                  <AlertTriangle size={13} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{policyError}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
              <button onClick={closePolicyModal} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors">Hủy</button>
              <button
                onClick={policyModal === 'add' ? handleAddPolicy : handleEditPolicy}
                disabled={policySubmitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {policySubmitting && <Loader2 size={14} className="animate-spin" />}
                {policyModal === 'add' ? 'Tạo chính sách' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Policy */}
      {policyModal === 'delete' && selectedPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#121214] border border-red-400/20 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Xoá chính sách giá</h3>
                <p className="text-xs text-white/40 mt-0.5">Hành động không thể hoàn tác</p>
              </div>
            </div>
            <p className="text-sm text-white/70">Xoá chính sách giá cho <span className="font-semibold text-white">{selectedPolicy.vehicleTypeName}</span>?</p>
            {policyError && <p className="text-xs text-red-400">{policyError}</p>}
            <div className="flex gap-3">
              <button onClick={closePolicyModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors">Hủy</button>
              <button onClick={handleDeletePolicy} disabled={policySubmitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                {policySubmitting && <Loader2 size={14} className="animate-spin" />}
                Xác nhận xoá
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ SETTING MODALS ══════════ */}

      {/* Add/Edit Setting */}
      {(settingModal === 'add' || settingModal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-base font-semibold text-white">
                {settingModal === 'add' ? 'Thêm bảng giá vé' : `Sửa bảng giá · ${selectedSetting?.vehicleTypeName}`}
              </h3>
              <button onClick={closeSettingModal} className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {settingModal === 'add' && (
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Loại xe <span className="text-red-400">*</span></label>
                  <select
                    value={settingForm.vehicleTypeId}
                    onChange={e => setSettingForm(p => ({ ...p, vehicleTypeId: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors appearance-none"
                  >
                    <option value="" className="bg-[#121214]">-- Chọn loại xe --</option>
                    {vtWithoutSetting.map(vt => (
                      <option key={vt.id} value={vt.id} className="bg-[#121214]">{vt.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">
                    <Sun size={11} className="inline mr-1 text-amber-400" />Giờ bắt đầu ngày
                  </label>
                  <input type="number" min={0} max={23} placeholder="6"
                    value={settingForm.dayStartHour}
                    onChange={e => setSettingForm(p => ({ ...p, dayStartHour: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">
                    <Moon size={11} className="inline mr-1 text-violet-400" />Giờ bắt đầu đêm
                  </label>
                  <input type="number" min={0} max={23} placeholder="18"
                    value={settingForm.nightStartHour}
                    onChange={e => setSettingForm(p => ({ ...p, nightStartHour: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>
              </div>

              {[
                { key: 'dayPassPrice'   as const, label: 'Giá giờ ban ngày (đ)',  placeholder: 'VD: 10000', icon: Sun,       color: 'text-amber-400' },
                { key: 'nightPassPrice' as const, label: 'Giá giờ ban đêm (đ)',  placeholder: 'VD: 7000',  icon: Moon,      color: 'text-violet-400' },
                { key: 'dailyMaxPrice'  as const, label: 'Giá trần cả ngày (đ)', placeholder: 'VD: 80000', icon: TrendingUp, color: 'text-red-400' },
              ].map(f => {
                const Icon = f.icon;
                return (
                  <div key={f.key}>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-white/50 mb-1.5">
                      <Icon size={11} className={f.color} />
                      {f.label}
                    </label>
                    <input type="number" min={0} placeholder={f.placeholder}
                      value={settingForm[f.key]}
                      onChange={e => setSettingForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                    />
                  </div>
                );
              })}

              {settingError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-400/10 border border-red-400/20 rounded-xl">
                  <AlertTriangle size={13} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{settingError}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
              <button onClick={closeSettingModal} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors">Hủy</button>
              <button
                onClick={settingModal === 'add' ? handleAddSetting : handleEditSetting}
                disabled={settingSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {settingSubmitting && <Loader2 size={14} className="animate-spin" />}
                {settingModal === 'add' ? 'Tạo bảng giá' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Setting */}
      {settingModal === 'delete' && selectedSetting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#121214] border border-red-400/20 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Xoá bảng giá</h3>
                <p className="text-xs text-white/40 mt-0.5">Hành động không thể hoàn tác</p>
              </div>
            </div>
            <p className="text-sm text-white/70">Xoá bảng giá vé cho <span className="font-semibold text-white">{selectedSetting.vehicleTypeName}</span>?</p>
            {settingError && <p className="text-xs text-red-400">{settingError}</p>}
            <div className="flex gap-3">
              <button onClick={closeSettingModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors">Hủy</button>
              <button onClick={handleDeleteSetting} disabled={settingSubmitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                {settingSubmitting && <Loader2 size={14} className="animate-spin" />}
                Xác nhận xoá
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
