import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  Wallet, ArrowDownLeft, ArrowUpRight, Plus, Trash2,
  Star, RefreshCw, AlertCircle, CheckCircle2, ArrowLeft,
  Building2, CreditCard, X
} from 'lucide-react';
import {
  getWallet, depositWallet, withdrawWallet,
  getBankAccounts, createBankAccount, deleteBankAccount, setDefaultBankAccount,
  type WalletTransaction, type BankAccount,
} from '../../services/walletService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVND(n: number) {
  return n.toLocaleString('vi-VN') + ' ₫';
}

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return s; }
}

const TX_LABELS: Record<string, string> = {
  Deposit: 'Nạp tiền',
  Withdrawal: 'Rút tiền',
  Payment: 'Thanh toán',
  Refund: 'Hoàn tiền',
  BookingPayment: 'Thanh toán đặt chỗ',
};

function txIcon(type: string, amount: number) {
  const isIn = type === 'Deposit' || type === 'Refund';
  const color = isIn ? '#22c55e' : '#ef4444';
  const Icon = isIn ? ArrowDownLeft : ArrowUpRight;
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: isIn ? '#22c55e22' : '#ef444422', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={16} color={color} />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DepositModal({ onClose, onSuccess, token }: { onClose: () => void; onSuccess: () => void; token: string }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const presets = [50_000, 100_000, 200_000, 500_000];

  const submit = async () => {
    const n = parseInt(amount.replace(/\D/g, ''));
    if (!n || n < 10_000) { setError('Số tiền tối thiểu là 10,000 ₫'); return; }
    setLoading(true); setError(null);
    try {
      const res = await depositWallet({ amount: n }, token);
      localStorage.setItem('pending_deposit_order', String(res.orderCode));
      window.location.href = res.checkoutUrl;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--lp-card-bg, #1e1e2e)', borderRadius: 16, padding: 28, width: 360, maxWidth: '90vw', border: '1px solid var(--lp-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--lp-text)' }}>Nạp tiền vào ví</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-text-muted)' }}><X size={18} /></button>
        </div>

        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--lp-text-muted)' }}>Chọn nhanh:</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {presets.map(p => (
            <button key={p} onClick={() => setAmount(String(p))}
              style={{ flex: '1 1 calc(50% - 4px)', padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: amount === String(p) ? '#FF4C4C' : 'var(--lp-input-bg)', color: amount === String(p) ? '#fff' : 'var(--lp-text)', border: '1px solid var(--lp-border)' }}>
              {fmtVND(p)}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Hoặc nhập số tiền..."
          value={amount ? parseInt(amount).toLocaleString('vi-VN') : ''}
          onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1px solid var(--lp-border)', background: 'var(--lp-input-bg)', color: 'var(--lp-text)', boxSizing: 'border-box', outline: 'none' }}
        />

        {error && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#ef4444' }}>{error}</p>}

        <button onClick={submit} disabled={loading}
          style={{ marginTop: 20, width: '100%', padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', background: '#FF4C4C', color: '#fff', border: 'none', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Đang xử lý...' : 'Nạp tiền qua PayOS'}
        </button>
      </div>
    </div>
  );
}

function WithdrawModal({ balance, bankAccounts, onClose, onSuccess, token }: {
  balance: number; bankAccounts: BankAccount[]; onClose: () => void; onSuccess: () => void; token: string;
}) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const defaultBank = bankAccounts.find(b => b.isDefault);

  const submit = async () => {
    const n = parseInt(amount.replace(/\D/g, ''));
    if (!n || n < 10_000) { setError('Số tiền tối thiểu rút là 10,000 ₫'); return; }
    if (n > balance) { setError('Số dư ví không đủ'); return; }
    if (!defaultBank) { setError('Vui lòng thêm tài khoản ngân hàng mặc định trước'); return; }
    setLoading(true); setError(null);
    try {
      const res = await withdrawWallet({ amount: n }, token);
      setSuccess(res.message ?? 'Yêu cầu rút tiền đã được gửi!');
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--lp-card-bg, #1e1e2e)', borderRadius: 16, padding: 28, width: 380, maxWidth: '90vw', border: '1px solid var(--lp-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--lp-text)' }}>Rút tiền về ngân hàng</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-text-muted)' }}><X size={18} /></button>
        </div>

        {defaultBank ? (
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--lp-input-bg)', border: '1px solid var(--lp-border)', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--lp-text-muted)', marginBottom: 4 }}>Tài khoản nhận tiền</p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--lp-text)' }}>{defaultBank.bankName}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--lp-text-muted)' }}>{defaultBank.accountNumber} — {defaultBank.accountName}</p>
          </div>
        ) : (
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#ef444415', border: '1px solid #ef444440', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={14} color="#ef4444" />
            <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>Chưa có tài khoản ngân hàng mặc định. Vui lòng thêm ở tab Ngân hàng.</p>
          </div>
        )}

        <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--lp-text-muted)' }}>Số dư hiện tại: <strong style={{ color: '#22c55e' }}>{fmtVND(balance)}</strong></p>

        <input
          type="text"
          placeholder="Nhập số tiền muốn rút..."
          value={amount ? parseInt(amount).toLocaleString('vi-VN') : ''}
          onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1px solid var(--lp-border)', background: 'var(--lp-input-bg)', color: 'var(--lp-text)', boxSizing: 'border-box', outline: 'none' }}
        />

        {error && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#ef4444' }}>{error}</p>}
        {success && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} />{success}</p>}

        <button onClick={submit} disabled={loading || !defaultBank}
          style={{ marginTop: 20, width: '100%', padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: (loading || !defaultBank) ? 'not-allowed' : 'pointer', background: '#FF4C4C', color: '#fff', border: 'none', opacity: (loading || !defaultBank) ? 0.6 : 1 }}>
          {loading ? 'Đang xử lý...' : 'Xác nhận rút tiền'}
        </button>
      </div>
    </div>
  );
}

