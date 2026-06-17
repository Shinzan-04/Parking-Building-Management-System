/**
 * Admin/Settings.tsx
 * Nhánh: Feature/AdminReports-Settings
 * Cài đặt hệ thống Admin
 *
 * Tính năng:
 *  - Thông tin hệ thống (tên bãi, địa chỉ, liên hệ)
 *  - Thông tin kỹ thuật (phiên bản, môi trường, DB, API URL)
 *  - Tùy chọn hiển thị (giờ làm việc, đơn vị tiền tệ)
 *  - Bảo mật (reset session, thông tin JWT)
 *  - Lưu vào localStorage để persist (do BE chưa có settings endpoint)
 */

import { useState, useEffect } from 'react';
import {
  Settings, Save, Building2, Phone, Mail, Globe,
  Clock, DollarSign, Shield, Server, RefreshCw,
  CheckCircle2, Info, Loader2, Key, Database,
  AlertTriangle, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

// ─── Types & defaults ─────────────────────────────────────────────────────────

interface SystemSettings {
  parkingName:    string;
  address:        string;
  phone:          string;
  email:          string;
  website:        string;
  openingHour:    number;
  closingHour:    number;
  currency:       string;
  timezone:       string;
  maxSessionHours:number;
}

const DEFAULTS: SystemSettings = {
  parkingName:    'ParkingSystem Vietnam',
  address:        '123 Đường Lê Lợi, Quận 1, TP.HCM',
  phone:          '028 1234 5678',
  email:          'admin@parkingsystem.vn',
  website:        'https://parkingsystem.vn',
  openingHour:    6,
  closingHour:    23,
  currency:       'VND',
  timezone:       'Asia/Ho_Chi_Minh',
  maxSessionHours:24,
};

const STORAGE_KEY = 'sp_admin_settings';

function loadSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children, accent = '#F59E0B' }: {
  title: string; icon: React.ElementType; children: React.ReactNode; accent?: string;
}) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${accent}18` }}>
          <Icon size={16} style={{ color: accent }} />
        </div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text' }: {
  value: string | number; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#F59E0B]/50 transition-colors"
    />
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/50">{label}</span>
      <span className={`text-xs font-medium text-white ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminSettings() {
  const { token, user } = useAuth();

  const [settings, setSettings]   = useState<SystemSettings>(loadSettings);
  const [saving,   setSaving]      = useState(false);
  const [saved,    setSaved]       = useState(false);
  const [apiUrl,   setApiUrl]      = useState(import.meta.env.VITE_API_URL ?? 'http://localhost:5237');

  const set = (key: keyof SystemSettings) => (value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: typeof prev[key] === 'number' ? Number(value) : value,
    }));
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 600);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULTS });
    localStorage.removeItem(STORAGE_KEY);
  };

  // System info
  const buildTime = import.meta.env.VITE_BUILD_TIME ?? new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Cài đặt hệ thống</h2>
          <p className="text-sm text-white/40 mt-0.5">Cấu hình thông tin và tùy chọn hệ thống</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/50 bg-white/5 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2">
            <RefreshCw size={14} /> Reset
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-[#F59E0B] to-[#F97316] hover:opacity-90 transition-opacity disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saving ? 'Đang lưu...' : saved ? 'Đã lưu!' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#F97316]/10 border border-[#F97316]/20 rounded-xl">
          <CheckCircle2 size={15} className="text-[#F97316] shrink-0" />
          <p className="text-sm text-[#F97316]">Đã lưu cài đặt thành công vào localStorage.</p>
        </div>
      )}

      {/* Info notice */}
      <div className="flex items-start gap-2.5 px-4 py-3 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl">
        <Info size={14} className="text-[#F59E0B] shrink-0 mt-0.5" />
        <p className="text-xs text-[#F59E0B]/80">
          Các cài đặt này được lưu cục bộ trên trình duyệt. Để cấu hình backend, vui lòng chỉnh sửa file <span className="font-mono font-semibold">.env</span> trên server.
        </p>
      </div>

      {/* Parking Info */}
      <SectionCard title="Thông tin bãi đỗ xe" icon={Building2} accent="#F97316">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Tên bãi đỗ xe">
            <TextInput value={settings.parkingName} onChange={set('parkingName')} placeholder="Tên hệ thống" />
          </Field>
          <Field label="Website">
            <TextInput value={settings.website} onChange={set('website')} placeholder="https://..." />
          </Field>
        </div>
        <Field label="Địa chỉ">
          <TextInput value={settings.address} onChange={set('address')} placeholder="Địa chỉ đầy đủ" />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Số điện thoại">
            <div className="relative">
              <Phone size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={settings.phone} onChange={e => set('phone')(e.target.value)} placeholder="028 ..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#F97316]/50 transition-colors" />
            </div>
          </Field>
          <Field label="Email liên hệ">
            <div className="relative">
              <Mail size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input type="email" value={settings.email} onChange={e => set('email')(e.target.value)} placeholder="admin@..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#F97316]/50 transition-colors" />
            </div>
          </Field>
        </div>
      </SectionCard>

      {/* Operating Hours */}
      <SectionCard title="Giờ hoạt động & Đơn vị" icon={Clock} accent="#F59E0B">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Giờ mở cửa (h)">
            <TextInput type="number" value={settings.openingHour} onChange={set('openingHour')} placeholder="6" />
          </Field>
          <Field label="Giờ đóng cửa (h)">
            <TextInput type="number" value={settings.closingHour} onChange={set('closingHour')} placeholder="23" />
          </Field>
          <Field label="Giờ tối đa / phiên">
            <TextInput type="number" value={settings.maxSessionHours} onChange={set('maxSessionHours')} placeholder="24" />
          </Field>
          <Field label="Đơn vị tiền tệ">
            <select value={settings.currency}
              onChange={e => set('currency')(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#F59E0B]/50 transition-colors appearance-none">
              {['VND', 'USD', 'EUR'].map(c => (
                <option key={c} value={c} className="bg-[#121214]">{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Múi giờ">
          <select value={settings.timezone}
            onChange={e => set('timezone')(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#F59E0B]/50 transition-colors appearance-none">
            {['Asia/Ho_Chi_Minh', 'UTC', 'Asia/Bangkok', 'Asia/Singapore'].map(tz => (
              <option key={tz} value={tz} className="bg-[#121214]">{tz}</option>
            ))}
          </select>
        </Field>
      </SectionCard>

      {/* Technical info */}
      <SectionCard title="Thông tin kỹ thuật" icon={Server} accent="#A78BFA">
        <div className="bg-white/[0.03] rounded-xl divide-y divide-white/5">
          <InfoRow label="Frontend Framework"  value="React 18 + TypeScript + Vite" />
          <InfoRow label="UI Framework"        value="Tailwind CSS + Lucide Icons" />
          <InfoRow label="Backend API URL"     value={apiUrl} mono />
          <InfoRow label="Môi trường"          value={import.meta.env.MODE === 'production' ? 'Production' : 'Development'} />
          <InfoRow label="Build ngày"          value={buildTime} mono />
          <InfoRow label="Database"            value="PostgreSQL + Entity Framework Core" />
        </div>

        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">API URL (hiện tại)</label>
          <div className="relative">
            <Globe size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={apiUrl} onChange={e => setApiUrl(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm font-mono text-white/70 focus:outline-none focus:border-[#A78BFA]/50 transition-colors" />
          </div>
          <p className="text-xs text-white/30 mt-1.5">
            * Thay đổi này chỉ hiệu lực trong phiên làm việc hiện tại. Để thay đổi vĩnh viễn, hãy cập nhật VITE_API_URL trong file .env
          </p>
        </div>
      </SectionCard>

      {/* Security */}
      <SectionCard title="Bảo mật & Phiên làm việc" icon={Shield} accent="#F87171">
        <div className="bg-white/[0.03] rounded-xl divide-y divide-white/5">
          <InfoRow label="Tài khoản hiện tại" value={user?.fullName ?? '—'} />
          <InfoRow label="Vai trò"            value="Admin" />
          <InfoRow label="Phương thức xác thực" value="JWT Bearer Token" />
          <InfoRow label="Token lưu tại"      value="localStorage (sp_token)" mono />
        </div>

        <div className="flex items-center gap-3 p-4 bg-amber-400/10 border border-amber-400/20 rounded-xl">
          <AlertTriangle size={15} className="text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-amber-400 font-medium">Lưu ý bảo mật</p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              JWT token được lưu trong localStorage. Không chia sẻ token với bên thứ ba.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            localStorage.removeItem('sp_token');
            localStorage.removeItem('sp_user');
            window.location.replace('/auth');
          }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-red-400 bg-red-400/10 hover:bg-red-400/15 transition-all border border-red-400/20"
        >
          <Key size={15} /> Đăng xuất và xóa phiên làm việc
        </button>
      </SectionCard>

    </div>
  );
}
