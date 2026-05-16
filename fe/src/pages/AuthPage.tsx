import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

// Inline GitHub brand icon (not in lucide-react)
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthMode = 'login' | 'register';

interface ValidationState {
  isValid: boolean;
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculatePasswordStrength(pwd: string): number {
  let strength = 0;
  if (pwd.length >= 8) strength++;
  if (pwd.length >= 12) strength++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
  if (/\d/.test(pwd)) strength++;
  if (/[^a-zA-Z0-9]/.test(pwd)) strength++;
  return strength;
}

function getStrengthInfo(strength: number): { label: string; colorBar: string; colorText: string } {
  if (strength === 0) return { label: 'Very Weak',   colorBar: 'bg-red-500',       colorText: 'text-red-500' };
  if (strength === 1) return { label: 'Weak',        colorBar: 'bg-orange-500',    colorText: 'text-orange-500' };
  if (strength === 2) return { label: 'Fair',        colorBar: 'bg-yellow-500',    colorText: 'text-yellow-500' };
  if (strength === 3) return { label: 'Good',        colorBar: 'bg-blue-400',      colorText: 'text-blue-400' };
  if (strength === 4) return { label: 'Strong',      colorBar: 'bg-[#3BFFA4]',    colorText: 'text-[#3BFFA4]' };
  return              { label: 'Very Strong',         colorBar: 'bg-[#3BFFA4]',    colorText: 'text-[#3BFFA4]' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface InputFieldProps {
  id: string;
  type: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  validation?: ValidationState;
  showValue?: boolean;
  onToggleShow?: () => void;
  icon: React.ReactNode;
  label: string;
  rightIcon?: React.ReactNode;
}

function InputField({
  id,
  type,
  value,
  onChange,
  placeholder,
  validation,
  showValue,
  onToggleShow,
  icon,
  label,
  rightIcon,
}: InputFieldProps) {
  const borderClass =
    value && validation
      ? validation.isValid
        ? 'border-[#3BFFA4] focus:border-[#3BFFA4]'
        : 'border-red-500 focus:border-red-500'
      : 'border-white/10 focus:border-[#00C2FF]';

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-white mb-2">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          {icon}
        </span>
        <input
          id={id}
          type={showValue !== undefined ? (showValue ? 'text' : 'password') : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full pl-10 ${onToggleShow || rightIcon ? 'pr-10' : 'pr-4'} py-3 rounded-xl
            bg-white/5 border text-white placeholder:text-gray-500 text-sm
            outline-none transition-all duration-200 focus:ring-2 focus:ring-[#00C2FF]/20
            ${borderClass}`}
        />
        {rightIcon && !onToggleShow && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {rightIcon}
          </span>
        )}
        {onToggleShow && (
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            aria-label={showValue ? 'Hide password' : 'Show password'}
          >
            {showValue ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
      {value && validation?.message && (
        <p className={`text-xs mt-1.5 ${validation.isValid ? 'text-[#3BFFA4]' : 'text-red-400'}`}>
          {validation.message}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Validation
  const [emailValidation, setEmailValidation] = useState<ValidationState>({ isValid: true, message: '' });
  const [passwordValidation, setPasswordValidation] = useState<ValidationState>({ isValid: true, message: '' });

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) {
      setEmailValidation({ isValid: true, message: '' });
    } else if (!emailRegex.test(value)) {
      setEmailValidation({ isValid: false, message: 'Invalid email format' });
    } else {
      setEmailValidation({ isValid: true, message: 'Valid email' });
    }
  };

  const validatePassword = (value: string) => {
    if (!value) {
      setPasswordValidation({ isValid: true, message: '' });
    } else if (value.length < 8) {
      setPasswordValidation({ isValid: false, message: 'Password must be at least 8 characters' });
    } else {
      setPasswordValidation({ isValid: true, message: 'Password meets requirements' });
    }
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    validateEmail(e.target.value);
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    validatePassword(e.target.value);
  };

  const passwordStrength = calculatePasswordStrength(password);
  const strengthInfo = getStrengthInfo(passwordStrength);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Form submitted:', { mode, email, password, fullName });
  };

  const handleSocialAuth = (provider: string) => {
    console.log('Social auth:', provider);
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    // Reset form when switching
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setEmailValidation({ isValid: true, message: '' });
    setPasswordValidation({ isValid: true, message: '' });
  };

  const confirmMismatch = confirmPassword && confirmPassword !== password;
  const confirmMatch    = confirmPassword && confirmPassword === password;

  return (
    <div className="min-h-screen bg-[#101A31] flex overflow-hidden text-white">

      {/* ── Left Panel (decorative, desktop only) ───────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#00C2FF]/20 via-transparent to-[#3BFFA4]/20" />
        <div className="blob top-20 left-20 w-96 h-96 bg-[#00C2FF]/25 animate-pulse" />
        <div
          className="blob bottom-20 right-20 w-80 h-80 bg-[#3BFFA4]/25 animate-pulse"
          style={{ animationDelay: '1s' }}
        />

        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
          {/* Abstract visual */}
          <div className="mb-10 w-full max-w-sm">
            <div className="relative rounded-3xl overflow-hidden glass-card p-1">
              {/* Fake 3-D render placeholder using CSS art */}
              <div className="h-64 rounded-2xl bg-gradient-to-br from-[#00C2FF]/30 to-[#3BFFA4]/20 flex items-center justify-center">
                <div className="relative">
                  <div className="w-40 h-40 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4] opacity-80 blur-xl absolute -inset-4" />
                  <div className="relative z-10 w-32 h-32 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4] flex items-center justify-center shadow-2xl shadow-[#00C2FF]/40">
                    <Sparkles className="w-16 h-16 text-white drop-shadow-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-5xl font-extrabold text-white mb-4 leading-tight">
              Welcome to
              <span className="block gradient-text">SmartPark</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-md mx-auto">
              Intelligent parking management powered by AI.
              Join thousands of facilities worldwide.
            </p>

            {/* Stats */}
            <div className="mt-10 flex items-center justify-center gap-10">
              {[
                { value: '500+',  label: 'Facilities', color: 'text-[#00C2FF]' },
                { value: '1M+',   label: 'Users',      color: 'text-[#3BFFA4]' },
                { value: '99.9%', label: 'Uptime',     color: 'text-[#00C2FF]' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-sm text-gray-400 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel (form) ───────────────────────────────────────────────── */}
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

          {/* Glassmorphic card */}
          <div className="relative p-8 rounded-3xl backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl">

            {/* Logo */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="p-2 bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4] rounded-lg shadow-lg shadow-[#00C2FF]/30">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold">SmartPark</span>
            </div>

            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">
                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-gray-400 text-sm">
                {mode === 'login'
                  ? 'Sign in to continue to your dashboard'
                  : 'Get started with SmartPark today'}
              </p>
            </div>

            {/* Social auth */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => handleSocialAuth('google')}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                           bg-white/5 border border-white/10 text-sm text-white font-medium
                           hover:bg-white/10 hover:border-[#00C2FF]/50 transition-all duration-200"
              >
                {/* Google icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
              <button
                type="button"
                onClick={() => handleSocialAuth('github')}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                           bg-white/5 border border-white/10 text-sm text-white font-medium
                           hover:bg-white/10 hover:border-[#00C2FF]/50 transition-all duration-200"
              >
                <GitHubIcon className="w-5 h-5" />
                GitHub
              </button>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 bg-[#101A31]/80 text-xs text-gray-500 rounded-full border border-white/10">
                  or continue with email
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>

              {/* Full Name (register only) */}
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  mode === 'register' ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <InputField
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  icon={<User className="w-5 h-5" />}
                  label="Full Name"
                />
              </div>

              {/* Email */}
              <InputField
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="you@example.com"
                validation={emailValidation}
                icon={<Mail className="w-5 h-5" />}
                label="Email Address"
                rightIcon={
                  email
                    ? emailValidation.isValid
                      ? <CheckCircle2 className="w-5 h-5 text-[#3BFFA4]" />
                      : <XCircle className="w-5 h-5 text-red-500" />
                    : undefined
                }
              />

              {/* Password */}
              <div>
                <InputField
                  id="password"
                  type="password"
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="••••••••"
                  validation={passwordValidation}
                  showValue={showPassword}
                  onToggleShow={() => setShowPassword((p) => !p)}
                  icon={<Lock className="w-5 h-5" />}
                  label="Password"
                />

                {/* Password strength meter (register only) */}
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    mode === 'register' && password ? 'max-h-16 opacity-100 mt-3' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-400">Password Strength</span>
                    <span className={`text-xs font-semibold ${strengthInfo.colorText}`}>
                      {strengthInfo.label}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          i < passwordStrength ? strengthInfo.colorBar : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Confirm Password (register only) */}
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  mode === 'register' ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <Lock className="w-5 h-5" />
                    </span>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-10 pr-10 py-3 rounded-xl bg-white/5 border text-white
                        placeholder:text-gray-500 text-sm outline-none transition-all duration-200
                        focus:ring-2 focus:ring-[#00C2FF]/20
                        ${confirmMismatch ? 'border-red-500 focus:border-red-500'
                          : confirmMatch  ? 'border-[#3BFFA4] focus:border-[#3BFFA4]'
                          : 'border-white/10 focus:border-[#00C2FF]'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {confirmMismatch && (
                    <p className="text-xs text-red-400 mt-1.5">Passwords do not match</p>
                  )}
                </div>
              </div>

              {/* Remember me / Forgot password (login only) */}
              {mode === 'login' && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <div
                      className={`w-4 h-4 rounded border transition-all duration-200 flex items-center justify-center
                        ${rememberMe
                          ? 'bg-gradient-to-br from-[#00C2FF] to-[#3BFFA4] border-transparent'
                          : 'border-white/30 bg-white/5 group-hover:border-[#00C2FF]/50'}`}
                      onClick={() => setRememberMe((r) => !r)}
                    >
                      {rememberMe && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" aria-hidden="true">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      id="remember"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sr-only"
                    />
                    <span className="text-sm text-gray-400">Remember me</span>
                  </label>
                  <a
                    href="#"
                    className="text-sm text-[#00C2FF] hover:underline hover:text-[#3BFFA4] transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-3 rounded-xl font-semibold text-sm text-white
                           bg-gradient-to-r from-[#00C2FF] to-[#3BFFA4]
                           hover:opacity-90 active:scale-95
                           shadow-lg shadow-[#00C2FF]/30 hover:shadow-[#00C2FF]/50
                           transition-all duration-200"
              >
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            {/* Toggle mode */}
            <div className="mt-6 text-center">
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
          <p className="text-center text-xs text-gray-500 mt-6 leading-relaxed">
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
