import { useState } from 'react';
import { Search, Ticket, AlertTriangle, CheckCircle2, Car, MapPin, Clock, XCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import type { SessionDto } from '../../services/sessionsService';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

export default function StaffExceptions() {
  const { token } = useAuth();
  
  const [searchPlate, setSearchPlate] = useState('');
  const [session, setSession] = useState<SessionDto | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [penaltyFee, setPenaltyFee] = useState<number>(50000);
  const [reason, setReason] = useState('Khách báo mất vé');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newSessionCode, setNewSessionCode] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPlate.trim()) {
      toast.error('Vui lòng nhập biển số xe cần tìm');
      return;
    }

    setLoading(true);
    setSession(null);
    setNewSessionCode(null);
    
    try {
      const res = await fetch(`${BASE_URL}/api/Sessions/find-by-plate?plate=${encodeURIComponent(searchPlate)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        if (res.status === 404) {
          toast.error(`Không tìm thấy xe biển số '${searchPlate}' đang trong bãi.`);
        } else {
          const err = await res.json();
          toast.error(err.message || 'Lỗi khi tìm kiếm session.');
        }
        return;
      }
      
      const data = await res.json();
      setSession(data);
    } catch (err) {
      toast.error('Không thể kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const handleReissueTicket = async () => {
    if (!session) return;
    
    setIsSubmitting(true);
    try {
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
        toast.error(err.message || 'Lỗi khi cấp lại vé.');
        return;
      }
      
      const result = await res.json();
      setNewSessionCode(result.sessionCode);
      toast.success('Cấp lại vé thành công!');
    } catch (err) {
      toast.error('Lỗi khi gọi API cấp lại vé.');
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
          Tra cứu xe đang gửi và cấp lại vé (QR) cho trường hợp mất vé/mất thẻ.
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
              onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
              placeholder="Nhập biển số xe (VD: 29A-123.45)"
              className="block w-full pl-10 pr-3 py-3 border rounded-xl leading-5 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#FF4C4C] focus:border-[#FF4C4C] sm:text-sm uppercase font-mono font-bold"
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
            Tìm Xe
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
              Thông tin xe đang gửi
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--admin-border)' }}>
                <span className="text-sm flex items-center gap-2" style={{ color: 'var(--admin-text-muted)' }}>
                  <Car size={15} /> Biển số
                </span>
                <span className="font-mono font-bold text-lg" style={{ color: 'var(--admin-text-primary)' }}>{session.licensePlate}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--admin-border)' }}>
                <span className="text-sm flex items-center gap-2" style={{ color: 'var(--admin-text-muted)' }}>
                  <MapPin size={15} /> Vị trí
                </span>
                <span className="font-medium" style={{ color: 'var(--admin-text-primary)' }}>
                  {session.floorName} - {session.slotNumber}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--admin-border)' }}>
                <span className="text-sm flex items-center gap-2" style={{ color: 'var(--admin-text-muted)' }}>
                  <Clock size={15} /> Thời gian vào
                </span>
                <span className="font-medium" style={{ color: 'var(--admin-text-primary)' }}>
                  {new Date(session.entryTime).toLocaleString('vi-VN')}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--admin-border)' }}>
                <span className="text-sm flex items-center gap-2" style={{ color: 'var(--admin-text-muted)' }}>
                  <Ticket size={15} /> Mã vé hiện tại
                </span>
                <span className="font-mono text-sm" style={{ color: 'var(--admin-text-faint)' }}>
                  {session.sessionCode}
                </span>
              </div>
              
              {session.entryImageUrl && (
                <div className="pt-2">
                  <span className="text-sm flex items-center gap-2 mb-2" style={{ color: 'var(--admin-text-muted)' }}>
                    Ảnh check-in
                  </span>
                  <img src={session.entryImageUrl} alt="Check-in" className="w-full h-auto rounded-lg object-cover border border-dashed" style={{ borderColor: 'var(--admin-border)' }} />
                </div>
              )}
            </div>
          </div>

          {/* Action Form */}
          <div className="glass-card p-6 rounded-2xl flex flex-col">
            <h3 className="text-lg font-bold border-b pb-3 mb-4 flex items-center gap-2" style={{ color: 'var(--admin-text-primary)', borderColor: 'var(--admin-border)' }}>
              <AlertTriangle size={18} className="text-yellow-500" />
              Nghiệp vụ: Cấp lại vé
            </h3>

            {newSessionCode ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle2 size={32} className="text-green-500" />
                </div>
                <h4 className="text-xl font-bold" style={{ color: 'var(--admin-text-primary)' }}>Thành công!</h4>
                <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
                  Đã ghi nhận phí phạt mất vé cho xe <strong>{session.licensePlate}</strong>.
                  <br /><br />
                  Hệ thống vẫn giữ nguyên mã vé cũ. Khách hàng có thể dùng mã vé cũ (hoặc biển số) để Checkout.
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
                  Xử lý xe khác
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>
                    Mức phí phạt (VND)
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
                    Gợi ý: Thu phí làm lại thẻ {vnd(penaltyFee)}.
                  </p>
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>
                    Lý do / Ghi chú
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
                    Xác nhận xử lý ngoại lệ
                  </button>
                  <p className="text-xs text-center mt-3" style={{ color: 'var(--admin-text-faint)' }}>
                    Lưu ý: Hành động này sẽ cộng thêm phí phạt vào hệ thống khi khách hàng ra bãi. Mã vé cũ (Session Code) vẫn được giữ nguyên.
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
