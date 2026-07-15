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
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    // If mode is QR, we use html5-qrcode
    if (mode === 'qr') {
      const initQrScanner = async () => {
        try {
          html5QrCodeRef.current = new Html5Qrcode("qr-reader");
          await html5QrCodeRef.current.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            async (decodedText) => {
              if (isProcessingRef.current) return;
              isProcessingRef.current = true;
              try {
                if (onQrSuccess) {
                  await onQrSuccess(decodedText);
                }
              } finally {
                // Unlock after API finishes
                setTimeout(() => { isProcessingRef.current = false; }, 1500); // add a slight delay to prevent instant double scans
              }
            },
            (errorMessage) => {
              // ignore parse errors (happens constantly when no QR is in view)
            }
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to start QR scanner');
        }
      };

      initQrScanner();

      return () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(console.error);
        }
      };
    } else {
      // mode === 'lpr'
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
    }
  }, [mode]);

  const captureAndScan = async () => {
    if (mode !== 'lpr' || !videoRef.current || !canvasRef.current) return;

    try {
      setLoading(true);
      setError(null);

      // Draw video frame to canvas
      const context = canvasRef.current.getContext('2d');
      if (!context) throw new Error('Could not get canvas context');

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);

      // Convert to base64
      const imageBase64 = canvasRef.current.toDataURL('image/jpeg').split(',')[1];

      // Send to OCR service
      const result = await scanPlate(imageBase64, token);

      if (result) {
        onSuccess(result, imageBase64);
      } else {
        setError('No license plate detected. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan plate');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (mode === 'qr') {
      return (
        <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
          <div id="qr-reader" className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_video]:!object-cover"></div>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full bg-black">
        <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div 
            className="relative h-32 w-64 border-2 border-cyan-400 rounded-lg"
            style={{ boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)' }}
          >
            <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-cyan-400" />
            <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-cyan-400" />
            <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-cyan-400" />
            <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-cyan-400" />
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
        {error && <div className="absolute top-4 left-4 right-4 z-30 px-4 py-2 text-sm text-red-300 bg-black/60 rounded-lg backdrop-blur-sm">{error}</div>}
        <div className="absolute bottom-4 right-4 z-30">
          <button
            type="button"
            onClick={captureAndScan}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-cyan-400 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
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
