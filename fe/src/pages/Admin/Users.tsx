import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, ShieldCheck, Briefcase, UserCheck, User,
  Plus, Search, Pencil, Trash2, X,
  AlertTriangle, Check, Lock, ChevronDown,
  UserCog, Loader2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getUsers, createUser, updateUser, deleteUser, assignRole, normalizeRole,
  type ApiRole, type UserResponse,
} from '../../services/usersService';

type Role   = 'Admin' | 'Manager' | 'Staff' | 'User';
type Status = 'active' | 'inactive';

interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  status: Status;
  createdAt: string;
}

const API_TO_UI: Record<string, Role> = {
  Admin: 'Admin', Manager: 'Manager', Staff: 'Staff', Driver: 'User',
};
const UI_TO_API: Record<Role, ApiRole> = {
  Admin: 'Admin', Manager: 'Manager', Staff: 'Staff', User: 'Driver',
};

function mapApiUser(u: UserResponse): UserAccount {
  const roleStr = normalizeRole(u.role as ApiRole | number);
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    email: u.email ?? '',
    phone: u.phoneNumber ?? '',
    role: API_TO_UI[roleStr] ?? 'User',
    status: 'active',
    createdAt: u.createdAt.slice(0, 10),
  };
}

const roleConfig: Record<Role, { label: string; bg: string; text: string; icon: typeof ShieldCheck; color: string }> = {
  Admin:   { label: 'Admin',        bg: 'bg-[#FF4C4C]/15',   text: 'text-[#FF4C4C]',   icon: ShieldCheck, color: '#FF4C4C' },
  Manager: { label: 'Quản lý',     bg: 'bg-violet-400/15',  text: 'text-violet-400',  icon: Briefcase,   color: '#A78BFA' },
  Staff:   { label: 'Nhân viên',   bg: 'bg-[#FF4C4C]/15',   text: 'text-[#FF4C4C]',   icon: UserCheck,   color: '#FF4C4C' },
  User:    { label: 'Người dùng',  bg: 'bg-emerald-400/15', text: 'text-emerald-400', icon: User,        color: '#34D399' },
};

const avatarColors: Record<Role, string> = {
  Admin:   'bg-[#FF4C4C]',
  Manager: 'from-violet-400 to-purple-600',
  Staff:   'bg-[#FF4C4C]',
  User:    'from-emerald-400 to-teal-500',
};

const permissions = [
  { label: 'Xem dashboard tổng quan',    admin: true,  manager: true,  staff: true,  user: false },
  { label: 'Quản lý bãi đỗ xe',          admin: true,  manager: true,  staff: false, user: false },
  { label: 'Thêm / xoá khu đỗ',          admin: true,  manager: false, staff: false, user: false },
  { label: 'Quản lý người dùng',          admin: true,  manager: false, staff: false, user: false },
  { label: 'Phân quyền người dùng',       admin: true,  manager: false, staff: false, user: false },
  { label: 'Xem báo cáo doanh thu',       admin: true,  manager: true,  staff: false, user: false },
  { label: 'Xuất báo cáo',               admin: true,  manager: false, staff: false, user: false },
  { label: 'Cấu hình hệ thống',           admin: true,  manager: false, staff: false, user: false },
  { label: 'Quản lý phương tiện',         admin: true,  manager: true,  staff: true,  user: false },
  { label: 'Xử lý xe vào / ra',          admin: true,  manager: true,  staff: true,  user: false },
  { label: 'Thanh toán phí đỗ xe',       admin: true,  manager: true,  staff: true,  user: true  },
  { label: 'Xem lịch sử đỗ xe cá nhân', admin: true,  manager: true,  staff: false, user: true  },
];

const emptyForm = { username: '', fullName: '', email: '', phone: '', role: 'User' as Role, status: 'active' as Status, password: '' };

type RoleFilter = 'all' | Role;
type Tab = 'users' | 'permissions';

