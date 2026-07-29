import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  User,
  Mail,
  Phone,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Ticket,
  LayoutDashboard,
  LogOut,
  Car,
  Wallet
} from 'lucide-react';
import { getProfileApi, updateProfileApi, type ProfileResponse } from '../../services/authService';
import ChangePasswordForm from './ChangePasswordForm';

function getDashboardPath(role: string | number): string | null {
  if (role === 'Admin'   || role === 0) return '/admin';
  if (role === 'Manager' || role === 1) return '/manager';
  if (role === 'Staff'   || role === 2) return '/staff';
  return null;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, token, logout, updateUser } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [errorProfile, setErrorProfile] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside cho dropdown avatar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  // Formik validation schema
  const validationSchema = Yup.object().shape({
    fullName: Yup.string()
      .min(2, 'Full name must have at least 2 characters')
      .required('Full name is required'),
    email: Yup.string()
      .email('Invalid email address')
      .required('Email is required'),
    phoneNumber: Yup.string()
      .nullable()
      .matches(/^[0-9+ ]*$/, 'Invalid phone number'),
  });

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      fullName: profile?.fullName || '',
      email: profile?.email || '',
      phoneNumber: profile?.phoneNumber || '',
    },
    validationSchema,
    onSubmit: async (values) => {
      if (!token) return;
      setIsSubmitting(true);
      setSuccessMsg(null);
      setErrorMsg(null);
      try {
        const updated = await updateProfileApi({
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          phoneNumber: values.phoneNumber ? values.phoneNumber.trim() : null
        });

        // Lưu dữ liệu vào profile state
        setProfile(updated);
        
        // Đồng bộ lên AuthContext (họ tên hiển thị ở Header)
        updateUser({
          fullName: updated.fullName,
          email: updated.email
        });

        setSuccessMsg('Profile updated successfully!');
        setIsEditing(false);
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to update profile. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  });

  // Tải thông tin Profile chi tiết từ backend
  const fetchProfile = async () => {
    if (!token) return;
    try {
      setLoadingProfile(true);
      setErrorProfile(null);
      const data = await getProfileApi();
      setProfile(data);
    } catch (err: any) {
      console.error(err);
      setErrorProfile(err.message || 'Failed to load profile information.');
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const initials = user?.fullName?.slice(0, 2)?.toUpperCase() ?? 'PD';
  const roleDisplay = (role: string | number) => {
    if (role === 'Admin' || role === 0) return 'Administrator';
    if (role === 'Manager' || role === 1) return 'Manager';
    if (role === 'Staff' || role === 2) return 'Staff';
    return 'Customer';
  };

  const roleStyle = (role: string | number) => {
    if (role === 'Admin' || role === 0) return 'bg-red-50 text-red-600 border border-red-200';
    if (role === 'Manager' || role === 1) return 'bg-amber-50 text-amber-600 border border-amber-200';
    if (role === 'Staff' || role === 2) return 'bg-blue-50 text-blue-600 border border-blue-200';
    return 'bg-gray-100 text-stone-600 border border-gray-200 dark:bg-white/10 dark:text-stone-300 dark:border-white/10';
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  return (
    <div className="bg-[#F3F3F5] dark:bg-[#0A0A0C] text-stone-900 dark:text-[#F5F5F5] pb-12 min-h-full transition-colors duration-300">
      {/* Main container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">
        
        {/* Breadcrumbs / Back button */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-stone-500 dark:text-stone-400 hover:text-[#FF4C4C] bg-white dark:bg-[#18181B] border border-gray-200/60 dark:border-white/10 px-4 py-2.5 rounded-2xl shadow-sm transition-all duration-300"
          >
            <ArrowLeft size={14} />
            Back to Home
          </Link>
          <h1 className="text-xl font-extrabold tracking-tight text-stone-900 dark:text-white transition-colors duration-300">Account Information</h1>
        </div>

        {loadingProfile ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
            <div className="w-10 h-10 border-4 border-[#FF4C4C] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-stone-400 font-bold tracking-widest uppercase">Loading profile information...</p>
          </div>
        ) : errorProfile ? (
          <div className="bg-red-50 border border-red-200 rounded-[2.5rem] p-12 text-center max-w-2xl mx-auto">
            <AlertTriangle className="mx-auto w-12 h-12 text-red-500 mb-4" />
            <p className="text-lg font-bold text-stone-900 mb-2">An error occurred</p>
            <p className="text-sm text-stone-500 font-semibold mb-6">{errorProfile}</p>
            <button
              onClick={fetchProfile}
              className="px-6 py-3 bg-[#FF4C4C] hover:bg-[#E13B3B] text-white font-bold text-sm rounded-xl transition-colors"
            >
              Retry
            </button>
          </div>
        ) : profile ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in-up">
            
            {/* Left Column: Avatar & QR Code (Bento boxes) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Bento Card 1: Avatar Overview */}
              <div className="bg-white dark:bg-[#18181B] rounded-[2.5rem] border border-gray-200/60 dark:border-white/10 p-6 flex flex-col items-center text-center shadow-xl transition-colors duration-300">
                <div className="w-24 h-24 rounded-full bg-[#FF4C4C] flex items-center justify-center text-white font-black text-3xl shadow-sm shadow-[#FF4C4C]/25 mb-4">
                  {initials}
                </div>
                
                <h2 className="text-xl font-black text-stone-900 dark:text-white leading-tight mb-1 transition-colors duration-300">{profile.fullName}</h2>
                <p className="text-sm font-semibold text-stone-400 dark:text-stone-500 transition-colors duration-300">@{profile.username}</p>

                <div className="mt-4 flex flex-col gap-2 w-full">
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold w-fit mx-auto ${roleStyle(profile.role)}`}>
                    {roleDisplay(profile.role)}
                  </span>
                </div>

                <div className="mt-6 border-t border-gray-100 dark:border-white/10 pt-5 w-full flex items-center justify-center gap-2 text-xs font-bold text-stone-400 dark:text-stone-500 transition-colors duration-300">
                  <Calendar size={14} />
                  <span>Joined since {formatDateDisplay(profile.createdAt)}</span>
                </div>
              </div>

            </div>

            {/* Right Column: Edit Profile Form */}
            <div className="lg:col-span-8">
              <div className="bg-white dark:bg-[#18181B] rounded-[2.5rem] border border-gray-200/60 dark:border-white/10 p-8 shadow-xl transition-colors duration-300">
                
                <h3 className="text-lg font-black text-stone-900 dark:text-white mb-6 flex items-center gap-2 transition-colors duration-300">
                  <User size={20} className="text-[#FF4C4C]" />
                  Edit Profile
                </h3>

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

                <form onSubmit={formik.handleSubmit} className="space-y-6">
                  
                  {/* Họ và tên */}
                  <div>
                    <label htmlFor="fullName" className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2 transition-colors duration-300">
                      FULL NAME
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 pointer-events-none transition-colors duration-300">
                        <User size={16} />
                      </span>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        value={formik.values.fullName}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        placeholder="John Smith"
                        disabled={!isEditing}
                        className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-white/5 border dark:border-white/10 text-sm outline-none transition-all duration-200 ${!isEditing ? 'opacity-70 cursor-not-allowed' : ''}
                          ${formik.touched.fullName && formik.errors.fullName
                            ? 'border-red-500/50 text-red-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                            : 'border-gray-200 text-stone-850 dark:text-white placeholder:text-stone-300 dark:placeholder:text-stone-600 focus:border-[#FF4C4C] dark:focus:border-[#FF4C4C] focus:ring-2 focus:ring-[#FF4C4C]/10'
                          }`}
                      />
                    </div>
                    {formik.touched.fullName && formik.errors.fullName && (
                      <p className="text-xs text-red-500 font-semibold mt-1.5 pl-2">⚠️ {formik.errors.fullName}</p>
                    )}
                  </div>



                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2 transition-colors duration-300">
                      EMAIL ADDRESS
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 pointer-events-none transition-colors duration-300">
                        <Mail size={16} />
                      </span>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={formik.values.email}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        placeholder="name@example.com"
                        disabled={!isEditing}
                        className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-white/5 border dark:border-white/10 text-sm outline-none transition-all duration-200 ${!isEditing ? 'opacity-70 cursor-not-allowed' : ''}
                          ${formik.touched.email && formik.errors.email
                            ? 'border-red-500/50 text-red-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                            : 'border-gray-200 text-stone-850 dark:text-white placeholder:text-stone-300 dark:placeholder:text-stone-600 focus:border-[#FF4C4C] focus:ring-2 focus:ring-[#FF4C4C]/10'
                          }`}
                      />
                    </div>
                    {formik.touched.email && formik.errors.email && (
                      <p className="text-xs text-red-500 font-semibold mt-1.5 pl-2">⚠️ {formik.errors.email}</p>
                    )}
                  </div>

                  {/* Số điện thoại */}
                  <div>
                    <label htmlFor="phoneNumber" className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2 transition-colors duration-300">
                      PHONE NUMBER
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 pointer-events-none transition-colors duration-300">
                        <Phone size={16} />
                      </span>
                      <input
                        id="phoneNumber"
                        name="phoneNumber"
                        type="tel"
                        value={formik.values.phoneNumber}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        placeholder="0901234567"
                        disabled={!isEditing}
                        className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-white/5 border dark:border-white/10 text-sm outline-none transition-all duration-200 ${!isEditing ? 'opacity-70 cursor-not-allowed' : ''}
                          ${formik.touched.phoneNumber && formik.errors.phoneNumber
                            ? 'border-red-500/50 text-red-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                            : 'border-gray-200 text-stone-850 dark:text-white placeholder:text-stone-300 dark:placeholder:text-stone-600 focus:border-[#FF4C4C] focus:ring-2 focus:ring-[#FF4C4C]/10'
                          }`}
                      />
                    </div>
                    {formik.touched.phoneNumber && formik.errors.phoneNumber && (
                      <p className="text-xs text-red-500 font-semibold mt-1.5 pl-2">⚠️ {formik.errors.phoneNumber}</p>
                    )}
                  </div>

                  {/* Tích hợp form đổi mật khẩu */}
                  <ChangePasswordForm email={profile.email || ''} />

                  {/* Action buttons */}
                  <div className="pt-2 flex justify-end gap-3">
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="px-8 py-4 rounded-2xl font-bold text-sm text-white bg-stone-900 hover:bg-black dark:bg-white dark:text-black transition-all"
                      >
                        Edit Profile
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditing(false);
                            formik.resetForm();
                          }}
                          disabled={isSubmitting}
                          className="px-8 py-4 rounded-2xl font-bold text-sm text-stone-700 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 transition-all disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting || !formik.dirty}
                          className="px-8 py-4 rounded-2xl font-bold text-sm text-white bg-[#FF4C4C] hover:bg-[#E13B3B] transition-all shadow-sm shadow-[#FF4C4C]/15 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? (
                            <span className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Saving...
                            </span>
                          ) : (
                            'Save Changes'
                          )}
                        </button>
                      </>
                    )}
                  </div>

                </form>

              </div>
            </div>

          </div>
        ) : null}

      </main>

    </div>
  );
}
