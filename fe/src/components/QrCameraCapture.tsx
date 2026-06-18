import { useState, useRef, useEffect } from 'react';
import { Camera, X, Loader, QrCode } from 'lucide-react';
import jsQR from 'jsqr';

interface QrCameraCaptureProps {
  onSuccess: (result: string) => void;
  paused?: boolean;
  inline?: boolean;
  className?: string;
}

export default function QrCameraCapture({ onSuccess, paused = false, inline = true, className }: QrCameraCaptureProps) {
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  useEffect(() => {
    const initCamera = async () => {
      try {
        setError(null);
        setCameraActive(false);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setCameraActive(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể truy cập camera. Vui lòng cấp quyền.');
      }
    };

    if (!paused) {
      initCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [paused]);

  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // QR Scanning loop
  useEffect(() => {
    if (!cameraActive || paused) return;

    const scan = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (context) {
          // Downsample or match video dimensions
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Get image pixel data
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          
          // Only attempt decoding every 100ms to save CPU
          const now = Date.now();
          if (now - lastScanTimeRef.current > 100) {
            lastScanTimeRef.current = now;
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });

            if (code && code.data && code.data.trim()) {
              // Successfully scanned QR code!
              onSuccess(code.data);
            }
          }
        }
      }
      requestRef.current = requestAnimationFrame(scan);
    };

    requestRef.current = requestAnimationFrame(scan);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [cameraActive, paused, onSuccess]);

  if (paused) {
    return (
      <div className={`relative flex flex-col items-center justify-center bg-stone-900 aspect-video rounded-3xl overflow-hidden border border-gray-200/60 ${className}`}>
        <div className="flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FF4C4C]/10 border border-[#FF4C4C]/30 flex items-center justify-center text-[#FF4C4C]">
            <QrCode size={24} className="animate-pulse" />
          </div>
          <p className="text-xs font-bold">Đã nhận dạng mã QR đặt trước</p>
          <p className="text-[10px] text-stone-400 max-w-[240px] leading-relaxed">
            Camera tạm dừng để xử lý thông tin. Nhấp "Xác nhận xe vào bãi" hoặc xóa nội dung nhập để tiếp tục quét.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-gray-200/60 bg-black aspect-video ${className}`}>
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover"
      />

      {/* Hidden Canvas for QR processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Laser line effect */}
      {cameraActive && (
        <div className="absolute left-0 right-0 top-0 h-0.5 bg-[#FF4C4C] opacity-75 shadow-[0_0_10px_#FF4C4C] pointer-events-none animate-scan-line" />
      )}

      {/* Reticle / Target bracket frame */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative h-44 w-44 border border-white/20 rounded-2xl">
          {/* Corner markers highlighted in #FF4C4C */}
          <div className="absolute top-0 left-0 h-6 w-6 border-t-4 border-l-4 border-[#FF4C4C] rounded-tl-lg" />
          <div className="absolute top-0 right-0 h-6 w-6 border-t-4 border-r-4 border-[#FF4C4C] rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 h-6 w-6 border-b-4 border-l-4 border-[#FF4C4C] rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 h-6 w-6 border-b-4 border-r-4 border-[#FF4C4C] rounded-br-lg" />
        </div>
      </div>

      {/* Dark overlay mask outside the scanning box */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="h-full w-full" viewBox="0 0 1280 720" preserveAspectRatio="none">
          <defs>
            <mask id="camera-qr-mask">
              <rect width="1280" height="720" fill="white" />
              <rect x="520" y="240" width="240" height="240" rx="20" ry="20" fill="black" />
            </mask>
          </defs>
          <rect width="1280" height="720" fill="rgba(0,0,0,0.45)" mask="url(#camera-qr-mask)" />
        </svg>
      </div>

      {/* Overlay status tags */}
      <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-[#FF4C4C] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm">
        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" />
        QR Scanner Ready
      </div>
      <div className="absolute bottom-4 right-4 rounded-full bg-stone-900/80 px-3 py-1 text-[10px] text-stone-300 font-medium font-mono">
        CAM-QR-01
      </div>

      {/* Error state overlay */}
      {error && (
        <div className="absolute inset-0 bg-stone-950/90 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-bold text-red-400 mb-2">Lỗi truy cập máy ảnh</p>
          <p className="text-xs text-stone-300 leading-relaxed max-w-[280px]">{error}</p>
        </div>
      )}
    </div>
  );
}