function AvatarIcon({ name, role }: { name: string; role: Role }) {
  const initials = name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColors[role]} flex items-center justify-center text-black font-bold text-sm shrink-0`}>
      {initials}
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const cfg = roleConfig[role];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function PermCheck({ value }: { value: boolean }) {
  return value
    ? <div className="mx-auto w-6 h-6 rounded-full bg-[#FF4C4C]/15 flex items-center justify-center"><Check size={13} className="text-[#FF4C4C]" /></div>
    : <div className="mx-auto w-6 h-6 rounded-full bg-white/5 flex items-center justify-center"><X size={12} className="text-white/20" /></div>;
}

const allRoles: Role[] = ['Admin', 'Manager', 'Staff', 'User'];

export default function UsersPage() {
  const { token } = useAuth();

  const [activeTab, setActiveTab]   = useState<Tab>('users');
  const [users, setUsers]           = useState<UserAccount[]>([]);
  const [loading, setLoading]       = useState(true);
  const [apiError, setApiError]     = useState('');
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [modalType, setModalType]   = useState<'add' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected]     = useState<UserAccount | null>(null);
  const [form, setForm]             = useState(emptyForm);
  const [formError, setFormError]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    getUsers(token)
      .then(data => setUsers(data.map(mapApiUser)))
      .catch(err => setApiError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const openAdd = () => { setForm(emptyForm); setFormError(''); setModalType('add'); };
  const openEdit = (u: UserAccount) => {
    setSelected(u);
    setForm({ username: u.username, fullName: u.fullName, email: u.email, phone: u.phone, role: u.role, status: u.status, password: '' });
    setFormError('');
    setModalType('edit');
  };
  const openDelete = (u: UserAccount) => { setSelected(u); setModalType('delete'); };
  const closeModal = () => { setModalType(null); setSelected(null); setFormError(''); setSubmitting(false); };

  const quickChangeRole = async (userId: string, role: Role) => {
    if (!token) return;
    try {
      await assignRole(userId, { role: UI_TO_API[role] }, token);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    } catch {
      // silently revert — dropdown closes below
    }
    setShowRoleDropdown(null);
  };

  const validateForm = () => {
    if (!form.fullName.trim())  return 'Vui lòng nhập họ tên.';
    if (!form.username.trim())  return 'Vui lòng nhập tên đăng nhập.';
    if (!form.email.trim() || !form.email.includes('@')) return 'Email không hợp lệ.';
    if (!form.phone.trim())     return 'Vui lòng nhập số điện thoại.';
    if (modalType === 'add' && !form.password.trim()) return 'Vui lòng nhập mật khẩu.';
    return '';
  };

  const handleAdd = async () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    if (!token) return;
    setSubmitting(true);
    try {
      const created = await createUser({
        username: form.username.trim(),
        password: form.password.trim(),
        fullName: form.fullName.trim(),
        role: UI_TO_API[form.role],
        phoneNumber: form.phone.trim() || null,
        email: form.email.trim() || null,
      }, token);
      setUsers(prev => [...prev, mapApiUser(created)]);
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
      const updated = await updateUser(selected.id, {
        fullName: form.fullName.trim(),
        role: UI_TO_API[form.role],
        phoneNumber: form.phone.trim() || null,
        email: form.email.trim() || null,
      }, token);
      setUsers(prev => prev.map(u => u.id !== selected.id ? u : mapApiUser(updated)));
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
      await deleteUser(selected.id, token);
      setUsers(prev => prev.filter(u => u.id !== selected.id));
      closeModal();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
      setSubmitting(false);
    }
  };

  const counts = useMemo(() => ({
    all:     users.length,
    Admin:   users.filter(u => u.role === 'Admin').length,
    Manager: users.filter(u => u.role === 'Manager').length,
    Staff:   users.filter(u => u.role === 'Staff').length,
    User:    users.filter(u => u.role === 'User').length,
    active:  users.filter(u => u.status === 'active').length,
  }), [users]);

  const filtered = useMemo(() => users.filter(u => {
    const matchSearch =
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  }), [users, search, roleFilter]);

  const roleTabs: { key: RoleFilter; label: string; count: number }[] = [
    { key: 'all',     label: 'Tất cả',      count: counts.all },
    { key: 'Admin',   label: 'Admin',       count: counts.Admin },
    { key: 'Manager', label: 'Quản lý',    count: counts.Manager },
    { key: 'Staff',   label: 'Nhân viên',   count: counts.Staff },
    { key: 'User',    label: 'Người dùng',  count: counts.User },
  ];

  const statsData = [
    { label: 'Tổng tài khoản', value: counts.all,     unit: 'tài khoản', icon: Users,      color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5' },
    { label: 'Admin',          value: counts.Admin,   unit: 'người',     icon: ShieldCheck, color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5' },
    { label: 'Quản lý',        value: counts.Manager, unit: 'người',     icon: Briefcase,   color: '#A78BFA', bg: 'from-violet-400/20 to-violet-400/5' },
    { label: 'Nhân viên',      value: counts.Staff,   unit: 'người',     icon: UserCheck,   color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5' },
    { label: 'Người dùng',     value: counts.User,    unit: 'người',     icon: User,        color: '#34D399', bg: 'from-emerald-400/20 to-emerald-400/5' },
  ];

  const roleDescriptions: Record<Role, string> = {
    Admin:   'Toàn quyền quản trị — kiểm soát toàn bộ hệ thống, người dùng và báo cáo.',
    Manager: 'Quản lý vận hành — giám sát bãi đỗ, phương tiện và xem báo cáo.',
    Staff:   'Nhân viên vận hành — xử lý xe vào/ra, quản lý phương tiện và thanh toán.',
    User:    'Người dùng hệ thống — sử dụng bãi đỗ xe, xem lịch sử và thanh toán phí.',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" onClick={() => setShowRoleDropdown(null)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Người dùng & Phân quyền</h2>
          <p className="text-sm text-white/40 mt-0.5">{counts.active} tài khoản đang hoạt động</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r bg-[#FF4C4C] text-black font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Thêm người dùng
        </button>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{apiError}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {statsData.map(s => {
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

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 w-fit">
        {([{ key: 'users', label: 'Người dùng', icon: Users }, { key: 'permissions', label: 'Phân quyền', icon: UserCog }] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── USERS TAB ── */}
      {activeTab === 'users' && (
        <>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Tìm tên, email, tên đăng nhập..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
              />
            </div>
            <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 flex-wrap">
              {roleTabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setRoleFilter(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    roleFilter === t.key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {t.label}
                  <span className={`ml-1.5 ${roleFilter === t.key ? 'text-[#FF4C4C]' : 'text-white/20'}`}>{t.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-xs font-medium text-white/40 px-6 py-3.5">Người dùng</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Số điện thoại</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Vai trò</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Ngày tạo</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-white/30 text-sm">Không tìm thấy người dùng nào.</td></tr>
                  ) : filtered.map(u => (
                    <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <AvatarIcon name={u.fullName} role={u.role} />
                          <div>
                            <p className="text-sm font-medium text-white">{u.fullName}</p>
                            <p className="text-xs text-white/40">{u.email || u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-white/60">{u.phone || '—'}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="relative" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setShowRoleDropdown(showRoleDropdown === u.id ? null : u.id)}
                            className="flex items-center gap-1"
                          >
                            <RoleBadge role={u.role} />
                            <ChevronDown size={12} className="text-white/30 ml-0.5" />
                          </button>
                          {showRoleDropdown === u.id && (
                            <div className="absolute top-8 left-0 z-20 border border-white/10 rounded-xl py-1 shadow-2xl min-w-[150px]" style={{ backgroundColor: 'var(--admin-bg-surface)' }}>
                              {allRoles.map(r => (
                                <button
                                  key={r}
                                  onClick={() => quickChangeRole(u.id, r)}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors ${u.role === r ? roleConfig[r].text : 'text-white/60'}`}
                                >
                                  {u.role === r ? <Check size={11} /> : <span className="w-[11px]" />}
                                  {roleConfig[r].label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-white/50">{new Date(u.createdAt).toLocaleDateString('vi-VN')}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(u)} className="p-2 rounded-lg text-white/40 hover:text-[#FF4C4C] hover:bg-[#FF4C4C]/10 transition-all" title="Chỉnh sửa">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => openDelete(u)} className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all" title="Xoá">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && (
              <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between">
                <p className="text-xs text-white/30">Hiển thị {filtered.length} / {users.length} người dùng</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── PERMISSIONS TAB ── */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {allRoles.map(role => {
              const cfg = roleConfig[role];
              const Icon = cfg.icon;
              return (
                <div key={role} className="glass-card p-5 rounded-2xl">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarColors[role]} flex items-center justify-center mb-3`}>
                    <Icon size={20} className="text-black" />
                  </div>
                  <p className={`text-base font-semibold ${cfg.text}`}>{cfg.label}</p>
                  <p className="text-xs text-white/40 mt-1.5 leading-relaxed">{roleDescriptions[role]}</p>
                  <p className={`text-2xl font-bold mt-3 ${cfg.text}`}>
                    {counts[role]}
                    <span className="text-sm font-normal text-white/40 ml-1">người</span>
                  </p>
                </div>
              );
            })}
          </div>

          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
              <Lock size={15} className="text-white/40" />
              <h3 className="text-sm font-semibold text-white">Ma trận phân quyền</h3>
              <span className="text-xs text-white/30 ml-1">— các quyền theo từng vai trò</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-xs font-medium text-white/40 px-6 py-3.5 w-2/5">Quyền hạn</th>
                    {allRoles.map(r => {
                      const cfg = roleConfig[r];
                      const Icon = cfg.icon;
                      return (
                        <th key={r} className="text-center text-xs font-medium px-4 py-3.5">
                          <div className="flex flex-col items-center gap-1.5">
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarColors[r]} flex items-center justify-center`}>
                              <Icon size={14} className="text-black" />
                            </div>
                            <span className={cfg.text}>{cfg.label}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((p, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                      <td className="px-6 py-3.5 text-sm text-white/70">{p.label}</td>
                      <td className="px-4 py-3.5 text-center"><PermCheck value={p.admin} /></td>
                      <td className="px-4 py-3.5 text-center"><PermCheck value={p.manager} /></td>
                      <td className="px-4 py-3.5 text-center"><PermCheck value={p.staff} /></td>
                      <td className="px-4 py-3.5 text-center"><PermCheck value={p.user} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT MODAL ── */}
      {(modalType === 'add' || modalType === 'edit') && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-white/10 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col" style={{ backgroundColor: 'var(--admin-bg-surface)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-base font-semibold text-white">
                {modalType === 'add' ? 'Thêm người dùng mới' : `Chỉnh sửa · ${selected?.fullName}`}
              </h3>
              <button onClick={closeModal} className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-4">
              {([
                { key: 'fullName', label: 'Họ và tên',     placeholder: 'Nguyễn Văn A',      type: 'text'  },
                { key: 'username', label: 'Tên đăng nhập', placeholder: 'nguyen_van_a',       type: 'text'  },
                { key: 'email',    label: 'Email',          placeholder: 'email@parking.vn',  type: 'email' },
                { key: 'phone',    label: 'Số điện thoại',  placeholder: '0901 234 567',      type: 'text'  },
              ] as const).map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Vai trò</label>
                <div className="grid grid-cols-2 gap-2">
                  {allRoles.map(r => {
                    const cfg = roleConfig[r];
                    const Icon = cfg.icon;
                    const active = form.role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, role: r }))}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                          active
                            ? `${cfg.bg} ${cfg.text} border-current`
                            : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20 hover:text-white/60'
                        }`}
                      >
                        <Icon size={14} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {modalType === 'add' && (
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Mật khẩu</label>
                  <input
                    type="password"
                    placeholder="Nhập mật khẩu..."
                    value={form.password}
                    onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
                  />
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
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r bg-[#FF4C4C] hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {modalType === 'add' ? 'Thêm mới' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── DELETE MODAL ── */}
      {modalType === 'delete' && selected && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl" style={{ backgroundColor: 'var(--admin-bg-surface)' }}>
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="flex justify-center mb-4">
                <AvatarIcon name={selected.fullName} role={selected.role} />
              </div>
              <h3 className="text-base font-semibold text-white">Xoá người dùng?</h3>
              <p className="text-sm text-white/50 mt-2 leading-relaxed">
                Bạn sắp xoá tài khoản <span className="text-white font-medium">{selected.fullName}</span>
                <br />
                <span className="text-xs text-white/30">@{selected.username} · {selected.email}</span>
              </p>
              <p className="text-xs text-white/30 mt-2">Hành động này không thể hoàn tác.</p>
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
      , document.body)}
    </div>
  );
}