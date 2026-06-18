import { useState, useMemo, useEffect } from 'react';
import {
  UserCheck, Plus, Search, Pencil, Trash2, X,
  AlertTriangle, Loader2, Phone, Mail, Calendar,
  RefreshCw, CircleCheck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getUsers, createUser, updateUser, deleteUser,
  normalizeRole, type UserResponse,
} from '../../services/usersService';

interface StaffAccount {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
}

function mapApiUser(u: UserResponse): StaffAccount {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    email: u.email ?? '',
    phone: u.phoneNumber ?? '',
    createdAt: u.createdAt.slice(0, 10),
  };
}

function getActiveToken(): string | null {
  try {
    const raw = localStorage.getItem('sp_user');
    const parsed = JSON.parse(raw ?? '{}');
    return parsed?.accessToken ?? parsed?.token ?? null;
  } catch { return null; }
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF4C4C] to-rose-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
      {initials}
    </div>
  );
}

const emptyForm = { username: '', fullName: '', email: '', phone: '', password: '' };

export default function ManagerStaff() {
  const { token } = useAuth();

  const [staff, setStaff]           = useState<StaffAccount[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError]     = useState('');
  const [search, setSearch]         = useState('');
  const [modalType, setModalType]   = useState<'add' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected]     = useState<StaffAccount | null>(null);
  const [form, setForm]             = useState(emptyForm);
  const [formError, setFormError]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]           = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const loadStaff = async (isRefresh = false) => {
    const activeToken = token ?? getActiveToken();
    if (!activeToken) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true);
    try {
      const data = await getUsers(activeToken);
      const staffOnly = data
        .filter(u => normalizeRole(u.role as Parameters<typeof normalizeRole>[0]) === 'Staff')
        .map(mapApiUser);
      setStaff(staffOnly);
      setApiError('');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Không thể tải danh sách nhân viên.');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  useEffect(() => { loadStaff(); }, [token]);

  const openAdd    = () => { setForm(emptyForm); setFormError(''); setModalType('add'); };
  const openEdit   = (s: StaffAccount) => {
    setSelected(s);
    setForm({ username: s.username, fullName: s.fullName, email: s.email, phone: s.phone, password: '' });
    setFormError('');
    setModalType('edit');
  };
  const openDelete = (s: StaffAccount) => { setSelected(s); setModalType('delete'); };
  const closeModal = () => { setModalType(null); setSelected(null); setFormError(''); setSubmitting(false); };

  const validate = () => {
    if (!form.fullName.trim())  return 'Vui lòng nhập họ tên.';
    if (!form.username.trim())  return 'Vui lòng nhập tên đăng nhập.';
    if (!form.email.trim() || !form.email.includes('@')) return 'Email không hợp lệ.';
    if (!form.phone.trim())     return 'Vui lòng nhập số điện thoại.';
    if (modalType === 'add' && !form.password.trim()) return 'Vui lòng nhập mật khẩu.';
    return '';
  };

  const handleAdd = async () => {
    const err = validate();
    if (err) { setFormError(err); return; }
    const activeToken = token ?? getActiveToken();
    if (!activeToken) { setFormError('Phiên đăng nhập hết hạn.'); return; }
    setSubmitting(true);
    try {
      const created = await createUser({
        username: form.username.trim(),
        password: form.password.trim(),
        fullName: form.fullName.trim(),
        role: 'Staff',
        phoneNumber: form.phone.trim() || null,
        email: form.email.trim() || null,
      }, activeToken);
      setStaff(prev => [...prev, mapApiUser(created)]);
      closeModal();
      showToast('success', `Đã thêm nhân viên "${created.fullName}".`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    const err = validate();
    if (err) { setFormError(err); return; }
    if (!selected) return;
    const activeToken = token ?? getActiveToken();
    if (!activeToken) { setFormError('Phiên đăng nhập hết hạn.'); return; }
    setSubmitting(true);
    try {
      const updated = await updateUser(selected.id, {
        fullName: form.fullName.trim(),
        role: 'Staff',
        phoneNumber: form.phone.trim() || null,
        email: form.email.trim() || null,
      }, activeToken);
      setStaff(prev => prev.map(s => s.id !== selected.id ? s : mapApiUser(updated)));
      closeModal();
      showToast('success', 'Đã cập nhật thông tin nhân viên.');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const activeToken = token ?? getActiveToken();
    if (!activeToken) { setFormError('Phiên đăng nhập hết hạn.'); return; }
    setSubmitting(true);
    try {
      await deleteUser(selected.id, activeToken);
      setStaff(prev => prev.filter(s => s.id !== selected.id));
      closeModal();
      showToast('success', `Đã xoá nhân viên "${selected.fullName}".`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Đã xảy ra lỗi.');
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => staff.filter(s =>
    s.fullName.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.username.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search)
  ), [staff, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Quản lý nhân viên</h2>
          <p className="text-sm text-white/40 mt-0.5">{staff.length} nhân viên đang hoạt động</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadStaff(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white"
            title="Làm mới"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF4C4C] hover:bg-[#ff3333] text-white font-semibold text-sm transition-opacity hover:opacity-90"
          >
            <Plus size={16} />
            Thêm nhân viên
          </button>
        </div>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{apiError}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {[
          { label: 'Tổng nhân viên', value: staff.length,    unit: 'người', color: '#FF4C4C', bg: 'from-[#FF4C4C]/20 to-[#FF4C4C]/5' },
          { label: 'Đang hoạt động', value: staff.length,    unit: 'người', color: '#34D399', bg: 'from-emerald-400/20 to-emerald-400/5' },
          { label: 'Tháng này',      value: staff.filter(s => s.createdAt.startsWith(new Date().toISOString().slice(0,7))).length, unit: 'mới', color: '#A78BFA', bg: 'from-violet-400/20 to-violet-400/5' },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-5 rounded-2xl">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.bg} flex items-center justify-center mb-3`}>
              <UserCheck size={19} style={{ color: stat.color }} />
            </div>
            <p className="text-2xl font-bold text-white">
              {stat.value}
              <span className="text-sm font-normal text-white/40 ml-1">{stat.unit}</span>
            </p>
            <p className="text-sm text-white/50 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="Tìm tên, email, số điện thoại..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-medium text-white/40 px-6 py-3.5">Nhân viên</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Liên hệ</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Ngày tạo</th>
                <th className="text-left text-xs font-medium text-white/40 px-4 py-3.5">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-white/30 text-sm">
                    {search ? 'Không tìm thấy nhân viên phù hợp.' : 'Chưa có nhân viên nào.'}
                  </td>
                </tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.fullName} />
                      <div>
                        <p className="text-sm font-medium text-white">{s.fullName}</p>
                        <p className="text-xs text-white/40">@{s.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="space-y-0.5">
                      {s.email && (
                        <div className="flex items-center gap-1.5 text-xs text-white/50">
                          <Mail size={11} className="shrink-0" />
                          {s.email}
                        </div>
                      )}
                      {s.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-white/50">
                          <Phone size={11} className="shrink-0" />
                          {s.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-sm text-white/50">
                      <Calendar size={12} />
                      {new Date(s.createdAt).toLocaleDateString('vi-VN')}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(s)}
                        className="p-2 rounded-lg text-white/40 hover:text-[#FF4C4C] hover:bg-[#FF4C4C]/10 transition-all"
                        title="Chỉnh sửa"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => openDelete(s)}
                        className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all"
                        title="Xoá"
                      >
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
          <div className="px-6 py-3 border-t border-white/5">
            <p className="text-xs text-white/30">Hiển thị {filtered.length} / {staff.length} nhân viên</p>
          </div>
        )}
      </div>

      {/* ── ADD / EDIT MODAL ── */}
      {(modalType === 'add' || modalType === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-white/10 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col" style={{ backgroundColor: 'var(--admin-bg-surface)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FF4C4C]/10 flex items-center justify-center">
                  <UserCheck size={17} className="text-[#FF4C4C]" />
                </div>
                <h3 className="text-base font-semibold text-white">
                  {modalType === 'add' ? 'Thêm nhân viên mới' : `Chỉnh sửa · ${selected?.fullName}`}
                </h3>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-4">
              {[
                { key: 'fullName' as const, label: 'Họ và tên',      placeholder: 'Nguyễn Văn A',     type: 'text'     },
                { key: 'username' as const, label: 'Tên đăng nhập',  placeholder: 'nguyen_van_a',      type: 'text',    disabled: modalType === 'edit' },
                { key: 'email'    as const, label: 'Email',           placeholder: 'email@parking.vn', type: 'email'    },
                { key: 'phone'    as const, label: 'Số điện thoại',   placeholder: '0901 234 567',     type: 'text'     },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    disabled={f.disabled}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF4C4C]/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>
              ))}

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
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-400/8 border border-red-400/15 rounded-xl text-xs text-red-400">
                  <AlertTriangle size={12} className="shrink-0" />
                  {formError}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-white/10">
              <button onClick={closeModal} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50">
                Huỷ
              </button>
              <button
                onClick={modalType === 'add' ? handleAdd : handleEdit}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#FF4C4C] hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {modalType === 'add' ? 'Thêm mới' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {modalType === 'delete' && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl" style={{ backgroundColor: 'var(--admin-bg-surface)' }}>
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="flex justify-center mb-4">
                <Avatar name={selected.fullName} />
              </div>
              <h3 className="text-base font-semibold text-white">Xoá nhân viên?</h3>
              <p className="text-sm text-white/50 mt-2 leading-relaxed">
                Bạn sắp xoá tài khoản <span className="text-white font-medium">{selected.fullName}</span>
                <br />
                <span className="text-xs text-white/30">@{selected.username} · {selected.email}</span>
              </p>
              <p className="text-xs text-white/30 mt-2">Hành động này không thể hoàn tác.</p>
              {formError && (
                <p className="text-xs text-red-400 flex items-center justify-center gap-1.5 mt-2">
                  <AlertTriangle size={12} /> {formError}
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

      {/* ── TOAST ── */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium max-w-sm
          ${toast.type === 'success' ? 'border-[#FF4C4C]/40 text-[#FF4C4C]' : 'border-red-400/40 text-red-400'}`}
          style={{ backgroundColor: 'var(--admin-bg-surface)' }}
        >
          {toast.type === 'success' ? <CircleCheck size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
          <span className="flex-1">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-1 opacity-50 hover:opacity-100 transition-opacity">
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
