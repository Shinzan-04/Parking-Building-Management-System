import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, XCircle, ArrowLeft, Loader2 } from 'lucide-react';

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'success' | 'failed' | 'cancelled'>('success');
  const [qrData, setQrData] = useState<string | null>(null);

  useEffect(() => {
    // PayOS appends `cancel=true` or we appended it in CancelUrl
    const isCancel = searchParams.get('cancel') === 'true';
    const payosStatus = searchParams.get('status'); // e.g. PAID, CANCELLED

    // Fake brief loading just for UI smoothness
    setTimeout(() => {
      setLoading(false);
      
      let finalStatus: 'success' | 'failed' | 'cancelled' = 'success';
      if (isCancel || payosStatus === 'CANCELLED') {
        finalStatus = 'cancelled';
      } else if (payosStatus === 'PAID' || payosStatus == null) {
        finalStatus = 'success';
        const savedQr = localStorage.getItem('latest_booking_qr');
        if (savedQr) setQrData(savedQr);
      } else {
        finalStatus = 'failed';
      }
      
      setStatus(finalStatus);

      // Nếu đang chạy trong iframe, báo kết quả về cho parent window (BookingWizard)
      if (window !== window.parent) {
        window.parent.postMessage({ type: 'PAYOS_RESULT', status: finalStatus }, '*');
      }
    }, 1000);
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-[#FF4C4C] animate-spin mb-4" />
        <p className="text-stone-500 font-medium">Processing payment result...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl shadow-xl overflow-hidden p-8 flex flex-col items-center text-center animate-fade-in-up">
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-black text-stone-800 mb-2">Payment Successful!</h1>
            <p className="text-sm text-stone-500 mb-8">
              Your parking spot has been booked. Please show this QR code to staff when entering the parking lot.
            </p>

            {qrData && (
              <div className="relative mb-8">
                <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 blur-xl" />
                <div className="relative bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center justify-center min-w-[212px] min-h-[212px]">
                  <QRCodeSVG
                    value={qrData}
                    size={180}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#1c1917"
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => navigate('/')}
              className="w-full bg-stone-900 text-white font-bold py-3.5 rounded-xl hover:bg-stone-800 transition-colors"
            >
              Back to Home
            </button>
          </>
        )}

        {(status === 'failed' || status === 'cancelled') && (
          <>
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <XCircle className="w-8 h-8 text-[#FF4C4C]" />
            </div>
            <h1 className="text-2xl font-black text-stone-800 mb-2">
              {status === 'cancelled' ? 'Payment Cancelled' : 'Payment Failed'}
            </h1>
            <p className="text-sm text-stone-500 mb-8">
              {status === 'cancelled'
                ? 'You cancelled the payment process.'
                : 'An error occurred during payment.'}
              {' '}You can try booking again.
            </p>

            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-2 bg-stone-100 text-stone-700 font-bold py-3.5 rounded-xl hover:bg-stone-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" /> Back to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
