import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getVehicleTypes, type VehicleTypeResponse } from '../../services/vehicleTypesService';
import {
  getMyVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  setPrimaryVehicle,
  type VehicleResponse,
} from '../../services/vehiclesService';
import {
  ArrowLeft,
  Car,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  Loader2,
  X,
  User,
  Ticket,
  AlertTriangle,
  Star,
  LogOut,
} from 'lucide-react';

export default function MyVehiclePage() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  const [vehicles, setVehicles] = useState<VehicleResponse[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // States cho Modal Thêm/Sửa xe
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form states
  const [formVehicleTypeId, setFormVehicleTypeId] = useState('');
  const [formPlateNumber, setFormPlateNumber] = useState('');

  // Lấy danh sách xe & loại xe từ API thực tế của backend
  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);

      const [vehiclesData, typesData] = await Promise.all([
        getMyVehicles(token),
        getVehicleTypes(),
      ]);

      setVehicles(vehiclesData);
      setVehicleTypes(typesData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Không thể tải danh sách phương tiện.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

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

  // Mở modal thêm xe
  const openAddModal = () => {
    setEditingVehicle(null);
    setFormVehicleTypeId(vehicleTypes[0]?.id || '');
    setFormPlateNumber('');
    setModalError(null);
    setIsModalOpen(true);
  };

  // Mở modal sửa xe
  const openEditModal = (vehicle: VehicleResponse) => {
    setEditingVehicle(vehicle);
    setFormVehicleTypeId(vehicle.vehicleTypeId);
    setFormPlateNumber(vehicle.plateNumber);
    setModalError(null);
    setIsModalOpen(true);
  };

  // Submit form Thêm/Sửa gửi lên backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!formPlateNumber.trim()) {
      setModalError('Vui lòng nhập biển số xe.');
      return;
    }
    if (!formVehicleTypeId) {
      setModalError('Vui lòng chọn loại xe.');
      return;
    }

    try {
      setSubmitting(true);
      setModalError(null);

      if (editingVehicle) {
        // Gọi API cập nhật phương tiện
        await updateVehicle(
          editingVehicle.id,
          {
            plateNumber: formPlateNumber.trim(),
            vehicleTypeId: formVehicleTypeId,
          },
          token
        );
      } else {
        // Gọi API tạo mới phương tiện
        await createVehicle(
          {
            plateNumber: formPlateNumber.trim(),
            vehicleTypeId: formVehicleTypeId,
          },
          token
        );
      }

      setIsModalOpen(false);
      await loadData(); // Reload list
    } catch (err: any) {
      setModalError(err.message || 'Thao tác thất bại. Vui lòng kiểm tra lại.');
    } finally {
      setSubmitting(false);
    }
  };

  // Xóa xe thông qua API
  const handleDelete = async (id: string, plate: string) => {
    if (!token) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa phương tiện ${plate} này không?`)) return;

    try {
      setLoading(true);
      await deleteVehicle(id, token);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Không thể xóa phương tiện này.');
      setLoading(false);
    }
  };

  // Đặt xe làm mặc định qua API
  const handleSetPrimary = async (id: string) => {
    if (!token) return;
    try {
      setLoading(true);
      await setPrimaryVehicle(id, token);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Không thể đặt phương tiện này làm mặc định.');
      setLoading(false);
    }
  };

  const initials = user?.fullName?.slice(0, 2)?.toUpperCase() ?? 'PD';

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
              <Link to="/my-tickets" className="text-sm font-semibold text-stone-600 hover:text-[#FF4C4C] transition-colors cursor-pointer">
                My Ticket
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
                      className={`text-stone-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''
                        }`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/profile'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:text-[#FF4C4C] hover:bg-red-50 transition-colors text-left"
                      >
                        <User size={16} />
                        <span>Profile</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/my-vehicles'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#FF4C4C] bg-red-50/50 hover:bg-red-50 transition-colors text-left font-semibold"
                      >
                        <Car size={16} />
                        <span>My Vehicles</span>
                      </button>
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

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 w-full flex flex-col gap-6">

        {/* Header Card ( Teal / Cyan Gradient ) */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
          {/* Decorative shapes */}
          <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute left-1/3 top-0 -translate-y-1/2 w-48 h-48 bg-teal-500/30 rounded-full blur-xl" />

          <div className="relative z-10">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all mb-6 focus:outline-none"
            >
              <ArrowLeft size={14} />
              Quay lại trang chủ
            </button>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Phương tiện của tôi</h1>
            <p className="text-teal-50 text-sm font-medium">Quản lý danh sách các xe đã đăng ký gửi tại tòa nhà.</p>
          </div>
        </div>

        {/* Thẻ Bento chính chứa danh sách phương tiện */}
        <div className="bg-white border border-gray-200/60 rounded-[2.5rem] p-8 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-black text-stone-900">Danh sách xe</h2>
              <p className="text-xs text-stone-400 font-bold mt-1 uppercase tracking-wider">
                {vehicles.length} phương tiện đã đăng ký
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 bg-[#FF4C4C] hover:bg-[#E13B3B] text-white font-bold px-5 py-3 rounded-2xl text-xs uppercase tracking-wider shadow-sm shadow-[#FF4C4C]/15 transition-all"
            >
              <Plus size={16} />
              Thêm phương tiện
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 size={32} className="text-[#FF4C4C] animate-spin" />
              <p className="text-xs text-stone-400 font-bold tracking-widest uppercase">Đang tải danh sách phương tiện...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600 font-bold text-sm">
              Failed to load vehicles. {error}
            </div>
          ) : vehicles.length === 0 ? (
            // Empty State
            <div className="py-16 text-center flex flex-col items-center max-w-sm mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-stone-400 mb-6 shadow-inner border border-gray-150">
                <Car size={28} />
              </div>
              <h3 className="text-base font-bold text-stone-850 mb-2">Bạn chưa đăng ký xe nào</h3>
              <p className="text-xs text-stone-400 leading-relaxed mb-6 font-semibold">
                Đăng ký biển số xe trước giúp bạn đặt chỗ (booking) và check-in/check-out nhanh chóng tại bốt giữ xe.
              </p>
              <button
                onClick={openAddModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all"
              >
                Đăng ký xe đầu tiên
              </button>
            </div>
          ) : (
            // Vehicles List
            <div className="space-y-4">
              {vehicles.map((vehicle) => {
                return (
                  <div
                    key={vehicle.id}
                    className="border border-gray-200/70 hover:border-[#FF4C4C]/30 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-stone-550 border border-gray-150 shadow-inner shrink-0">
                        <Car size={22} />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg font-black tracking-wide text-stone-900">
                            {vehicle.plateNumber}
                          </span>
                          {vehicle.isPrimary && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              <Star size={10} className="fill-current" />
                              Mặc định
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-semibold text-stone-450">
                          Loại phương tiện: <strong className="text-stone-700 font-bold">{vehicle.vehicleTypeName}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {!vehicle.isPrimary && (
                        <button
                          onClick={() => handleSetPrimary(vehicle.id)}
                          className="px-3.5 py-2 border border-gray-200 hover:border-emerald-500 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50/20 rounded-xl text-xs font-bold transition-all focus:outline-none"
                        >
                          Chọn làm mặc định
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(vehicle)}
                        className="p-2 border border-gray-200 hover:border-[#FF4C4C] text-stone-500 hover:text-[#FF4C4C] hover:bg-red-50/20 rounded-xl transition-all focus:outline-none"
                        title="Chỉnh sửa"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(vehicle.id, vehicle.plateNumber)}
                        className="p-2 border border-gray-200 hover:border-red-500 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all focus:outline-none"
                        title="Xóa phương tiện"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── ADD / EDIT VEHICLE MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-[2rem] shadow-2xl overflow-hidden animate-fade-in-up">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-stone-900">
                {editingVehicle ? 'Cập nhật phương tiện' : 'Đăng ký phương tiện mới'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-gray-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Form body */}
              <div className="p-6 space-y-5">

                {modalError && (
                  <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* VEHICLE TYPE */}
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                    Loại xe *
                  </label>
                  <div className="relative">
                    <select
                      value={formVehicleTypeId}
                      onChange={(e) => setFormVehicleTypeId(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-semibold outline-none focus:border-[#FF4C4C] focus:ring-2 focus:ring-[#FF4C4C]/10 transition-all appearance-none cursor-pointer text-stone-850"
                    >
                      {vehicleTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}{type.description ? ` — ${type.description}` : ''}
                        </option>
                      ))}
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
                      <ChevronDown size={16} />
                    </span>
                  </div>
                </div>

                {/* LICENSE PLATE */}
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                    Biển số xe *
                  </label>
                  <input
                    type="text"
                    value={formPlateNumber}
                    onChange={(e) => setFormPlateNumber(e.target.value)}
                    placeholder="Ví dụ: 29A-123.45"
                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-semibold outline-none focus:border-[#FF4C4C] focus:ring-2 focus:ring-[#FF4C4C]/10 transition-all text-stone-850 placeholder:text-stone-300"
                    required
                  />
                </div>

              </div>

              {/* Modal footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-stone-500 text-xs font-bold transition-all focus:outline-none"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#FF4C4C] hover:bg-[#E13B3B] disabled:opacity-50 text-white text-xs font-bold transition-all focus:outline-none shadow-sm flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    editingVehicle ? 'Cập nhật' : 'Thêm xe'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
