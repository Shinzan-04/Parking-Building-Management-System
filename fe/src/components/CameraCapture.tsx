import { useState, useRef, useEffect } from 'react';
import { Camera, X, Loader } from 'lucide-react';
import { scanPlate, type ScanPlateResponse } from '../services/ocrService';
import { Html5Qrcode } from 'html5-qrcode';

interface CameraCaptureProps {
  // onSuccess receives both the parsed OCR result and the raw image base64
  onSuccess: (result: ScanPlateResponse, imageBase64: string) => void;
  onCancel: () => void;
  token?: string | null;
  // If inline=true the component renders embedded (no backdrop/modal)
  inline?: boolean;
  className?: string;
  mode?: 'lpr' | 'qr';
  onQrSuccess?: (qrCode: string) => Promise<void>;
}

export default function CameraCapture({ onSuccess, onCancel, token, inline, className, mode = 'lpr', onQrSuccess }: CameraCaptureProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Both LPR and QR now use manual capture from standard video stream
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to access camera');
      }
    };

    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [mode]);

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      setLoading(true);
      setError(null);

      // Draw video frame to canvas
      const context = canvasRef.current.getContext('2d');
      if (!context) throw new Error('Could not get canvas context');

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);

      if (mode === 'lpr') {
        // LPR MODE: Convert to base64 and call OCR API
        const imageBase64 = canvasRef.current.toDataURL('image/jpeg').split(',')[1];
        const result = await scanPlate(imageBase64, token);

        if (result) {
          onSuccess(result, imageBase64);
        } else {
          setError('No license plate detected. Please try again.');
        }
        setLoading(false);
      } else {
        // QR MODE: Convert to File and use Html5Qrcode.scanFile
        canvasRef.current.toBlob(async (blob) => {
          if (!blob) {
            setError('Failed to capture image');
            setLoading(false);
            return;
          }
          const file = new File([blob], 'qr.jpg', { type: 'image/jpeg' });
          try {
            const qrScanner = new Html5Qrcode("hidden-qr-reader");
            const result = await qrScanner.scanFileV2(file, false);
            if (onQrSuccess) {
              await onQrSuccess(result.decodedText);
            }
          } catch (err) {
            setError('No QR code detected. Please try again.');
          } finally {
            setLoading(false);
          }
        }, 'image/jpeg');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan image');
      setLoading(false);
    }
  };

  const renderContent = () => {
    return (
      <div className="relative w-full h-full bg-black">
        <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div 
            className={`relative border-2 rounded-lg ${mode === 'lpr' ? 'h-32 w-64 border-cyan-400' : 'h-48 w-48 border-emerald-400'}`}
            style={{ boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)' }}
          >
            <div className={`absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 ${mode === 'lpr' ? 'border-cyan-400' : 'border-emerald-400'}`} />
            <div className={`absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 ${mode === 'lpr' ? 'border-cyan-400' : 'border-emerald-400'}`} />
            <div className={`absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 ${mode === 'lpr' ? 'border-cyan-400' : 'border-emerald-400'}`} />
            <div className={`absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 ${mode === 'lpr' ? 'border-cyan-400' : 'border-emerald-400'}`} />
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div id="hidden-qr-reader" className="absolute opacity-0 pointer-events-none w-10 h-10 -z-10"></div>
        {error && <div className="absolute top-4 left-4 right-4 z-30 px-4 py-2 text-sm text-red-300 bg-black/60 rounded-lg backdrop-blur-sm">{error}</div>}
        <div className="absolute bottom-4 right-4 z-30">
          <button
            type="button"
            onClick={captureAndScan}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === 'lpr' ? 'bg-cyan-500 hover:bg-cyan-400' : 'bg-emerald-500 hover:bg-emerald-400'
            }`}
          >
            {loading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            <span>Capture</span>
          </button>
        </div>
      </div>
    );
  };

  // If inline mode, render without backdrop/modal wrapper
  if (inline) {
    return (
      <div className={`h-full ${className || ''}`}>
        <div className="w-full h-full overflow-hidden bg-black">
          {renderContent()}
        </div>
      </div>
    );
  }

  // Modal mode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl bg-stone-900 rounded-2xl overflow-hidden shadow-2xl border border-stone-800">
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <button
            onClick={onCancel}
            className="p-2 bg-black/50 text-white rounded-full hover:bg-black/80 transition-colors backdrop-blur-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="aspect-video relative bg-black">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
