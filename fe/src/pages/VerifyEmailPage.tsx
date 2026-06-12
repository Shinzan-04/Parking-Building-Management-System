import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { type BaseAuthResponse } from '../services/authService';
import { ArrowLeft, Sparkles, ShieldCheck, Mail, RefreshCw, CheckCircle2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegistrationData {
  username: string;
  password: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
}

interface LocationState {
  email: string;
  registrationData: RegistrationData;
}

type AuthRole = 'Admin' | 'Manager' | 'Staff' | 'Driver' | 0 | 1 | 2 | 3;

function getPostLoginPath(role: AuthRole): string {
  if (role === 'Admin'   || role === 0) return '/admin';
  if (role === 'Manager' || role === 1) return '/manager';
  if (role === 'Staff'   || role === 2) return '/gate-control';
  return '/';
}

// ─── Hằng số ─────────────────────────────────────────────────────────────────

const OTP_LENGTH   = 6;
const RESEND_DELAY = 60; // giây

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
    } else if (e.key === 'ArrowLeft'  && i > 0)             refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1)  refs.current[i + 1]?.focus();
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

// ─── Main Page: Xác thực email đăng ký ───────────────────────────────────────

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { saveSession } = useAuth();

  // Lấy dữ liệu đăng ký từ state navigate()
  const state = (location.state as LocationState | null);

  // Nếu không có state hợp lệ → redirect về trang đăng ký
  useEffect(() => {
    if (!state?.email || !state?.registrationData) {
      navigate('/auth', { replace: true });
    }
  }, [state, navigate]);

  if (!state?.email || !state?.registrationData) return null;

  const email = state.email;
  const regData = state.registrationData;

  return <VerifyOtpForm email={email} regData={regData} saveSession={saveSession} navigate={navigate} />;
}

// ─── Form nội dung (tách riêng để dùng hooks ổn) ─────────────────────────────

function VerifyOtpForm({
  email, regData, saveSession, navigate,
}: {
  email: string;
  regData: RegistrationData;
  saveSession: (r: BaseAuthResponse) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [otp,        setOtp]       = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [error,      setError]     = useState<string | null>(null);
  const [loading,    setLoading]   = useState(false);
  const [resendKey,  setResendKey] = useState(0);
  const [canResend,  setCanResend] = useState(false);
  const [done,       setDone]      = useState(false);

  // ─── Xác thực OTP ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < OTP_LENGTH) { setError('Vui lòng nhập đủ 6 chữ số OTP.'); return; }

    setLoading(true);
    setError(null);
    try {
      const { verifyRegisterApi } = await import('../services/authService');
      const response = await verifyRegisterApi({
        email:       regData.email,
        otpCode:     code,
        username:    regData.username,
        password:    regData.password,
        fullName:    regData.fullName,
        phoneNumber: regData.phoneNumber,
      });
      // Lưu session vào React context + localStorage
      saveSession(response);
      setDone(true);
      setTimeout(() => {
        navigate(getPostLoginPath(response.role as AuthRole), { replace: true });
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mã OTP không hợp lệ hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Gửi lại OTP ───────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (!canResend) return;
    setLoading(true);
    setError(null);
    try {
      const { sendOtpApi } = await import('../services/authService');
      await sendOtpApi({ email, purpose: 'Register' });
      setOtp(Array(OTP_LENGTH).fill(''));
      setCanResend(false);
      setResendKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi lại OTP thất bại.');
    } finally {
      setLoading(false);
    }
  };

  // ─── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0C] flex overflow-hidden text-white">

      {/* ── Left Panel ──────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/10" />
        <div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-amber-500/10 animate-pulse blur-3xl" />
        <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-orange-500/10 animate-pulse blur-3xl" style={{ animationDelay: '1.2s' }} />

        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-center">
          <div className="mb-10">
            <div className="relative">
              <div className="w-40 h-40 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center mx-auto shadow-2xl">
                <ShieldCheck className="w-20 h-20 text-amber-500" />
              </div>
              <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/40">
                <Mail className="w-5 h-5 text-black" />
              </div>
            </div>
          </div>

          <h1 className="text-5xl font-extrabold mb-4 leading-tight">
            Xác thực
            <span className="block text-amber-500 mt-2">tài khoản của bạn</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md leading-relaxed">
            Chúng tôi đã gửi mã xác thực 6 chữ số tới email của bạn.
            Mã có hiệu lực <strong className="text-amber-400">5 phút</strong>.
          </p>

          <div className="mt-10 flex items-center justify-center gap-10">
            {[
              { value: '6',     label: 'Chữ số',   color: 'text-amber-500'  },
              { value: '5 min', label: 'Hiệu lực', color: 'text-orange-500' },
              { value: '100%',  label: 'Bảo mật',  color: 'text-amber-500'  },
            ].map((s) => (
              <div key={s.label}>
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-sm text-gray-400 mt-0.5">{s.label}</p>
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
          Quay lại đăng ký
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

            {!done ? (
              <>
                {/* Tiêu đề */}
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-white mb-2">Xác thực Email</h2>
                  <p className="text-gray-400 text-sm">
                    Mã OTP đã được gửi tới
                  </p>
                  <p className="text-amber-400 text-sm font-semibold mt-1 break-all">{email}</p>
                </div>

                {/* Lỗi */}
                {error && (
                  <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">⚠</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Form OTP */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <OtpInput
                      value={otp}
                      onChange={(v) => { setOtp(v); setError(null); }}
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

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading || otp.join('').length < OTP_LENGTH}
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
                        Đang xác thực…
                      </span>
                    ) : 'Xác thực & Tạo tài khoản'}
                  </button>
                </form>

                {/* Gợi ý spam */}
                <p className="mt-6 text-center text-xs text-gray-500 leading-relaxed">
                  Không nhận được email? Kiểm tra thư mục{' '}
                  <span className="text-amber-400 font-medium">Spam / Junk</span>
                  {' '}hoặc nhấn Gửi lại ở trên.
                </p>
              </>
            ) : (
              /* Hoàn tất */
              <div className="flex flex-col items-center gap-5 py-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-500
                                flex items-center justify-center shadow-2xl shadow-amber-500/40 animate-pulse">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">Tài khoản đã được tạo!</p>
                  <p className="text-gray-400 text-sm mt-1">Chào mừng bạn tới PARKING BUILDING.</p>
                </div>
                <p className="text-xs text-gray-500">Đang chuyển hướng…</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
