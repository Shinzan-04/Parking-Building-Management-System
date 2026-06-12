import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, Mail, Lock,
  Eye, EyeOff, RefreshCw, KeyRound, CheckCircle2,
} from 'lucide-react';

// ─── Hằng số ─────────────────────────────────────────────────────────────────

const OTP_LENGTH   = 6;
const RESEND_DELAY = 60; // giây

// ─── Bước trong flow quên mật khẩu ──────────────────────────────────────────
// 1. send_email → nhập email → gửi OTP
// 2. enter_otp  → nhập 6 số OTP
// 3. new_password → đặt mật khẩu mới
// 4. done       → hoàn tất

type Step = 'send_email' | 'enter_otp' | 'new_password' | 'done';

// ─── Component: 6 ô nhập OTP ─────────────────────────────────────────────────

interface OtpInputProps {
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
  hasError?: boolean;
}

function OtpInput({ value, onChange, disabled, hasError }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (i: number, char: string) => {
    if (char && !/^\d$/.test(char)) return;
    const next = [...value];
    next[i] = char;
    onChange(next);
    if (char && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[i]) {
        const next = [...value]; next[i] = ''; onChange(next);
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
        const next = [...value]; next[i - 1] = ''; onChange(next);
      }
    } else if (e.key === 'ArrowLeft'  && i > 0)            refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const next = Array(OTP_LENGTH).fill('');
    text.split('').forEach((ch, i) => { next[i] = ch; });
    onChange(next);
    refs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
  };

  return (
    <div className="flex gap-3 justify-center">
      {Array.from({ length: OTP_LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={`
            w-12 h-14 text-center text-xl font-bold rounded-xl border
            outline-none transition-all duration-200 bg-white/5
            ${hasError
              ? 'border-red-500/60 text-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/30'
              : value[i]
                ? 'border-amber-500/70 text-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30'
                : 'border-white/10 text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
            }
            disabled:opacity-40 disabled:cursor-not-allowed
          `}
        />
      ))}
    </div>
  );
}

// ─── Component: Đồng hồ đếm ngược (key-reset pattern) ────────────────────────

function CountdownTimer({ seconds, onFinish }: { seconds: number; onFinish: () => void }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) { onFinish(); return; }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onFinish]);

  const pct = ((RESEND_DELAY - remaining) / RESEND_DELAY) * 100;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90">
        <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle
          cx="26" cy="26" r="22" fill="none" stroke="#f59e0b" strokeWidth="4"
          strokeDasharray={`${2 * Math.PI * 22}`}
          strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct / 100)}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="text-amber-400 text-xs font-mono">{remaining}s</span>
    </div>
  );
}

// ─── Component: Input mật khẩu ───────────────────────────────────────────────

