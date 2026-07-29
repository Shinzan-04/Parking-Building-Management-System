import { useState } from 'react';
import { Search, Ticket, AlertTriangle, CheckCircle2, Car, MapPin, Clock, XCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import type { SessionDto } from '../../services/sessionsService';

const showCustomToast = (kind: 'success' | 'error', message: string) => {
  toast.custom((t) => {
    const tone =
      kind === 'success'
        ? 'border-emerald-100 bg-white text-emerald-700 shadow-emerald-500/10'
        : 'border-red-100 bg-white text-red-700 shadow-red-500/10';
    const Icon = kind === 'success' ? CheckCircle2 : AlertTriangle;

    return (
      <div
        className={`w-80 min-h-[4.5rem] rounded-2xl border p-4 shadow-xl flex items-center gap-3.5 pointer-events-auto ${tone}`}
        style={{
          animation: t.visible ? 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
          opacity: t.visible ? 1 : 0,
          transition: 'opacity 0.4s'
        }}
      >
        <Icon size={26} className={`shrink-0 ${kind === 'success' ? 'text-emerald-500' : 'text-red-500'}`} />
        <span className="text-sm font-bold leading-snug text-left">{message}</span>
      </div>
    );
  }, { duration: 3000, position: 'top-center' });
};


const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

export default function StaffExceptions() {
  const { token } = useAuth();

  const [searchPlate, setSearchPlate] = useState('');
  const [session, setSession] = useState<SessionDto | null>(null);
  const [loading, setLoading] = useState(false);

  const [penaltyFee, setPenaltyFee] = useState<number>(50000);
  const [reason, setReason] = useState('Customer reported lost ticket');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newSessionCode, setNewSessionCode] = useState<string | null>(null);

  /**
   * Tra cứu thông tin xe đang đỗ trong bãi dựa vào Biển số (License Plate).
   * Dùng khi khách hàng báo mất vé hoặc không quét được mã QR ở cổng ra.
   */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPlate.trim()) {
      showCustomToast('error', 'Please enter a license plate to search');
      return;
    }

    setLoading(true);
    setSession(null);
    setNewSessionCode(null);

    try {
      // Gọi API tìm Session theo biển số (Chỉ lấy xe đang có trong bãi)
      const res = await fetch(`${BASE_URL}/api/Sessions/find-by-plate?plate=${encodeURIComponent(searchPlate)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        if (res.status === 404) {
          showCustomToast('error', `No vehicle with license plate '${searchPlate}' found in the parking lot.`);
        } else {
          const err = await res.json();
          showCustomToast('error', err.message || 'Error searching for session.');
        }
        return;
      }

      const data = await res.json();
      setSession(data); // Lưu thông tin xe (giờ vào, vị trí đỗ, ảnh camera) để hiển thị
    } catch (err) {
      showCustomToast('error', 'Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Xử lý ngoại lệ: Ghi nhận Phí phạt (Penalty Fee) vào đơn đỗ xe hiện tại.
   * Khi khách ra cổng và thanh toán, Backend sẽ tự động cộng thêm penaltyFee vào tổng phí.
   */
  const handleReissueTicket = async () => {
    if (!session) return;

    setIsSubmitting(true);
    try {
      // Gửi khoản phí phạt và lý do (VD: Làm mất thẻ/vé) lên Backend
      const res = await fetch(`${BASE_URL}/api/Sessions/${session.id}/reissue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          penaltyFee,
          reason
        })
      });

      if (!res.ok) {
        const err = await res.json();
        showCustomToast('error', err.message || 'Error reissuing ticket.');
        return;
      }

      const result = await res.json();
      setNewSessionCode(result.sessionCode);
      showCustomToast('success', 'Ticket reissued successfully!');
    } catch (err) {
      showCustomToast('error', 'Error calling the reissue ticket API.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const vnd = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--admin-text-primary)' }}>
          <AlertTriangle size={24} className="text-[#FF4C4C]" />
          Exception Handling
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--admin-text-faint)' }}>
          Look up a parked vehicle and reissue a ticket (QR) for a lost ticket/card.
        </p>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-6 rounded-2xl">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} style={{ color: 'var(--admin-text-muted)' }} />
            </div>
            <input
              type="text"
              value={searchPlate}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
                setSearchPlate(val);
              }}
              placeholder="e.g 51A12345"
              maxLength={12}
              className="block w-full pl-10 pr-3 py-3 border rounded-xl leading-5 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#FF4C4C] focus:border-[#FF4C4C] sm:text-sm font-mono font-bold"
              style={{
                color: 'var(--admin-text-primary)',
                borderColor: 'var(--admin-border)',
                backgroundColor: 'var(--admin-bg-base)'
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-[#FF4C4C] hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
          >
            {loading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Search size={18} />}
            Find Vehicle
          </button>
        </form>
      </div>

      {/* Result & Actions */}
      {session && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Session Details */}
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold border-b pb-3 mb-4 flex items-center gap-2" style={{ color: 'var(--admin-text-primary)', borderColor: 'var(--admin-border)' }}>
              <Car size={18} className="text-[#FF4C4C]" />
              Parked Vehicle Information
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--admin-border)' }}>
                <span className="text-sm flex items-center gap-2" style={{ color: 'var(--admin-text-muted)' }}>
                  <Car size={15} /> License Plate
                </span>
                <span className="font-mono font-bold text-lg" style={{ color: 'var(--admin-text-primary)' }}>{session.licensePlate}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--admin-border)' }}>
                <span className="text-sm flex items-center gap-2" style={{ color: 'var(--admin-text-muted)' }}>
                  <MapPin size={15} /> Location
                </span>
                <span className="font-medium" style={{ color: 'var(--admin-text-primary)' }}>
                  {session.floorName?.toString().toLowerCase().includes('floor') || session.floorName?.toString().toLowerCase().includes('tầng') ? session.floorName : `Floor ${session.floorName}`} / Slot {session.slotNumber?.replace(`${session.floorName}-`, '').replace('Slot ', '')}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--admin-border)' }}>
                <span className="text-sm flex items-center gap-2" style={{ color: 'var(--admin-text-muted)' }}>
                  <Clock size={15} /> Entry Time
                </span>
                <span className="font-medium" style={{ color: 'var(--admin-text-primary)' }}>
                  {new Date(session.entryTime).toLocaleString('vi-VN')}
                </span>
              </div>



              <div className="pt-2">
                <span className="text-sm flex items-center gap-2 mb-2" style={{ color: 'var(--admin-text-muted)' }}>
                  Check-in Photo
                </span>
                {session.entryImageUrl ? (
                  <img src={session.entryImageUrl} alt="Check-in" className="w-full h-auto rounded-lg object-cover border border-dashed" style={{ borderColor: 'var(--admin-border)' }} />
                ) : (
                  <div className="w-full h-32 rounded-lg border-2 border-dashed flex items-center justify-center text-sm" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text-faint)', backgroundColor: 'var(--admin-bg-base)' }}>
                    No check-in photo available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Form */}
          <div className="glass-card p-6 rounded-2xl flex flex-col">
            <h3 className="text-lg font-bold border-b pb-3 mb-4 flex items-center gap-2" style={{ color: 'var(--admin-text-primary)', borderColor: 'var(--admin-border)' }}>
              <AlertTriangle size={18} className="text-yellow-500" />
              Action: Reissue Ticket
            </h3>

            {newSessionCode ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle2 size={32} className="text-green-500" />
                </div>
                <h4 className="text-xl font-bold" style={{ color: 'var(--admin-text-primary)' }}>Success!</h4>
                <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
                  The lost-ticket penalty fee has been recorded for vehicle <strong>{session.licensePlate}</strong>.
                  <br /><br />
                  The system keeps the original ticket code. The customer can use the original ticket code (or license plate) to check out.
                </p>

                <button
                  onClick={() => {
                    setSession(null);
                    setNewSessionCode(null);
                    setSearchPlate('');
                  }}
                  className="mt-4 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--admin-text-primary)', borderColor: 'var(--admin-border)' }}
                >
                  Process Another Vehicle
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>
                    Penalty Fee (VND)
                  </label>
                  <input
                    type="number"
                    value={penaltyFee}
                    onChange={(e) => setPenaltyFee(Number(e.target.value))}
                    min={0}
                    step={1000}
                    className="block w-full px-3 py-2 border rounded-xl leading-5 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#FF4C4C] focus:border-[#FF4C4C] sm:text-sm"
                    style={{
                      color: 'var(--admin-text-primary)',
                      borderColor: 'var(--admin-border)',
                      backgroundColor: 'var(--admin-bg-base)'
                    }}
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--admin-text-faint)' }}>
                    Suggested: charge a replacement card fee of {vnd(penaltyFee)}.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>
                    Reason / Notes
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className="block w-full px-3 py-2 border rounded-xl leading-5 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#FF4C4C] focus:border-[#FF4C4C] sm:text-sm"
                    style={{
                      color: 'var(--admin-text-primary)',
                      borderColor: 'var(--admin-border)',
                      backgroundColor: 'var(--admin-bg-base)'
                    }}
                  />
                </div>

                <div className="mt-auto pt-6">
                  <button
                    onClick={handleReissueTicket}
                    disabled={isSubmitting}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 transition-colors"
                  >
                    {isSubmitting ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Ticket size={18} />}
                    Confirm Exception Handling
                  </button>
                  <p className="text-xs text-center mt-3" style={{ color: 'var(--admin-text-faint)' }}>
                    Note: This action will add the penalty fee to the system when the customer exits. The original ticket code (Session Code) remains unchanged.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
