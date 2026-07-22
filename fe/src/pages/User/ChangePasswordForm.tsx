import { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { KeyRound, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { sendOtpApi, changePasswordApi } from '../../services/authService';

export default function ChangePasswordForm({ email }: { email: string }) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendOtp = async () => {
    if (!email) {
      setErrorMsg('Email address is missing. Please update your email first.');
      return;
    }
    setIsSendingOtp(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await sendOtpApi({ email, purpose: 'ChangePassword' });
      setOtpSent(true);
      setCountdown(60);
      setSuccessMsg(`OTP sent to email ${email}.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const validationSchema = Yup.object().shape({
    otpCode: Yup.string()
      .length(6, 'OTP code must be 6 digits')
      .required('Please enter the OTP code'),
    newPassword: Yup.string()
      .min(6, 'New password must be at least 6 characters')
      .required('New password is required'),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref('newPassword')], 'Passwords do not match')
      .required('Please confirm your new password'),
  });

  const formik = useFormik({
    initialValues: {
      otpCode: '',
      newPassword: '',
      confirmPassword: '',
    },
    validationSchema,
    onSubmit: async (values, { resetForm }) => {
      setErrorMsg(null);
      setSuccessMsg(null);
      try {
        await changePasswordApi({
          otpCode: values.otpCode,
          newPassword: values.newPassword
        });
        setSuccessMsg('Password changed successfully!');
        setOtpSent(false);
        resetForm();
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to change password.');
      }
    }
  });

  return (
    <div className="mt-6 space-y-6">
      <div>
        <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2 transition-colors duration-300">
          CHANGE PASSWORD
        </label>

        {successMsg && (
          <div className="mb-6 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm flex items-start gap-2.5 font-semibold animate-fade-in-up">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-start gap-2.5 font-semibold animate-fade-in-up">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="relative flex items-center justify-between w-full pl-11 pr-1.5 py-1.5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 transition-colors duration-300">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none transition-colors duration-300">
            <ShieldCheck size={16} />
          </span>
          <div className="text-sm text-stone-500 dark:text-stone-400 truncate pr-4">
            Email Verification <strong className="text-stone-850 dark:text-white">{email || 'Not updated'}</strong>
          </div>
          <button
            type="button"
            onClick={handleSendOtp}
            disabled={isSendingOtp || countdown > 0 || !email}
            className="shrink-0 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-[#FF4C4C] hover:bg-[#E13B3B] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSendingOtp ? 'Sending...' : countdown > 0 ? `Retry in ${countdown}s` : 'Send OTP'}
          </button>
        </div>
      </div>

        {otpSent && (
          <div className="space-y-6 animate-fade-in-up mt-6">
            <div>
              <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">
                OTP CODE (6 DIGITS)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
                  <ShieldCheck size={16} />
                </span>
                <input
                  type="text"
                  name="otpCode"
                  maxLength={6}
                  value={formik.values.otpCode}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="Enter the OTP sent to your email"
                  className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-white/5 border dark:border-white/10 text-sm outline-none transition-all duration-200
                    ${formik.touched.otpCode && formik.errors.otpCode
                      ? 'border-red-500/50 text-red-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                      : 'border-gray-200 text-stone-850 dark:text-white focus:border-[#FF4C4C] focus:ring-2 focus:ring-[#FF4C4C]/10'
                    }`}
                />
              </div>
              {formik.touched.otpCode && formik.errors.otpCode && (
                <p className="text-xs text-red-500 font-semibold mt-1.5 pl-2">⚠️ {formik.errors.otpCode}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">
                  NEW PASSWORD
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
                    <KeyRound size={16} />
                  </span>
                  <input
                    type="password"
                    name="newPassword"
                    value={formik.values.newPassword}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="At least 6 characters"
                    className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-white/5 border dark:border-white/10 text-sm outline-none transition-all duration-200
                      ${formik.touched.newPassword && formik.errors.newPassword
                        ? 'border-red-500/50 text-red-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                        : 'border-gray-200 text-stone-850 dark:text-white focus:border-[#FF4C4C] focus:ring-2 focus:ring-[#FF4C4C]/10'
                      }`}
                  />
                </div>
                {formik.touched.newPassword && formik.errors.newPassword && (
                  <p className="text-xs text-red-500 font-semibold mt-1.5 pl-2">⚠️ {formik.errors.newPassword}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">
                  CONFIRM PASSWORD
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
                    <KeyRound size={16} />
                  </span>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formik.values.confirmPassword}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="Re-enter your password"
                    className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-white/5 border dark:border-white/10 text-sm outline-none transition-all duration-200
                      ${formik.touched.confirmPassword && formik.errors.confirmPassword
                        ? 'border-red-500/50 text-red-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                        : 'border-gray-200 text-stone-850 dark:text-white focus:border-[#FF4C4C] focus:ring-2 focus:ring-[#FF4C4C]/10'
                      }`}
                  />
                </div>
                {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                  <p className="text-xs text-red-500 font-semibold mt-1.5 pl-2">⚠️ {formik.errors.confirmPassword}</p>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => formik.handleSubmit()}
                disabled={formik.isSubmitting || !formik.dirty}
                className="px-8 py-4 rounded-2xl font-bold text-sm text-white bg-stone-900 hover:bg-black dark:bg-white dark:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formik.isSubmitting ? 'Updating...' : 'Confirm Password Change'}
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