function PasswordInput({
  id, label, value, onChange, placeholder, show, onToggle,
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; placeholder: string;
  show: boolean; onToggle: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/5 border border-white/10
                     text-white text-sm placeholder:text-gray-500
                     focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none
                     transition-all duration-200"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── Nút submit dùng chung ───────────────────────────────────────────────────

function SubmitButton({ loading, label, loadingLabel, disabled }: {
  loading: boolean; label: string; loadingLabel: string; disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full py-3 rounded-xl font-semibold text-sm text-black
                 bg-gradient-to-r from-amber-500 to-orange-500
                 hover:opacity-95 active:scale-[0.98]
                 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40
                 transition-all duration-200
                 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {loadingLabel}
        </span>
      ) : label}
    </button>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step,       setStep]      = useState<Step>('send_email');
  const [email,      setEmail]     = useState('');
  const [otp,        setOtp]       = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [newPw,      setNewPw]     = useState('');
  const [confirmPw,  setConfirmPw] = useState('');
  const [showNewPw,  setShowNewPw] = useState(false);
  const [showConfPw, setShowConPw] = useState(false);
  const [error,      setError]     = useState<string | null>(null);
  const [loading,    setLoading]   = useState(false);
  const [resendKey,  setResendKey] = useState(0);
  const [canResend,  setCanResend] = useState(false);

  const clearError = () => setError(null);

  // ── Bước 1: Gửi OTP tới email ──────────────────────────────────────────────
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Vui lòng nhập địa chỉ email.'); return; }
    setLoading(true); clearError();
    try {
      const { sendOtpApi } = await import('../services/authService');
      await sendOtpApi({ email: email.trim(), purpose: 'ForgotPassword' });
      setCanResend(false);
      setResendKey((k) => k + 1);
      setStep('enter_otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi OTP thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // ── Gửi lại OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (!canResend) return;
    setLoading(true); clearError();
    try {
      const { sendOtpApi } = await import('../services/authService');
      await sendOtpApi({ email, purpose: 'ForgotPassword' });
      setOtp(Array(OTP_LENGTH).fill(''));
      setCanResend(false);
      setResendKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi lại OTP thất bại.');
    } finally {
      setLoading(false);
    }
  };

  // ── Bước 2: Xác thực OTP ───────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < OTP_LENGTH) { setError('Vui lòng nhập đủ 6 chữ số OTP.'); return; }
    // Chuyển sang bước đặt mật khẩu mới (không cần gọi API ở đây,
    // OTP sẽ được xác thực khi gọi resetPasswordApi cùng với mật khẩu mới)
    clearError();
    setStep('new_password');
  };

  // ── Bước 3: Đặt mật khẩu mới ───────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6)    { setError('Mật khẩu mới phải có ít nhất 6 ký tự.'); return; }
    if (newPw !== confirmPw) { setError('Mật khẩu xác nhận không khớp.'); return; }

    setLoading(true); clearError();
    try {
      const { resetPasswordApi } = await import('../services/authService');
      await resetPasswordApi({ email, otpCode: otp.join(''), newPassword: newPw });
      setStep('done');
      setTimeout(() => navigate('/auth', { replace: true }), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đặt lại mật khẩu thất bại. Mã OTP có thể đã hết hạn.');
      // Nếu OTP hết hạn → quay về bước nhập OTP
      if ((err as Error).message?.toLowerCase().includes('otp')) {
        setTimeout(() => setStep('enter_otp'), 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Tiêu đề theo từng bước ─────────────────────────────────────────────────
  const stepMeta: Record<Step, { title: string; sub: string; icon: React.ReactNode }> = {
    send_email:   {
      title: 'Quên mật khẩu',
      sub:   'Nhập email đã đăng ký để nhận mã OTP',
      icon:  <Mail className="w-12 h-12 text-amber-500" />,
    },
    enter_otp:    {
      title: 'Nhập mã xác thực',
      sub:   `Mã 6 chữ số đã được gửi tới ${email}`,
      icon:  <KeyRound className="w-12 h-12 text-amber-500" />,
    },
    new_password: {
      title: 'Mật khẩu mới',
      sub:   'Đặt mật khẩu mới cho tài khoản của bạn',
      icon:  <Lock className="w-12 h-12 text-amber-500" />,
    },
    done: {
      title: 'Hoàn tất!',
      sub:   'Mật khẩu đã được đổi thành công.',
      icon:  <CheckCircle2 className="w-12 h-12 text-amber-500" />,
    },
  };

  const meta = stepMeta[step];

  // ─── Progress indicator (4 bước) ────────────────────────────────────────────
  const stepOrder: Step[] = ['send_email', 'enter_otp', 'new_password', 'done'];
  const currentIdx = stepOrder.indexOf(step);

  // ─── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0C] flex overflow-hidden text-white">

      {/* ── Left Panel ──────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/10" />
        <div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-amber-500/10 animate-pulse blur-3xl" />
        <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-orange-500/10 animate-pulse blur-3xl" style={{ animationDelay: '1.2s' }} />

        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-center">
          {/* Icon thay đổi theo bước */}
          <div className="mb-10">
            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/10
                            border border-amber-500/20 flex items-center justify-center mx-auto shadow-2xl
                            transition-all duration-500">
              {meta.icon}
            </div>
          </div>

          <h1 className="text-5xl font-extrabold mb-4 leading-tight">
            Lấy lại
            <span className="block text-amber-500 mt-2">quyền truy cập</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md leading-relaxed">
            Chỉ cần email đã đăng ký, bạn có thể đặt lại mật khẩu
            trong <strong className="text-amber-400">vài bước đơn giản</strong>.
          </p>

          {/* Progress steps */}
          <div className="mt-12 flex items-center gap-3">
            {(['Nhập email', 'Xác thực OTP', 'Mật khẩu mới', 'Hoàn tất'] as const).map((label, idx) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`flex flex-col items-center gap-1 transition-all duration-300`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                    ${idx < currentIdx  ? 'bg-amber-500 text-black'
                    : idx === currentIdx ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-400'
                                         : 'bg-white/5 border border-white/10 text-gray-500'}`}>
                    {idx < currentIdx ? '✓' : idx + 1}
                  </div>
                  <span className={`text-xs whitespace-nowrap ${idx <= currentIdx ? 'text-amber-400' : 'text-gray-500'}`}>
                    {label}
                  </span>
                </div>
                {idx < 3 && (
                  <div className={`w-8 h-0.5 mb-4 transition-all duration-300 ${idx < currentIdx ? 'bg-amber-500' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel ─────────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative">
        <Link
          to="/auth"
          className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-gray-400
                     hover:text-amber-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại đăng nhập
        </Link>

        <div className="w-full max-w-md">
          <div className="p-8 rounded-3xl backdrop-blur-xl bg-[#121214] border border-white/5 shadow-2xl">

            {/* Logo */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg shadow-lg shadow-amber-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-wider">
                PARKING <span className="text-amber-500">BUILDING</span>
              </span>
            </div>

            {/* Tiêu đề */}
            <div className="text-center mb-7">
              <h2 className="text-2xl font-bold text-white mb-2 transition-all duration-300">{meta.title}</h2>
              <p className="text-gray-400 text-sm transition-all duration-300">{meta.sub}</p>
            </div>

            {/* Lỗi */}
            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* ══ Bước 1: Nhập email ══════════════════════════════════════ */}
            {step === 'send_email' && (
              <form onSubmit={handleSendEmail} className="space-y-5">
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-300 mb-2">
                    Địa chỉ Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); clearError(); }}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10
                                 text-white text-sm placeholder:text-gray-500
                                 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none
                                 transition-all duration-200"
                    />
                  </div>
                </div>
                <SubmitButton loading={loading} label="Gửi mã OTP" loadingLabel="Đang gửi…" />
              </form>
            )}

            {/* ══ Bước 2: Nhập OTP ════════════════════════════════════════ */}
            {step === 'enter_otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="space-y-3">
                  <OtpInput
                    value={otp}
                    onChange={(v) => { setOtp(v); clearError(); }}
                    disabled={loading}
                    hasError={!!error}
                  />
                  <p className="text-center text-xs text-gray-500">
                    Nhập thủ công hoặc dán (Ctrl+V) mã từ email
                  </p>
                </div>

                {/* Timer / Gửi lại */}
                <div className="flex flex-col items-center gap-2">
                  {!canResend ? (
                    <>
                      <p className="text-xs text-gray-400">Gửi lại mã sau</p>
                      <CountdownTimer
                        key={resendKey}
                        seconds={RESEND_DELAY}
                        onFinish={() => setCanResend(true)}
                      />
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={loading}
                      className="flex items-center gap-2 text-sm text-amber-500 hover:text-amber-400
                                 font-semibold transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Gửi lại mã OTP
                    </button>
                  )}
                </div>

                <SubmitButton
                  loading={loading}
                  label="Xác nhận mã OTP"
                  loadingLabel="Đang kiểm tra…"
                  disabled={otp.join('').length < OTP_LENGTH}
                />

                {/* Đổi email */}
                <p className="text-center text-xs text-gray-500">
                  Email không đúng?{' '}
                  <button
                    type="button"
                    onClick={() => { setStep('send_email'); setOtp(Array(OTP_LENGTH).fill('')); clearError(); }}
                    className="text-amber-400 hover:underline font-medium"
                  >
                    Thay đổi email
                  </button>
                </p>
              </form>
            )}

            {/* ══ Bước 3: Mật khẩu mới ════════════════════════════════════ */}
            {step === 'new_password' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <PasswordInput
                  id="new-password"
                  label="Mật khẩu mới"
                  value={newPw}
                  onChange={(v) => { setNewPw(v); clearError(); }}
                  placeholder="Tối thiểu 6 ký tự"
                  show={showNewPw}
                  onToggle={() => setShowNewPw((v) => !v)}
                />
                <PasswordInput
                  id="confirm-password"
                  label="Xác nhận mật khẩu"
                  value={confirmPw}
                  onChange={(v) => { setConfirmPw(v); clearError(); }}
                  placeholder="Nhập lại mật khẩu mới"
                  show={showConfPw}
                  onToggle={() => setShowConPw((v) => !v)}
                />

                {/* Độ mạnh mật khẩu */}
                {newPw.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300
                          ${newPw.length >= (i === 0 ? 1 : i === 1 ? 4 : i === 2 ? 7 : 10)
                            ? i < 2 ? 'bg-red-400' : i < 3 ? 'bg-amber-400' : 'bg-green-400'
                            : 'bg-white/10'}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      {newPw.length < 4 ? 'Quá ngắn' : newPw.length < 7 ? 'Yếu' : newPw.length < 10 ? 'Trung bình' : 'Mạnh'}
                    </p>
                  </div>
                )}

                <SubmitButton loading={loading} label="Đặt lại mật khẩu" loadingLabel="Đang đặt lại…" />
              </form>
            )}

            {/* ══ Bước 4: Hoàn tất ════════════════════════════════════════ */}
            {step === 'done' && (
              <div className="flex flex-col items-center gap-5 py-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-500
                                flex items-center justify-center shadow-2xl shadow-amber-500/40 animate-pulse">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-white font-bold text-lg">Đặt lại mật khẩu thành công!</p>
                  <p className="text-gray-400 text-sm">Bạn có thể đăng nhập với mật khẩu mới.</p>
                </div>
                <p className="text-xs text-gray-500">Đang chuyển về trang đăng nhập…</p>
              </div>
            )}

            {/* Gợi ý spam (chỉ ở bước OTP) */}
            {step === 'enter_otp' && (
              <p className="mt-5 text-center text-xs text-gray-500 leading-relaxed">
                Không nhận được email? Kiểm tra thư mục{' '}
                <span className="text-amber-400 font-medium">Spam / Junk</span>.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
