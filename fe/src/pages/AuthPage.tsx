import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useEffect } from 'react';
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

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
                        : 'border-white/10 text-white placeholder:text-gray-500 focus:border-[#00C2FF] focus:ring-2 focus:ring-[#00C2FF]/20'
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
      {/* Hiển thị lỗi ngay bên dưới input */}
      <div className={`overflow-hidden transition-all duration-300 ${hasError ? 'max-h-10 opacity-100 mt-1.5' : 'max-h-0 opacity-0'}`}>
        <p className="text-xs text-red-400">{error}</p>
      </div>
    </div>
  );
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

const loginSchema = Yup.object().shape({
  username: Yup.string()
    .required('Vui lòng nhập tên đăng nhập (username)'),
  password: Yup.string()
    .required('Vui lòng nhập mật khẩu'),
});

const registerSchema = Yup.object().shape({
  username: Yup.string()
    .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự')
    .required('Vui lòng nhập tên đăng nhập'),
  fullName: Yup.string()
    .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
    .required('Vui lòng nhập họ và tên'),
  email: Yup.string()
    .email('Email không hợp lệ')
    .nullable(),
  phoneNumber: Yup.string()
    .nullable(),
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
  const { login, register, loading, error: apiError, loginWithGoogle } = useAuth();

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn('VITE_GOOGLE_CLIENT_ID is not set. Google Sign-In disabled.');
      return;
    }

    function handleCredentialResponse(response: any) {
      const idToken = response?.credential;
      if (idToken) {
        // Login using hook
        loginWithGoogle(idToken)
          .then(() => {
            navigate('/');
          })
          .catch(() => {
            // error handled in hook
          });
      }
    }

    // Load Google Identity Services script if not present
    if (!(window as any).google) {
      const id = 'google-identity';
      if (!document.getElementById(id)) {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.defer = true;
        s.id = id;
        s.onload = () => {
          (window as any).google?.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
          });
          // Render button into placeholder
          const container = document.getElementById('googleSignInDiv');
          if (container) {
            (window as any).google.accounts.id.renderButton(container, { theme: 'outline', size: 'large' });
          }
        };
        document.body.appendChild(s);
      }
    } else {
      (window as any).google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
      });
      const container = document.getElementById('googleSignInDiv');
      if (container) {
        (window as any).google.accounts.id.renderButton(container, { theme: 'outline', size: 'large' });
      }
    }
  }, [loginWithGoogle, navigate]);

  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Khởi tạo Formik
  const formik = useFormik({
    initialValues: {
      username: '',
      fullName: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
    },
    validationSchema: mode === 'login' ? loginSchema : registerSchema,
    onSubmit: async (values, { setSubmitting }) => {
      if (mode === 'login') {
        try {
          await login({ username: values.username, password: values.password });
          navigate('/');
        } catch {
          // apiError đã được hook useAuth xử lý
        }
      } else {
        try {
          await register({
            username: values.username,
            password: values.password,
            fullName: values.fullName,
            email: values.email.trim() || null,
            phoneNumber: values.phoneNumber.trim() || null,
          });
          navigate('/');
        } catch {
          // apiError đã được hook useAuth xử lý
        }
      }
      setSubmitting(false);
    },
  });

  const switchMode = (next: AuthMode) => {
    setMode(next);
    formik.resetForm();
    setShowPassword(false);
  };

  const handleSocialAuth = (provider: string) => {
    alert(`${provider} OAuth chưa được cấu hình.`);
  };

  const handleGoogleClick = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      alert('VITE_GOOGLE_CLIENT_ID chưa được cấu hình. Vui lòng thêm Client ID vào .env');
      return;
    }

    if ((window as any).google && (window as any).google.accounts?.id) {
      try {
        (window as any).google.accounts.id.prompt();
      } catch {
        // If prompt fails, try clicking rendered button if exists
        const btn = document.querySelector('#googleSignInDiv button') as HTMLButtonElement | null;
        if (btn) btn.click();
      }
    } else {
      alert('Google Sign-In chưa sẵn sàng. Thử refresh trang.');
    }
  };

  return (
    <div className="min-h-screen bg-[#101A31] flex overflow-hidden text-white">

      {/* ── Left Panel ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00C2FF]/20 via-transparent to-[#3BFFA4]/20" />
        <div className="blob top-20 left-20 w-96 h-96 bg-[#00C2FF]/25 animate-pulse" />
        <div className="blob bottom-20 right-20 w-80 h-80 bg-[#3BFFA4]/25 animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-center">
          {/* Logo visual */}
          <div className="mb-10 w-full max-w-xs">
            <div className="relative rounded-3xl overflow-hidden glass-card p-1">
              <div className="h-56 rounded-2xl bg-gradient-to-br from-[#00C2FF]/30 to-[#3BFFA4]/20 flex items-center justify-center">
                <div className="relative">
                  <div className="w-36 h-36 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4] opacity-70 blur-xl absolute -inset-4" />
                  <div className="relative z-10 w-28 h-28 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4] flex items-center justify-center shadow-2xl shadow-[#00C2FF]/40">
                    <Sparkles className="w-14 h-14 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <h1 className="text-5xl font-extrabold mb-4 leading-tight">
            Welcome to
            <span className="block gradient-text">SmartPark</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md">
            Intelligent parking management powered by AI.
            Join thousands of facilities worldwide.
          </p>

          <div className="mt-10 flex items-center justify-center gap-10">
            {[
              { value: '500+',  label: 'Facilities', color: 'text-[#00C2FF]' },
              { value: '1M+',   label: 'Users',      color: 'text-[#3BFFA4]' },
              { value: '99.9%', label: 'Uptime',     color: 'text-[#00C2FF]' },
            ].map((s) => (
              <div key={s.label}>
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-sm text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel (Form) ──────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative">
        {/* Back button */}
        <Link
          to="/"
          className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-gray-400
                     hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="w-full max-w-md">
          {/* Card */}
          <div className="p-8 rounded-3xl backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl">

            {/* Logo */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="p-2 bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4] rounded-lg shadow-lg shadow-[#00C2FF]/30">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">SmartPark</span>
            </div>

            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">
                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-gray-400 text-sm">
                {mode === 'login'
                  ? 'Sign in to continue to your dashboard'
                  : 'Get started with SmartPark today'}
              </p>
            </div>

            {/* Social buttons */}
            <div className="grid grid-cols-2 gap-3 mb-5 items-center">
              <button
                type="button"
                onClick={handleGoogleClick}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                           bg-white/5 border border-white/10 text-sm text-white font-medium
                           hover:bg-white/10 hover:border-[#00C2FF]/50 transition-all duration-200"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
              <button
                type="button"
                onClick={() => handleSocialAuth('GitHub')}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                           bg-white/5 border border-white/10 text-sm text-white font-medium
                           hover:bg-white/10 hover:border-[#00C2FF]/50 transition-all duration-200"
              >
                <GitHubIcon className="w-4 h-4" />
                GitHub
              </button>
            </div>
            {/* Hidden container for Google Identity to render into (kept for compatibility) */}
            <div id="googleSignInDiv" className="hidden" />

            {/* Divider */}
            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 bg-[#101A31]/90 text-xs text-gray-500">or continue with</span>
              </div>
            </div>

            {/* API error */}
            {apiError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{apiError}</span>
              </div>
            )}

            {/* ── Formik Form ──────────────────────────────────────────────── */}
            <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>

              {/* Username */}
              <FormikField
                id="username"
                name="username"
                label="Username"
                type="text"
                placeholder="your_username"
                icon={<User className="w-4 h-4" />}
                autoComplete="username"
                value={formik.values.username}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.username}
                touched={formik.touched.username}
              />

              {mode === 'register' && (
                <FormikField
                  id="fullName"
                  name="fullName"
                  label="Full name"
                  type="text"
                  placeholder="Nguyễn Văn A"
                  icon={<User className="w-4 h-4" />}
                  autoComplete="name"
                  value={formik.values.fullName}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.errors.fullName}
                  touched={formik.touched.fullName}
                />
              )}

              {mode === 'register' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormikField
                    id="email"
                    name="email"
                    label="Email"
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
                    id="phoneNumber"
                    name="phoneNumber"
                    label="Phone number"
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
              )}

              {/* Password */}
              <FormikField
                id="password"
                name="password"
                label="Password"
                placeholder="••••••••"
                icon={<Lock className="w-4 h-4" />}
                showToggle
                showValue={showPassword}
                onToggle={() => setShowPassword((p) => !p)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.password}
                touched={formik.touched.password}
              />

              {/* Confirm Password (chỉ hiện ở mode register) */}
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  mode === 'register' ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <FormikField
                  id="confirmPassword"
                  name="confirmPassword"
                  label="Confirm Password"
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

              {/* Remember me / Forgot (chỉ hiện ở mode login) */}
              {mode === 'login' && (
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <div
                      onClick={() => setRememberMe((r) => !r)}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-200
                        ${rememberMe
                          ? 'bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4] border-transparent'
                          : 'border-white/30 bg-white/5 group-hover:border-[#00C2FF]/50'}`}
                    >
                      {rememberMe && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sr-only"
                    />
                    <span className="text-sm text-gray-400">Remember me</span>
                  </label>
                  <a href="#" className="text-sm text-[#00C2FF] hover:underline hover:text-[#3BFFA4] transition-colors">
                    Forgot password?
                  </a>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || formik.isSubmitting}
                className="w-full mt-2 py-3 rounded-xl font-semibold text-sm text-white
                           bg-gradient-to-r from-[#00C2FF] to-[#3BFFA4]
                           hover:opacity-90 active:scale-[0.98]
                           shadow-lg shadow-[#00C2FF]/30 hover:shadow-[#00C2FF]/50
                           transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {loading || formik.isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Please wait…
                  </span>
                ) : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            {/* Toggle Mode */}
            <div className="mt-5 text-center">
              <p className="text-sm text-gray-400">
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                  className="text-[#00C2FF] hover:text-[#3BFFA4] hover:underline font-semibold transition-colors"
                >
                  {mode === 'login' ? 'Sign Up' : 'Log In'}
                </button>
              </p>
            </div>
          </div>

          {/* Terms */}
          <p className="text-center text-xs text-gray-500 mt-5 leading-relaxed">
            By continuing, you agree to SmartPark's{' '}
            <a href="#" className="text-[#00C2FF] hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-[#00C2FF] hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
