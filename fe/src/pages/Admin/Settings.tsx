import { useState } from 'react';
import {
  Save, Building2, Phone, Mail,
  Clock, RefreshCw, CheckCircle2, Loader2,
} from 'lucide-react';

// ─── Types & defaults ─────────────────────────────────────────────────────────

interface SystemSettings {
  parkingName:     string;
  address:         string;
  phone:           string;
  email:           string;
  website:         string;
  openingHour:     number;
  closingHour:     number;
  currency:        string;
  timezone:        string;
  maxSessionHours: number;
}

const DEFAULTS: SystemSettings = {
  parkingName:     'ParkingSystem Vietnam',
  address:         '123 Le Loi Street, District 1, Ho Chi Minh City',
  phone:           '028 1234 5678',
  email:           'admin@parkingsystem.vn',
  website:         'https://parkingsystem.vn',
  openingHour:     6,
  closingHour:     23,
  currency:        'VND',
  timezone:        'Asia/Ho_Chi_Minh',
  maxSessionHours: 24,
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

function SectionCard({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#FF4C4C]/10">
          <Icon size={16} className="text-[#FF4C4C]" />
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

function TextInput({ value, onChange, placeholder, type = 'text', icon: Icon }: {
  value: string | number; onChange: (v: string) => void;
  placeholder?: string; type?: string; icon?: React.ElementType;
}) {
  return (
    <div className="relative">
      {Icon && <Icon size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-white/5 border border-white/10 rounded-xl ${Icon ? 'pl-9' : 'px-4'} pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors`}
      />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminSettings() {
  const [settings, setSettings] = useState<SystemSettings>(loadSettings);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

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

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">System Settings</h2>
          <p className="text-sm text-white/40 mt-0.5">Configure system information and preferences</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/50 bg-white/5 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
          >
            <RefreshCw size={14} /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#FF4C4C] hover:bg-[#e03e3e] transition-colors disabled:opacity-60"
          >
            {saving
              ? <Loader2 size={14} className="animate-spin" />
              : saved
              ? <CheckCircle2 size={14} />
              : <Save size={14} />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save changes'}
          </button>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#FF4C4C]/10 border border-[#FF4C4C]/20 rounded-xl">
          <CheckCircle2 size={15} className="text-[#FF4C4C] shrink-0" />
          <p className="text-sm text-[#FF4C4C]">Settings saved successfully.</p>
        </div>
      )}

      {/* Parking Info */}
      <SectionCard title="Parking Information" icon={Building2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Parking Name">
            <TextInput value={settings.parkingName} onChange={set('parkingName')} placeholder="System name" />
          </Field>
          <Field label="Website">
            <TextInput value={settings.website} onChange={set('website')} placeholder="https://..." />
          </Field>
        </div>
        <Field label="Address">
          <TextInput value={settings.address} onChange={set('address')} placeholder="Full address" />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Phone Number">
            <TextInput value={settings.phone} onChange={set('phone')} placeholder="028 ..." icon={Phone} />
          </Field>
          <Field label="Contact Email">
            <TextInput type="email" value={settings.email} onChange={set('email')} placeholder="admin@..." icon={Mail} />
          </Field>
        </div>
      </SectionCard>

      {/* Operating Hours */}
      <SectionCard title="Operating Hours & Units" icon={Clock}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Opening Hour (h)">
            <TextInput type="number" value={settings.openingHour} onChange={set('openingHour')} placeholder="6" />
          </Field>
          <Field label="Closing Hour (h)">
            <TextInput type="number" value={settings.closingHour} onChange={set('closingHour')} placeholder="23" />
          </Field>
          <Field label="Max Hours / Session">
            <TextInput type="number" value={settings.maxSessionHours} onChange={set('maxSessionHours')} placeholder="24" />
          </Field>
          <Field label="Currency">
            <select
              value={settings.currency}
              onChange={e => set('currency')(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF4C4C]/50 transition-colors appearance-none"
            >
              {['VND', 'USD', 'EUR'].map(c => (
                <option key={c} value={c} className="bg-[#121214]">{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Timezone">
          <select
            value={settings.timezone}
            onChange={e => set('timezone')(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF4C4C]/50 transition-colors appearance-none"
          >
            {['Asia/Ho_Chi_Minh', 'UTC', 'Asia/Bangkok', 'Asia/Singapore'].map(tz => (
              <option key={tz} value={tz} className="bg-[#121214]">{tz}</option>
            ))}
          </select>
        </Field>
      </SectionCard>

    </div>
  );
}
