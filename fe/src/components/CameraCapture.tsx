import { useState, useRef, useEffect } from 'react';
import { Camera, X, Loader } from 'lucide-react';
import { scanPlate, type ScanPlateResponse } from '../services/ocrService';

interface CameraCaptureProps {
  // onSuccess receives both the parsed OCR result and the raw image base64
  onSuccess: (result: ScanPlateResponse, imageBase64: string) => void;
  onCancel: () => void;
  token?: string | null;
}

export default function CameraCapture({ onSuccess, onCancel, token }: CameraCaptureProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
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
  }, []);

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

      // Convert to base64
      const imageBase64 = canvasRef.current.toDataURL('image/jpeg').split(',')[1];

      // Send to OCR service
      const result = await scanPlate(imageBase64, token);

      if (result) {
        onSuccess(result, imageBase64);
      } else {
        setError(result?.message || 'No license plate detected. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan plate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900 overflow-hidden shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-500/15 p-2 text-cyan-400 ring-1 ring-cyan-400/20">
              <Camera className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-white">Scan License Plate</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/10 px-2 py-1 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Camera Feed */}
        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
          
          {/* Scanning Frame Overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-32 w-64 border-2 border-cyan-400 rounded-lg">
              {/* Corner markers */}
              <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-cyan-400" />
              <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-cyan-400" />
              <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-cyan-400" />
              <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-cyan-400" />
            </div>
          </div>

          {/* Darkening outer area */}
          <div className="absolute inset-0 pointer-events-none">
            <svg className="h-full w-full" viewBox="0 0 1280 720" preserveAspectRatio="none">
              <defs>
                <mask id="camera-mask">
                  <rect width="1280" height="720" fill="white" />
                  <rect x="508" y="328" width="264" height="128" fill="black" />
                </mask>
              </defs>
              <rect
                width="1280"
                height="720"
                fill="rgba(0, 0, 0, 0.4)"
                mask="url(#camera-mask)"
              />
            </svg>
          </div>
        </div>

        {/* Hidden Canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Error Message */}
        {error && (
          <div className="border-t border-white/10 bg-red-500/10 px-6 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="border-t border-white/10 bg-slate-950/50 px-6 py-4 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Position license plate within the frame and press "Capture"
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={captureAndScan}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Scanning...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  Capture
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
