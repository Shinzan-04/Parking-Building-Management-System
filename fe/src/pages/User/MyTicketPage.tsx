import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getMyReservations,
  cancelReservation,
  normalizeReservationStatus,
  RESERVATION_STATUS_LABELS,
} from '../../services/reservationsService';
import type { ReservationResponse } from '../../services/reservationsService';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Car,
  QrCode,
  Trash2,
  ChevronDown,
  LogOut,
  Loader2,
  CheckCircle2,
  X,
  Ticket,
  User,
} from 'lucide-react';

export default function MyTicketPage() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  
  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // State cho Modal hiển thị QR Code
  const [selectedTicketForQr, setSelectedTicketForQr] = useState<ReservationResponse | null>(null);
  
  // State cho hủy đặt chỗ
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Load danh sách vé
  const fetchTickets = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getMyReservations(token);
      setReservations(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Không thể tải danh sách vé. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
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

  const handleCancelBooking = async (id: string) => {
    if (!token) return;
    if (!window.confirm('Bạn có chắc chắn muốn hủy yêu cầu đặt chỗ này không?')) return;
    
    try {
      setSubmittingCancel(true);
      setCancellingId(id);
      await cancelReservation(id, token);
      alert('Đã hủy đặt chỗ thành công.');
      await fetchTickets(); // reload list
    } catch (err: any) {
      alert(err.message || 'Hủy đặt chỗ thất bại.');
    } finally {
      setSubmittingCancel(false);
      setCancellingId(null);
    }
  };

  const initials = user?.fullName?.slice(0, 2)?.toUpperCase() ?? 'PD';

  // Định nghĩa các trạng thái hoạt động và lịch sử
  // Active: Pending (0), Confirmed (1), CheckedIn (2)
  // History: Cancelled (3), Completed (4), Rejected (5)
  const filterTickets = () => {
    return reservations.filter((ticket) => {
      const status = normalizeReservationStatus(ticket.status);
      const isActiveStatus = status === 'Pending' || status === 'Confirmed' || status === 'CheckedIn';
      
      if (activeTab === 'active') {
        return isActiveStatus;
      } else {
        return !isActiveStatus;
      }
    });
  };

  const filteredTickets = filterTickets();

  // Helper tính thời gian đỗ
  const getDurationHours = (start: string, end: string) => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.ceil(diff / 3600000);
  };

  // Helper định dạng ngày
  const formatDateDisplay = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const formatTimeDisplay = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // Trả về cấu trúc JSON String cho QR Code để GateControl quét được đầy đủ
  const getQrCodeJson = (ticket: ReservationResponse) => {
    return JSON.stringify({
      ref: ticket.bookingCode,
      lot: 'ParkSmart Building',
      plate: ticket.licensePlate,
      vehicle: 'car',
      slot: ticket.slotNumber || 'Tự động gán',
      date: ticket.startTime.split('T')[0],
      entry: ticket.startTime.split('T')[1]?.substring(0, 5) || '',
      duration: getDurationHours(ticket.startTime, ticket.endTime),
    });
  };

  // Helper cho style của Status Badge
  const getStatusBadgeStyle = (status: string | number) => {
    const normalized = normalizeReservationStatus(status);
    switch (normalized) {
      case 'Pending':
        return 'bg-amber-50 text-amber-600 border border-amber-200';
      case 'Confirmed':
        return 'bg-emerald-50 text-emerald-600 border border-emerald-200';
      case 'CheckedIn':
        return 'bg-blue-50 text-blue-600 border border-blue-200';
      case 'Cancelled':
        return 'bg-stone-50 text-stone-500 border border-stone-200';
      case 'Completed':
        return 'bg-stone-100 text-stone-600 border border-stone-200';
      case 'Rejected':
        return 'bg-red-50 text-red-600 border border-red-200';
      default:
        return 'bg-gray-50 text-gray-500 border border-gray-200';
    }
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
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/profile'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:text-[#FF4C4C] hover:bg-red-50 transition-colors text-left"
                      >
                        <User size={16} />
                        <span>Profile</span>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 w-full flex flex-col gap-8">
        
        {/* Header Back Button & Title */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors text-xs font-bold uppercase tracking-wider self-start"
          >
            <ArrowLeft size={14} />
            Quay lại trang chủ
          </button>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-stone-950">
            Vé đỗ xe của tôi<span className="text-[#FF4C4C]">.</span>
          </h1>
          <p className="text-sm text-stone-500 font-medium">Quản lý lịch trình đỗ xe, lấy mã QR và kiểm tra trạng thái vé.</p>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-gray-200 gap-6">
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'active'
                ? 'border-[#FF4C4C] text-[#FF4C4C]'
                : 'border-transparent text-stone-400 hover:text-stone-700'
            }`}
          >
            Vé đang hoạt động ({reservations.filter(r => {
              const s = normalizeReservationStatus(r.status);
              return s === 'Pending' || s === 'Confirmed' || s === 'CheckedIn';
            }).length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-[#FF4C4C] text-[#FF4C4C]'
                : 'border-transparent text-stone-400 hover:text-stone-700'
            }`}
          >
            Lịch sử đỗ xe ({reservations.filter(r => {
              const s = normalizeReservationStatus(r.status);
              return !(s === 'Pending' || s === 'Confirmed' || s === 'CheckedIn');
            }).length})
          </button>
        </div>

        {/* Tickets Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 size={36} className="text-[#FF4C4C] animate-spin" />
            <p className="text-sm text-stone-500 font-medium">Đang tải danh sách vé của bạn...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-500 text-sm rounded-2xl p-6 text-center font-bold">
            ⚠️ {error}
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="bg-white border border-gray-200/80 rounded-[2rem] p-12 text-center flex flex-col items-center max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-stone-450 mb-6">
              <Ticket size={28} className="text-stone-400" />
            </div>
            <h3 className="text-lg font-bold text-stone-850 mb-2">Không tìm thấy vé đỗ xe nào</h3>
            <p className="text-xs text-stone-400 leading-relaxed mb-6 font-medium">
              {activeTab === 'active' 
                ? 'Bạn hiện không có lượt đặt chỗ đỗ xe nào đang hoạt động.' 
                : 'Lịch sử lượt đặt chỗ đỗ xe của bạn đang trống.'}
            </p>
            {activeTab === 'active' && (
              <button
                onClick={() => navigate('/booking')}
                className="bg-stone-900 hover:bg-[#FF4C4C] text-white font-bold px-6 py-3 rounded-full text-xs uppercase tracking-widest transition-all shadow-sm shadow-[#FF4C4C]/10"
              >
                Đặt chỗ đỗ xe ngay
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTickets.map((ticket) => {
              const status = normalizeReservationStatus(ticket.status);
              const isPendingOrConfirmed = status === 'Pending' || status === 'Confirmed';
              
              return (
                <div
                  key={ticket.id}
                  className="bg-white border border-gray-200/80 rounded-[2rem] p-6 shadow-sm hover:border-[#FF4C4C]/25 hover:shadow-lg hover:shadow-gray-200/15 transition-all duration-300 flex flex-col justify-between min-h-[320px]"
                >
                  <div>
                    {/* Header: Status & Code */}
                    <div className="flex items-center justify-between mb-5">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${getStatusBadgeStyle(ticket.status)}`}>
                        {RESERVATION_STATUS_LABELS[status] || status}
                      </span>
                      <span className="text-xs font-bold text-stone-400">
                        Mã: <span className="text-[#FF4C4C] font-black">{ticket.bookingCode}</span>
                      </span>
                    </div>

                    {/* Facility name */}
                    <h3 className="text-base font-extrabold text-stone-900 mb-4 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#FF4C4C]" />
                      ParkSmart Building
                    </h3>

                    {/* Ticket Details */}
                    <div className="space-y-2.5 border-t border-b border-gray-100 py-4 mb-5 text-xs font-medium text-stone-500">
                      <div className="flex justify-between">
                        <span>Biển số xe</span>
                        <span className="font-bold text-stone-850">{ticket.licensePlate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Vị trí ô đỗ</span>
                        <span className="font-bold text-[#FF4C4C] bg-[#FF4C4C]/5 px-2 py-0.5 rounded">
                          {ticket.slotNumber || 'Tự động gán'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Thời gian vào</span>
                        <span className="font-bold text-stone-850">
                          {formatTimeDisplay(ticket.startTime)} ngày {formatDateDisplay(ticket.startTime)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Thời gian đỗ</span>
                        <span className="font-bold text-stone-850">
                          {getDurationHours(ticket.startTime, ticket.endTime)} tiếng
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2">
                    {/* Nút xem QR Code */}
                    {(status === 'Pending' || status === 'Confirmed' || status === 'CheckedIn') && (
                      <button
                        onClick={() => setSelectedTicketForQr(ticket)}
                        className="flex-1 flex items-center justify-center gap-2 bg-[#FF4C4C] hover:bg-[#E13B3B] text-white font-bold py-3 rounded-2xl text-xs uppercase tracking-wider shadow-sm transition-all"
                      >
                        <QrCode size={14} />
                        Vé QR Code
                      </button>
                    )}

                    {/* Nút Hủy (Chỉ hiện khi chưa CheckedIn và Chưa Hủy) */}
                    {isPendingOrConfirmed && (
                      <button
                        disabled={submittingCancel && cancellingId === ticket.id}
                        onClick={() => handleCancelBooking(ticket.id)}
                        className="px-4 py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        title="Hủy đặt chỗ"
                      >
                        {submittingCancel && cancellingId === ticket.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        <span className="hidden sm:inline">Hủy</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── QR CODE DISPLAY MODAL ── */}
      {selectedTicketForQr && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white border border-gray-200 rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up">
            
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FF4C4C]/10 border border-[#FF4C4C]/30 flex items-center justify-center text-[#FF4C4C]">
                  <QrCode size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-850">Mã vé QR Code</h3>
                  <p className="text-[10px] text-stone-400 font-medium">Dùng để quét xác nhận tại cổng vào</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTicketForQr(null)}
                className="p-1.5 rounded-xl text-stone-450 hover:text-stone-700 hover:bg-gray-100 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* QR SVG */}
            <div className="p-6 flex flex-col items-center gap-5">
              <div className="relative">
                <div className="absolute inset-0 rounded-3xl bg-[#FF4C4C]/5 blur-lg" />
                <div className="relative bg-white border border-gray-200 rounded-2xl p-4 shadow-xl flex items-center justify-center min-w-[212px] min-h-[212px]">
                  <QRCodeSVG
                    value={getQrCodeJson(selectedTicketForQr)}
                    size={180}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#1c1917"
                    imageSettings={{
                      src: '',
                      height: 0,
                      width: 0,
                      excavate: false,
                    }}
                  />
                </div>
              </div>

              {/* Booking Code Display */}
              <div className="text-center">
                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest block">Mã Booking</span>
                <span className="text-lg font-black text-[#FF4C4C] tracking-widest uppercase">{selectedTicketForQr.bookingCode}</span>
              </div>

              {/* Muted Specs summary */}
              <div className="w-full bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden text-xs font-semibold text-stone-500">
                <div className="flex justify-between px-4 py-2.5 border-b border-gray-150">
                  <span className="text-stone-400">Biển số</span>
                  <span className="text-stone-800">{selectedTicketForQr.licensePlate}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5 border-b border-gray-150">
                  <span className="text-stone-400">Vị trí đỗ</span>
                  <span className="text-stone-800">{selectedTicketForQr.slotNumber || 'Tự động gán'}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-stone-400">Giờ vào</span>
                  <span className="text-stone-800">{formatTimeDisplay(selectedTicketForQr.startTime)} • {formatDateDisplay(selectedTicketForQr.startTime)}</span>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={() => setSelectedTicketForQr(null)}
                className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