function AddBankModal({ onClose, onSuccess, token }: { onClose: () => void; onSuccess: () => void; token: string }) {
  const [form, setForm] = useState({ bankBin: '', bankName: '', accountNumber: '', accountName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const BANKS = [
    { bin: '970436', name: 'Vietcombank' },
    { bin: '970407', name: 'Techcombank' },
    { bin: '970422', name: 'MB Bank' },
    { bin: '970441', name: 'VIB' },
    { bin: '970416', name: 'ACB' },
    { bin: '970423', name: 'TPBank' },
    { bin: '970418', name: 'BIDV' },
    { bin: '970415', name: 'VietinBank' },
    { bin: '970405', name: 'Agribank' },
    { bin: '970443', name: 'SHB' },
  ];

  const handleBankSelect = (bin: string) => {
    const bank = BANKS.find(b => b.bin === bin);
    if (bank) setForm(f => ({ ...f, bankBin: bank.bin, bankName: bank.name }));
  };

  const submit = async () => {
    if (!form.bankBin || !form.accountNumber || !form.accountName) {
      setError('Vui lòng điền đầy đủ thông tin'); return;
    }
    setLoading(true); setError(null);
    try {
      await createBankAccount(form, token);
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1px solid var(--lp-border)', background: 'var(--lp-input-bg)', color: 'var(--lp-text)', boxSizing: 'border-box' as const, outline: 'none', marginBottom: 12 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--lp-card-bg, #1e1e2e)', borderRadius: 16, padding: 28, width: 400, maxWidth: '90vw', border: '1px solid var(--lp-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--lp-text)' }}>Thêm tài khoản ngân hàng</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-text-muted)' }}><X size={18} /></button>
        </div>

        <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--lp-text-muted)' }}>Ngân hàng</p>
        <select value={form.bankBin} onChange={e => handleBankSelect(e.target.value)}
          style={{ ...inputStyle, appearance: 'none' as const }}>
          <option value="">-- Chọn ngân hàng --</option>
          {BANKS.map(b => <option key={b.bin} value={b.bin}>{b.name}</option>)}
        </select>

        <input placeholder="Số tài khoản" value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} style={inputStyle} />
        <input placeholder="Tên chủ tài khoản" value={form.accountName} onChange={e => setForm(f => ({ ...f, accountName: e.target.value.toUpperCase() }))} style={inputStyle} />

        {error && <p style={{ margin: '0 0 10px', fontSize: 12, color: '#ef4444' }}>{error}</p>}

        <button onClick={submit} disabled={loading}
          style={{ width: '100%', padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', background: '#FF4C4C', color: '#fff', border: 'none', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Đang lưu...' : 'Lưu tài khoản'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'history' | 'banks';

export default function WalletPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = useAuth();

  const [tab, setTab] = useState<Tab>('overview');
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [modal, setModal] = useState<'deposit' | 'withdraw' | 'addBank' | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const [walletRes, banksRes] = await Promise.all([getWallet(token), getBankAccounts(token)]);
      setBalance(walletRes.balance);
      setTransactions(walletRes.transactions ?? []);
      setBanks(banksRes ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không thể tải thông tin ví');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // Lắng nghe SignalR walletUpdate — backend push balance mới sau khi webhook cộng tiền
  useEffect(() => {
    const onWalletUpdate = (e: Event) => {
      const { balance: newBalance } = (e as CustomEvent<{ balance: number }>).detail;
      setBalance(newBalance);
      setToast({ msg: 'Nạp tiền thành công! Số dư đã được cập nhật.', ok: true });
      setTimeout(() => setToast(null), 5000);
      loadData(); // reload transactions list
    };
    window.addEventListener('walletUpdate', onWalletUpdate);
    return () => window.removeEventListener('walletUpdate', onWalletUpdate);
  }, [loadData]);

  // Xử lý khi PayOS redirect về /wallet?deposited=1 hoặc ?deposited=0
  useEffect(() => {
    const deposited = searchParams.get('deposited');
    if (deposited === null) return;
    setSearchParams({}, { replace: true });

    if (deposited !== '1') {
      setToast({ msg: 'Nạp tiền bị huỷ hoặc thất bại.', ok: false });
      setTimeout(() => setToast(null), 4000);
      return;
    }

    // Gọi verify API để backend tự xử lý cộng tiền (không cần bấm Verify thủ công)
    const pendingOrder = localStorage.getItem('pending_deposit_order');
    localStorage.removeItem('pending_deposit_order');

    setToast({ msg: 'Đang xác nhận thanh toán...', ok: true });

    if (pendingOrder && token) {
      (async () => {
        try {
          const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';
          const res = await fetch(`${BASE}/api/payments/verify/${pendingOrder}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.isPaid) {
            setToast({ msg: 'Nạp tiền thành công! Số dư đã được cập nhật.', ok: true });
            setTimeout(() => setToast(null), 4000);
            loadData();
          } else {
            setToast({ msg: 'Thanh toán chưa được xác nhận. Vui lòng thử lại.', ok: false });
            setTimeout(() => setToast(null), 5000);
          }
        } catch {
          setTimeout(() => loadData(), 3000);
        }
      })();
    } else {
      // Không có orderCode — fallback reload
      setTimeout(() => loadData(), 3000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteBank = async (id: string) => {
    if (!token) return;
    setDeletingId(id);
    try { await deleteBankAccount(id, token); await loadData(); } catch { /* ignore */ } finally { setDeletingId(null); }
  };

  const handleSetDefault = async (id: string) => {
    if (!token) return;
    setSettingDefaultId(id);
    try { await setDefaultBankAccount(id, token); await loadData(); } catch { /* ignore */ } finally { setSettingDefaultId(null); }
  };

  // ── styles ──────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'var(--lp-card-bg, rgba(255,255,255,0.04))',
    border: '1px solid var(--lp-border)',
    borderRadius: 16,
    padding: '20px 24px',
  };

  const tabBtn = (t: Tab): React.CSSProperties => ({
    padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
    background: tab === t ? '#FF4C4C' : 'var(--lp-input-bg)',
    color: tab === t ? '#fff' : 'var(--lp-text-muted)',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--lp-bg)', color: 'var(--lp-text)', padding: '32px 16px', fontFamily: 'inherit' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button onClick={() => navigate('/')}
            style={{ background: 'var(--lp-input-bg)', border: '1px solid var(--lp-border)', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', color: 'var(--lp-text-muted)', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={16} />
          </button>
          <Wallet size={22} color="#FF4C4C" />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--lp-text)' }}>Ví của tôi</h1>
          <button onClick={loadData} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-text-muted)' }}>
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {toast && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, marginBottom: 16,
            background: toast.ok ? '#22c55e15' : '#ef444415',
            border: `1px solid ${toast.ok ? '#22c55e40' : '#ef444440'}` }}>
            {toast.ok ? <CheckCircle2 size={15} color="#22c55e" /> : <AlertCircle size={15} color="#ef4444" />}
            <p style={{ margin: 0, fontSize: 13, color: toast.ok ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{toast.msg}</p>
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, background: '#ef444415', border: '1px solid #ef444440', marginBottom: 20 }}>
            <AlertCircle size={15} color="#ef4444" />
            <p style={{ margin: 0, fontSize: 13, color: '#ef4444' }}>{error}</p>
          </div>
        )}

        {/* Balance card */}
        <div style={{ ...card, background: 'linear-gradient(135deg, #FF4C4C 0%, #c0392b 100%)', border: 'none', marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Số dư ví</p>
          <p style={{ margin: '8px 0 20px', fontSize: 36, fontWeight: 800, color: '#fff' }}>
            {loading ? '...' : fmtVND(balance)}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setModal('deposit')}
              style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, backdropFilter: 'blur(4px)' }}>
              <Plus size={14} /> Nạp tiền
            </button>
            <button onClick={() => setModal('withdraw')}
              style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, backdropFilter: 'blur(4px)' }}>
              <ArrowUpRight size={14} /> Rút tiền
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button style={tabBtn('overview')} onClick={() => setTab('overview')}>Tổng quan</button>
          <button style={tabBtn('history')} onClick={() => setTab('history')}>Lịch sử</button>
          <button style={tabBtn('banks')} onClick={() => setTab('banks')}>Ngân hàng</button>
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div style={card}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--lp-text)' }}>Giao dịch gần đây</h3>
            {loading ? (
              <p style={{ textAlign: 'center', padding: '24px 0', color: 'var(--lp-text-muted)', fontSize: 13 }}>Đang tải...</p>
            ) : transactions.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '24px 0', color: 'var(--lp-text-muted)', fontSize: 13 }}>Chưa có giao dịch nào.</p>
            ) : (
              transactions.slice(0, 5).map(tx => <TxRow key={tx.id} tx={tx} />)
            )}
            {transactions.length > 5 && (
              <button onClick={() => setTab('history')}
                style={{ marginTop: 12, width: '100%', padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--lp-input-bg)', color: 'var(--lp-text-muted)', border: '1px solid var(--lp-border)' }}>
                Xem tất cả giao dịch
              </button>
            )}
          </div>
        )}

        {/* History */}
        {tab === 'history' && (
          <div style={card}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--lp-text)' }}>Lịch sử giao dịch</h3>
            {loading ? (
              <p style={{ textAlign: 'center', padding: '24px 0', color: 'var(--lp-text-muted)', fontSize: 13 }}>Đang tải...</p>
            ) : transactions.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '24px 0', color: 'var(--lp-text-muted)', fontSize: 13 }}>Chưa có giao dịch nào.</p>
            ) : (
              transactions.map(tx => <TxRow key={tx.id} tx={tx} />)
            )}
          </div>
        )}

        {/* Banks */}
        {tab === 'banks' && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--lp-text)' }}>Tài khoản ngân hàng</h3>
              <button onClick={() => setModal('addBank')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#FF4C4C', color: '#fff', border: 'none' }}>
                <Plus size={13} /> Thêm
              </button>
            </div>
            {loading ? (
              <p style={{ textAlign: 'center', padding: '24px 0', color: 'var(--lp-text-muted)', fontSize: 13 }}>Đang tải...</p>
            ) : banks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <Building2 size={36} color="var(--lp-text-faint)" style={{ margin: '0 auto 10px' }} />
                <p style={{ margin: 0, fontSize: 13, color: 'var(--lp-text-muted)' }}>Chưa có tài khoản ngân hàng nào.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {banks.map(b => (
                  <div key={b.id} style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--lp-input-bg)', border: `1px solid ${b.isDefault ? '#FF4C4C' : 'var(--lp-border)'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: b.isDefault ? '#FF4C4C22' : 'var(--lp-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CreditCard size={18} color={b.isDefault ? '#FF4C4C' : 'var(--lp-text-muted)'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--lp-text)' }}>{b.bankName}</p>
                        {b.isDefault && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: '#FF4C4C', color: '#fff' }}>Mặc định</span>}
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--lp-text-muted)' }}>{b.accountNumber} — {b.accountName}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!b.isDefault && (
                        <button onClick={() => handleSetDefault(b.id)} disabled={settingDefaultId === b.id}
                          title="Đặt làm mặc định"
                          style={{ padding: '6px 8px', borderRadius: 8, background: 'none', border: '1px solid var(--lp-border)', cursor: 'pointer', color: 'var(--lp-text-muted)', opacity: settingDefaultId === b.id ? 0.5 : 1 }}>
                          <Star size={14} />
                        </button>
                      )}
                      <button onClick={() => handleDeleteBank(b.id)} disabled={deletingId === b.id}
                        title="Xóa"
                        style={{ padding: '6px 8px', borderRadius: 8, background: 'none', border: '1px solid #ef444440', cursor: 'pointer', color: '#ef4444', opacity: deletingId === b.id ? 0.5 : 1 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal === 'deposit' && token && (
        <DepositModal token={token} onClose={() => setModal(null)} onSuccess={() => { setModal(null); loadData(); }} />
      )}
      {modal === 'withdraw' && token && (
        <WithdrawModal balance={balance} bankAccounts={banks} token={token} onClose={() => setModal(null)} onSuccess={() => { setModal(null); loadData(); }} />
      )}
      {modal === 'addBank' && token && (
        <AddBankModal token={token} onClose={() => setModal(null)} onSuccess={() => loadData()} />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function TxRow({ tx }: { tx: WalletTransaction }) {
  const isIn = tx.type === 'Deposit' || tx.type === 'Refund';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--lp-border)' }}>
      {txIcon(tx.type, tx.amount)}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--lp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {TX_LABELS[tx.type] ?? tx.type}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--lp-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tx.description ?? fmtDate(tx.createdAt)}
        </p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: isIn ? '#22c55e' : '#ef4444' }}>
          {isIn ? '+' : '-'}{fmtVND(tx.amount)}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--lp-text-faint)' }}>{fmtDate(tx.createdAt)}</p>
      </div>
    </div>
  );
}
