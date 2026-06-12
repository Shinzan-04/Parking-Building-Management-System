import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Eye, EyeOff,
  Lock, User,
  Mail, Phone,
  ArrowLeft, Sparkles,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthMode = 'login' | 'register';
type AuthRole = 'Admin' | 'Manager' | 'Staff' | 'Driver' | 0 | 1 | 2 | 3;

function getPostLoginPath(role: AuthRole): string {
  if (role === 'Admin'   || role === 0) return '/admin';
  if (role === 'Manager' || role === 1) return '/manager';
  if (role === 'Staff'   || role === 2) return '/gate-control';
  return '/';
}

// ─── Sub-component: Form Field ────────────────────────────────────────────────

interface FieldProps {
  id: string;
  name: string;
  label: string;
  type?: string;
  placeholder: string;
  icon: React.ReactNode;
  showToggle?: boolean;
  showValue?: boolean;
  onToggle?: () => void;
  autoComplete?: string;
  value: string;
  onChange: any;
  onBlur: any;
  error?: string;
  touched?: boolean;
}

function FormikField({
  id, name, label, type = 'text', placeholder, icon,
  showToggle, showValue, onToggle, autoComplete,
  value, onChange, onBlur, error, touched
}: FieldProps) {
  const hasError = touched && Boolean(error);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          {icon}
        </span>
        <input
          id={id}
          name={name}
          type={showToggle ? (showValue ? 'text' : 'password') : type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full pl-10 pr-10 py-3 rounded-xl bg-white/5 border text-sm outline-none transition-all duration-200
            ${hasError
              ? 'border-red-500/50 text-red-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
              : 'border-white/10 text-white placeholder:text-gray-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
            }`}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            aria-label={showValue ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      <div className={`overflow-hidden transition-all duration-300 ${hasError ? 'max-h-10 opacity-100 mt-1.5' : 'max-h-0 opacity-0'}`}>
        <p className="text-xs text-red-400">{error}</p>
      </div>
    </div>
  );
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

const loginSchema = Yup.object().shape({
  username: Yup.string().required('Vui lòng nhập tên đăng nhập (username)'),
  password: Yup.string().required('Vui lòng nhập mật khẩu'),
});

// Email bắt buộc khi đăng ký vì flow OTP cần gửi mail xác thực
const registerSchema = Yup.object().shape({
  username: Yup.string()
    .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự')
    .required('Vui lòng nhập tên đăng nhập'),
  fullName: Yup.string()
    .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
    .required('Vui lòng nhập họ và tên'),
  email: Yup.string()
    .email('Email không hợp lệ')
    .required('Vui lòng nhập email để nhận mã xác thực OTP'),
  phoneNumber: Yup.string().nullable(),
  password: Yup.string()
    .min(6, 'Mật khẩu phải có ít nhất 6 ký tự')
    .required('Vui lòng nhập mật khẩu'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Mật khẩu xác nhận không khớp')
    .required('Vui lòng xác nhận mật khẩu'),
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, login, loading, error: apiError, loginWithGoogle } = useAuth();

  // Loading/lỗi riêng cho bước gửi OTP
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError]     = useState<string | null>(null);

  // Redirect nếu đã đăng nhập
  useEffect(() => {
    if (user) navigate(getPostLoginPath(user.role as AuthRole), { replace: true });
  }, [user, navigate]);

  // Khởi tạo Google Sign-In SDK
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn('VITE_GOOGLE_CLIENT_ID chưa được cài đặt. Google Sign-In bị tắt.');
      return;
    }

    function handleCredentialResponse(response: any) {
      const idToken = response?.credential;
      if (idToken) {
        loginWithGoogle(idToken)
          .then((authResponse) => navigate(getPostLoginPath(authResponse.role as AuthRole)))
          .catch(() => {});
      }
    }

    const initGoogle = () => {
      (window as any).google?.accounts.id.initialize({ client_id: clientId, callback: handleCredentialResponse });
      const container = document.getElementById('googleSignInDiv');
      if (container) {
        (window as any).google?.accounts.id.renderButton(container, { theme: 'outline', size: 'large' });
      }
    };

    if (!(window as any).google) {
      const id = 'google-identity';
      if (!document.getElementById(id)) {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true; s.defer = true; s.id = id;
        s.onload = initGoogle;
        document.body.appendChild(s);
      }
    } else {
      initGoogle();
    }
  }, [loginWithGoogle, navigate]);

  const [mode, setMode]               = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]   = useState(false);

  // ─── Formik ───────────────────────────────────────────────────────────────
  const formik = useFormik({
    initialValues: {
      username: '', fullName: '', email: '',
      phoneNumber: '', password: '', confirmPassword: '',
    },
    validationSchema: mode === 'login' ? loginSchema : registerSchema,
    onSubmit: async (values, { setSubmitting }) => {
      if (mode === 'login') {
        // ── Đăng nhập ──────────────────────────────────────────────────────
        try {
          const authResponse = await login({ username: values.username, password: values.password });
          navigate(getPostLoginPath(authResponse.role as AuthRole));
        } catch {
          // lỗi đã được hook useAuth xử lý vào apiError
        }
      } else {
        // ── Đăng ký → gửi OTP → chuyển sang trang verify ─────────────────
        setOtpLoading(true);
        setOtpError(null);
        try {
          const { sendOtpApi } = await import('../services/authService');
          await sendOtpApi({ email: values.email, purpose: 'Register' });

          // Chuyển sang trang xác thực OTP, mang theo toàn bộ thông tin đăng ký
          navigate('/verify-email', {
            state: {
              purpose: 'Register',
              email: values.email,
              registrationData: {
                username: values.username,
                password: values.password,
                fullName: values.fullName,
                email: values.email,
                phoneNumber: values.phoneNumber.trim() || null,
              },
            },
          });
        } catch (err) {
          setOtpError(err instanceof Error ? err.message : 'Gửi OTP thất bại. Vui lòng thử lại.');
        } finally {
          setOtpLoading(false);
        }
      }
      setSubmitting(false);
    },
  });

  const switchMode = (next: AuthMode) => {
    setMode(next);
    formik.resetForm();
    setShowPassword(false);
    setOtpError(null);
  };

  const handleGoogleClick = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) { alert('VITE_GOOGLE_CLIENT_ID chưa được cấu hình. Vui lòng thêm vào .env'); return; }
    if ((window as any).google?.accounts?.id) {
      try { (window as any).google.accounts.id.prompt(); }
      catch { (document.querySelector('#googleSignInDiv button') as HTMLButtonElement | null)?.click(); }
    } else {
      alert('Google Sign-In chưa sẵn sàng. Thử refresh trang.');
    }
  };

  const isWorking    = loading || formik.isSubmitting || otpLoading;
  const displayError = mode === 'register' ? (otpError ?? apiError) : apiError;

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0C] flex overflow-hidden text-white">

      {/* ── Left Panel ──────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/10" />
        <div className="blob top-20 left-20 w-96 h-96 bg-amber-500/10 animate-pulse" />
        <div className="blob bottom-20 right-20 w-80 h-80 bg-orange-500/10 animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-center">
          {/* Logo visual */}
          <div className="mb-10 w-full max-w-xs">
            <div className="relative rounded-3xl overflow-hidden glass-card p-1">
              <div className="h-56 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/15 flex items-center justify-center">
                <div className="relative">
                  <div className="w-36 h-36 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 opacity-60 blur-xl absolute -inset-4" />
                  <div className="relative z-10 w-28 h-28 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-amber-500/40">
                    <Sparkles className="w-14 h-14 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <h1 className="text-5xl font-extrabold mb-4 leading-tight">
            Welcome to
            <span className="block text-amber-500 mt-2">PARKING BUILDING</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md">
            Intelligent parking management powered by AI.
            Join thousands of facilities worldwide.
          </p>

          <div className="mt-10 flex items-center justify-center gap-10">
            {[
              { value: '500+',  label: 'Facilities', color: 'text-amber-500' },
              { value: '1M+',   label: 'Users',      color: 'text-orange-500' },
              { value: '99.9%', label: 'Uptime',     color: 'text-amber-500' },
            ].map((s) => (
              <div key={s.label}>
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-sm text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel (Form) ──────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative">
        {/* Nút quay về trang chủ */}
        <Link
          to="/"
          className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-gray-400
                     hover:text-amber-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
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
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">
                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-gray-400 text-sm">
                {mode === 'login'
                  ? 'Sign in to continue to your dashboard'
                  : 'Get started with PARKING BUILDING today'}
              </p>
            </div>

            {/* Google Sign-In button */}
            <div className="mb-5">
              <button
                type="button"
                onClick={handleGoogleClick}
                className="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl
                           bg-white/5 border border-white/10 text-sm text-white font-medium
                           hover:bg-white/10 hover:border-amber-500/50 transition-all duration-200"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
            </div>
            {/* Container ẩn cho Google Identity SDK render vào */}
            <div id="googleSignInDiv" className="hidden" />

            {/* Divider */}
            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 bg-[#121214] text-xs text-gray-500">or continue with</span>
              </div>
            </div>

            {/* Thông báo lỗi */}
            {displayError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{displayError}</span>
              </div>
            )}

            {/* Thông báo OTP khi đang ở chế độ đăng ký */}
            {mode === 'register' && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                <span className="mt-0.5 shrink-0">📧</span>
                <span>
                  Sau khi điền form, mã OTP sẽ được gửi tới <strong>email</strong> của bạn
                  để xác thực tài khoản. Email là bắt buộc.
                </span>
              </div>
            )}

            {/* ── Form ──────────────────────────────────────────────────── */}
            <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>

              {/* Username */}
              <FormikField
                id="username" name="username" label="Username"
                placeholder="your_username"
                icon={<User className="w-4 h-4" />}
                autoComplete="username"
                value={formik.values.username}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.username}
                touched={formik.touched.username}
              />

              {/* Chỉ hiện khi register */}
              {mode === 'register' && (
                <>
                  <FormikField
                    id="fullName" name="fullName" label="Full name"
                    placeholder="Nguyễn Văn A"
                    icon={<User className="w-4 h-4" />}
                    autoComplete="name"
                    value={formik.values.fullName}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.errors.fullName}
                    touched={formik.touched.fullName}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormikField
                      id="email" name="email" label="Email *"
                      type="email"
                      placeholder="you@example.com"
                      icon={<Mail className="w-4 h-4" />}
                      autoComplete="email"
                      value={formik.values.email}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.errors.email}
                      touched={formik.touched.email}
                    />
                    <FormikField
                      id="phoneNumber" name="phoneNumber" label="Phone number"
                      type="tel"
                      placeholder="0901234567"
                      icon={<Phone className="w-4 h-4" />}
                      autoComplete="tel"
                      value={formik.values.phoneNumber}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.errors.phoneNumber}
                      touched={formik.touched.phoneNumber}
                    />
                  </div>
                </>
              )}

              {/* Password */}
              <FormikField
                id="password" name="password" label="Password"
                placeholder="••••••••"
                icon={<Lock className="w-4 h-4" />}
                showToggle showValue={showPassword}
                onToggle={() => setShowPassword((p) => !p)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.password}
                touched={formik.touched.password}
              />

              {/* Confirm Password — chỉ ở register */}
              <div className={`overflow-hidden transition-all duration-300 ${mode === 'register' ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
                <FormikField
                  id="confirmPassword" name="confirmPassword" label="Confirm Password"
                  placeholder="••••••••"
                  icon={<Lock className="w-4 h-4" />}
                  autoComplete="new-password"
                  value={formik.values.confirmPassword}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.errors.confirmPassword}
                  touched={formik.touched.confirmPassword}
                />
              </div>

              {/* Remember me / Forgot Password — chỉ ở login */}
              {mode === 'login' && (
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <div
                      onClick={() => setRememberMe((r) => !r)}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-200
                        ${rememberMe ? 'bg-amber-500 border-transparent' : 'border-white/30 bg-white/5 group-hover:border-amber-500/50'}`}
                    >
                      {rememberMe && (
                        <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="sr-only" />
                    <span className="text-sm text-gray-400">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-sm text-amber-500 hover:underline hover:text-amber-400 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isWorking}
                className="w-full mt-2 py-3 rounded-xl font-semibold text-sm text-black
                           bg-gradient-to-r from-amber-500 to-orange-500
                           hover:opacity-95 active:scale-[0.98]
                           shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40
                           transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {isWorking ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    {mode === 'register' ? 'Đang gửi OTP…' : 'Please wait…'}
                  </span>
                ) : mode === 'login' ? 'Sign In' : 'Tiếp theo — Xác thực Email'}
              </button>
            </form>

            {/* Toggle mode */}
            <div className="mt-5 text-center">
              <p className="text-sm text-gray-400">
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                  className="text-amber-500 hover:text-amber-400 hover:underline font-semibold transition-colors"
                >
                  {mode === 'login' ? 'Sign Up' : 'Log In'}
                </button>
              </p>
            </div>
          </div>

          {/* Terms */}
          <p className="text-center text-xs text-gray-500 mt-5 leading-relaxed">
            By continuing, you agree to PARKING BUILDING's{' '}
            <a href="#" className="text-amber-500 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-amber-500 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
