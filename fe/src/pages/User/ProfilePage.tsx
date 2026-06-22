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

function getDashboardPath(role: string | number): string | null {
  if (role === 'Admin'   || role === 0) return '/admin';
  if (role === 'Manager' || role === 1) return '/manager';
  if (role === 'Staff'   || role === 2) return '/gate-control';
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
      .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
      .required('Họ và tên là bắt buộc'),
    email: Yup.string()
      .email('Email không hợp lệ')
      .required('Email là bắt buộc'),
    phoneNumber: Yup.string()
      .nullable()
      .matches(/^[0-9+ ]*$/, 'Số điện thoại không hợp lệ'),
  });

  const formik = useFormik({
    initialValues: {
      fullName: '',
      email: '',
      phoneNumber: '',
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
        }, token);

        // Lưu dữ liệu vào profile state
        setProfile(updated);
        
        // Đồng bộ lên AuthContext (họ tên hiển thị ở Header)
        updateUser({
          fullName: updated.fullName,
          email: updated.email
        });

        setSuccessMsg('Đã cập nhật thông tin cá nhân thành công!');
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err: any) {
        setErrorMsg(err.message || 'Cập nhật thông tin thất bại. Vui lòng thử lại.');
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
      const data = await getProfileApi(token);
      setProfile(data);
      
      // Đồng bộ hóa giá trị khởi tạo form
      formik.setValues({
        fullName: data.fullName || '',
        email: data.email || '',
        phoneNumber: data.phoneNumber || '',
      });
    } catch (err: any) {
      console.error(err);
      setErrorProfile(err.message || 'Không thể tải thông tin cá nhân.');
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const initials = user?.fullName?.slice(0, 2)?.toUpperCase() ?? 'PD';
  const roleDisplay = (role: string | number) => {
    if (role === 'Admin' || role === 0) return 'Quản trị viên';
    if (role === 'Manager' || role === 1) return 'Quản lý';
    if (role === 'Staff' || role === 2) return 'Nhân viên trực bãi';
    return 'Khách gửi xe';
  };

  const roleStyle = (role: string | number) => {
    if (role === 'Admin' || role === 0) return 'bg-red-50 text-red-600 border border-red-200';
    if (role === 'Manager' || role === 1) return 'bg-amber-50 text-amber-600 border border-amber-200';
    if (role === 'Staff' || role === 2) return 'bg-blue-50 text-blue-600 border border-blue-200';
    return 'bg-emerald-50 text-emerald-600 border border-emerald-200';
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  return (
    <div className="min-h-screen bg-[#F3F3F5] text-stone-900 font-sans antialiased selection:bg-[#FF4C4C]/20 selection:text-[#FF4C4C] pb-12">
      
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-2.5">
              <Link to="/" className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#FF4C4C] flex items-center justify-center text-white font-extrabold text-lg shadow-sm shadow-[#FF4C4C]/25">
                  P
                </div>
                <span className="text-xl font-extrabold tracking-tight text-stone-900">
                  Parking<span className="text-[#FF4C4C]">.</span>
                </span>
              </Link>
            </div>

            <div className="hidden md:flex items-center gap-10">
              <Link to="/" className="text-sm font-semibold text-stone-600 hover:text-[#FF4C4C] transition-colors cursor-pointer">
                Find Parking
              </Link>
              <Link to="/booking" className="text-sm font-semibold text-stone-600 hover:text-[#FF4C4C] transition-colors cursor-pointer">
                Book a Slot
              </Link>
              <span className="text-sm font-semibold text-stone-600 hover:text-[#FF4C4C] transition-colors cursor-pointer">
                Support
              </span>
            </div>

            <div className="flex items-center gap-3">
              {token && user ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2.5 bg-gray-100 border border-gray-200/50 rounded-full py-1.5 pl-2 pr-4 hover:bg-gray-200 transition-all focus:outline-none"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#FF4C4C] flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm shadow-[#FF4C4C]/25">
                      {initials}
                    </div>
                    <span className="text-sm text-stone-800 font-semibold hidden sm:block">
                      {user.fullName}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-stone-500 transition-transform duration-200 ${
                        isDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                      {getDashboardPath(user.role) && (
                        <>
                          <button
                            type="button"
                            onClick={() => { setIsDropdownOpen(false); navigate(getDashboardPath(user.role)!); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:text-[#FF4C4C] hover:bg-red-50 transition-colors text-left"
                          >
                            <LayoutDashboard size={16} />
                            <span>Trang quản lý</span>
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/profile'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#FF4C4C] bg-red-50/50 hover:bg-red-50 transition-colors text-left font-semibold"
                      >
                        <User size={16} />
                        <span>Profile</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/my-vehicles'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:text-[#FF4C4C] hover:bg-red-50 transition-colors text-left"
                      >
                        <Car size={16} />
                        <span>My Vehicles</span>
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/myticket'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:text-[#FF4C4C] hover:bg-red-50 transition-colors text-left"
                      >
                        <Ticket size={16} />
                        <span>My Tickets</span>
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/wallet'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:text-[#FF4C4C] hover:bg-red-50 transition-colors text-left"
                      >
                        <Wallet size={16} />
                        <span>Ví của tôi</span>
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:text-[#FF4C4C] hover:bg-red-50 transition-colors text-left"
                      >
                        <LogOut size={16} />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/auth"
                  className="bg-stone-900 hover:bg-stone-850 text-white font-bold px-6 py-2.5 rounded-full text-sm transition-all"
                >
                  Login / Register
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
        
        {/* Breadcrumbs / Back button */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-[#FF4C4C] bg-white border border-gray-200/60 px-4 py-2.5 rounded-2xl shadow-sm transition-all"
          >
            <ArrowLeft size={14} />
            Quay lại trang chủ
          </Link>
          <h1 className="text-xl font-extrabold tracking-tight text-stone-900">Thông tin tài khoản</h1>
        </div>

        {loadingProfile ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
            <div className="w-10 h-10 border-4 border-[#FF4C4C] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-stone-400 font-bold tracking-widest uppercase">Đang tải thông tin cá nhân...</p>
          </div>
        ) : errorProfile ? (
          <div className="bg-red-50 border border-red-200 rounded-[2.5rem] p-12 text-center max-w-2xl mx-auto">
            <AlertTriangle className="mx-auto w-12 h-12 text-red-500 mb-4" />
            <p className="text-lg font-bold text-stone-900 mb-2">Đã xảy ra lỗi</p>
            <p className="text-sm text-stone-500 font-semibold mb-6">{errorProfile}</p>
            <button
              onClick={fetchProfile}
              className="px-6 py-3 bg-[#FF4C4C] hover:bg-[#E13B3B] text-white font-bold text-sm rounded-xl transition-colors"
            >
              Thử lại
            </button>
          </div>
        ) : profile ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in-up">
            
            {/* Left Column: Avatar & QR Code (Bento boxes) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Bento Card 1: Avatar Overview */}
              <div className="bg-white rounded-[2.5rem] border border-gray-200/60 p-6 flex flex-col items-center text-center shadow-xl">
                <div className="w-24 h-24 rounded-full bg-[#FF4C4C] flex items-center justify-center text-white font-black text-3xl shadow-sm shadow-[#FF4C4C]/25 mb-4">
                  {initials}
                </div>
                
                <h2 className="text-xl font-black text-stone-900 leading-tight mb-1">{profile.fullName}</h2>
                <p className="text-sm font-semibold text-stone-400">@{profile.username}</p>

                <div className="mt-4 flex flex-col gap-2 w-full">
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold w-fit mx-auto ${roleStyle(profile.role)}`}>
                    {roleDisplay(profile.role)}
                  </span>
                </div>

                <div className="mt-6 border-t border-gray-100 pt-5 w-full flex items-center justify-center gap-2 text-xs font-bold text-stone-400">
                  <Calendar size={14} />
                  <span>Tham gia từ {formatDateDisplay(profile.createdAt)}</span>
                </div>
              </div>

            </div>

            {/* Right Column: Edit Profile Form */}
            <div className="lg:col-span-8">
              <div className="bg-white rounded-[2.5rem] border border-gray-200/60 p-8 shadow-xl">
                
                <h3 className="text-lg font-black text-stone-900 mb-6 flex items-center gap-2">
                  <User size={20} className="text-[#FF4C4C]" />
                  Chỉnh sửa thông tin cá nhân
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
                    <label htmlFor="fullName" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                      Họ và tên
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
                        <User size={16} />
                      </span>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        value={formik.values.fullName}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        placeholder="Nguyễn Văn A"
                        className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-gray-50 border text-sm outline-none transition-all duration-200
                          ${formik.touched.fullName && formik.errors.fullName
                            ? 'border-red-500/50 text-red-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                            : 'border-gray-200 text-stone-850 placeholder:text-stone-300 focus:border-[#FF4C4C] focus:ring-2 focus:ring-[#FF4C4C]/10'
                          }`}
                      />
                    </div>
                    {formik.touched.fullName && formik.errors.fullName && (
                      <p className="text-xs text-red-500 font-semibold mt-1.5 pl-2">⚠️ {formik.errors.fullName}</p>
                    )}
                  </div>

                  {/* Username (Readonly) */}
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                      Tên đăng nhập (Tài khoản)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none">
                        <User size={16} />
                      </span>
                      <input
                        type="text"
                        value={profile.username}
                        disabled
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-gray-100/60 border border-gray-200/50 text-stone-400 text-sm cursor-not-allowed font-semibold"
                      />
                    </div>
                    <p className="text-[10px] text-stone-400 font-medium mt-1.5 pl-2">Tên đăng nhập được dùng cố định và không thể thay đổi.</p>
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                      Địa chỉ Email
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
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
                        className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-gray-50 border text-sm outline-none transition-all duration-200
                          ${formik.touched.email && formik.errors.email
                            ? 'border-red-500/50 text-red-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                            : 'border-gray-200 text-stone-850 placeholder:text-stone-300 focus:border-[#FF4C4C] focus:ring-2 focus:ring-[#FF4C4C]/10'
                          }`}
                      />
                    </div>
                    {formik.touched.email && formik.errors.email && (
                      <p className="text-xs text-red-500 font-semibold mt-1.5 pl-2">⚠️ {formik.errors.email}</p>
                    )}
                  </div>

                  {/* Số điện thoại */}
                  <div>
                    <label htmlFor="phoneNumber" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                      Số điện thoại
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
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
                        className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-gray-50 border text-sm outline-none transition-all duration-200
                          ${formik.touched.phoneNumber && formik.errors.phoneNumber
                            ? 'border-red-500/50 text-red-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                            : 'border-gray-200 text-stone-850 placeholder:text-stone-300 focus:border-[#FF4C4C] focus:ring-2 focus:ring-[#FF4C4C]/10'
                          }`}
                      />
                    </div>
                    {formik.touched.phoneNumber && formik.errors.phoneNumber && (
                      <p className="text-xs text-red-500 font-semibold mt-1.5 pl-2">⚠️ {formik.errors.phoneNumber}</p>
                    )}
                  </div>

                  {/* Submit button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting || !formik.dirty}
                      className="px-8 py-4 rounded-2xl font-bold text-sm text-white bg-[#FF4C4C] hover:bg-[#E13B3B] transition-all shadow-sm shadow-[#FF4C4C]/15 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Đang lưu...
                        </span>
                      ) : (
                        'Lưu thay đổi'
                      )}
                    </button>
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
