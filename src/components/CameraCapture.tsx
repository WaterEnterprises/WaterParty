import { useState, useRef, useCallback, useEffect } from "react";
import { gsap } from "../lib/gsap";
import { X, Camera, RotateCcw, Zap, ZapOff, Check, Loader } from "lucide-react";
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { isCapacitor } from "../lib/constants";
import { cn } from "../lib/utils";

export interface CapturedPhoto {
  /** A File object ready for upload */
  file: File;
  /** local object URL for preview */
  previewUrl: string;
}

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (result: CapturedPhoto) => void;
}

/**
 * Full-screen inline camera capture component.
 *
 * **Capacitor (native):** Opens the native camera UI via `Camera.getPhoto()`.
 * **Browser (web):** Uses `getUserMedia` to show a live preview with a capture button.
 *
 * After capturing, shows a preview with retry / accept buttons.
 */
export function CameraCapture({ open, onClose, onCapture }: CameraCaptureProps) {
  const [mode, setMode] = useState<"live" | "preview">("live");
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [flashOn, setFlashOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Web-only: live preview via getUserMedia ──────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      videoTrackRef.current = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      videoTrackRef.current = stream.getVideoTracks()[0] || null;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setError(null);
    } catch (e: any) {
      if (e.name === "NotAllowedError") {
        setError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (e.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError(`Camera error: ${e.message || "Unknown"}`);
      }
    }
  }, [facingMode]);

  // Start/restart stream when opening or switching camera
  useEffect(() => {
    if (!open || isCapacitor) return;
    startStream();
    return () => { stopStream(); };
  }, [open, facingMode, startStream, stopStream]);

  // ── Capture ─────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    setBusy(true);
    try {
      if (isCapacitor) {
        // Native Capacitor camera
        const photo = await CapacitorCamera.getPhoto({
          quality: 92,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
          correctOrientation: true,
        });
        if (!photo?.webPath) {
          setBusy(false);
          return;
        }
        const blob = await fetch(photo.webPath).then((r) => r.blob());
        const ext = photo.format === "png" ? "png" : "jpg";
        const file = new File([blob], `chat_capture_${Date.now()}.${ext}`, {
          type: blob.type || `image/${ext}`,
        });
        const previewUrl = URL.createObjectURL(blob);
        setCapturedPhoto({ file, previewUrl });
        setMode("preview");
      } else {
        // Web: capture frame from video
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Apply horizontal flip for user-facing camera
        if (facingMode === "user") {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return;
            const file = new File([blob], `chat_capture_${Date.now()}.jpg`, {
              type: "image/jpeg",
            });
            const previewUrl = URL.createObjectURL(blob);
            setCapturedPhoto({ file, previewUrl });
            setMode("preview");
            // Stop stream while in preview
            stopStream();
          },
          "image/jpeg",
          0.92,
        );
      }
    } catch (e: any) {
      if (e.message?.includes("cancel")) {
        // User cancelled — do nothing
      } else {
        setError(e.message || "Capture failed");
      }
    } finally {
      setBusy(false);
    }
  }, [facingMode, stopStream]);

  // ── Retry (re-take) ─────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    if (capturedPhoto?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(capturedPhoto.previewUrl);
    }
    setCapturedPhoto(null);
    setMode("live");
    setError(null);
    // Stream will restart via the useEffect on `open` + `facingMode`
  }, [capturedPhoto]);

  // ── Accept ──────────────────────────────────────────────────────
  const handleAccept = useCallback(() => {
    if (!capturedPhoto) return;
    onCapture(capturedPhoto);
    // Cleanup
    if (capturedPhoto.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(capturedPhoto.previewUrl);
    }
    setCapturedPhoto(null);
    setMode("live");
    stopStream();
    onClose();
  }, [capturedPhoto, onCapture, onClose, stopStream]);

  // ── Close ───────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (capturedPhoto?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(capturedPhoto.previewUrl);
    }
    setCapturedPhoto(null);
    setMode("live");
    setError(null);
    stopStream();
    onClose();
  }, [capturedPhoto, onClose, stopStream]);

  // Toggle flash (only on web via torch; Capacitor handles it natively)
  const toggleFlash = useCallback(async () => {
    const track = videoTrackRef.current;
    if (!track) return;
    try {
      const capabilities = track.getCapabilities() as any;
      if (!capabilities?.torch) return;
      await track.applyConstraints({ advanced: [{ torch: !flashOn }] } as any);
      setFlashOn(!flashOn);
    } catch {}
  }, [flashOn]);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (overlayRef.current) {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopStream(); };
  }, [stopStream]);

  return (
    <>
      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[200] bg-black flex flex-col"
        >
          {/* ── Header ──────────────────────────────────────────── */}
          <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 pt-12 pb-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
            <button
              type="button"
              onClick={handleClose}
              className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors border border-border-default active:scale-90"
            >
              <X size={20} />
            </button>

            <span className="text-tiny font-black uppercase tracking-[0.2em] text-text-muted">
              {mode === "preview" ? "PREVIEW" : "CAMERA"}
            </span>

            {/* Flash toggle (web only in live mode) */}
            {mode === "live" && !isCapacitor && (
              <button
                type="button"
                onClick={toggleFlash}
                className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-border-default active:scale-90 transition-all"
              >
                {flashOn ? (
                  <Zap size={18} className="text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]" />
                ) : (
                  <ZapOff size={18} className="text-text-muted" />
                )}
              </button>
            )}
            {mode === "preview" && <div className="w-10 h-10" /> /* spacer */}
          </div>

          {/* ── Error Banner ────────────────────────────────────── */}
          {error && (
            <div className="absolute top-24 inset-x-4 z-10 bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 backdrop-blur-md">
              <p className="text-tiny font-bold text-red-400 text-center">{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="absolute top-1 right-2 text-red-400/60 hover:text-red-400"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* ── Live Preview (web) ──────────────────────────────── */}
          {mode === "live" && !isCapacitor && (
            <div className="flex-1 relative overflow-hidden bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  "absolute inset-0 w-full h-full object-cover",
                  facingMode === "user" ? "scale-x-[-1]" : "",
                )}
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Viewfinder frame */}
              <div className="absolute inset-0 border-[3px] border-border-default rounded-5xl m-6 pointer-events-none" />

              {/* Empty state while camera loads */}
              {!streamRef.current && !error && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader size={32} className="text-text-faint animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* ── Live Preview (Capacitor native - just a placeholder) ── */}
          {mode === "live" && isCapacitor && (
            <div className="flex-1 flex items-center justify-center bg-black">
              <div className="text-center">
                <Camera size={48} className="text-text-faint mx-auto mb-4" />
                <p className="text-tiny font-bold text-text-muted uppercase tracking-widest">
                  Tap capture to open native camera
                </p>
              </div>
            </div>
          )}

          {/* ── Captured Preview ────────────────────────────────── */}
          {mode === "preview" && capturedPhoto && (
            <div className="flex-1 relative overflow-hidden bg-black">
              <img
                src={capturedPhoto.previewUrl}
                alt="Captured"
                className="absolute inset-0 w-full h-full object-contain"
              />
              <div className="absolute inset-0 border-[3px] border-brand-accent/30 rounded-5xl m-6 pointer-events-none" />
            </div>
          )}

          {/* ── Bottom Controls ─────────────────────────────────── */}
          <div className="relative z-10 px-6 pb-10 pt-6 bg-gradient-to-t from-black/80 to-transparent">
            {mode === "live" && (
              <div className="flex items-center justify-center gap-8">
                {/* Camera switch button */}
                <button
                  type="button"
                  onClick={() => setFacingMode((p) => (p === "user" ? "environment" : "user"))}
                  className="w-12 h-12 rounded-full bg-glass-hover backdrop-blur-md flex items-center justify-center text-text-secondary hover:text-text-primary border border-border-default active:scale-90 transition-all"
                  aria-label="Switch camera"
                >
                  <RotateCcw size={20} />
                </button>

                {/* Capture button */}
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={busy || !!error}
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-90",
                    busy
                      ? "bg-glass-active cursor-wait"
                      : "bg-white hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.3)]",
                  )}
                  aria-label="Capture photo"
                >
                  {busy ? (
                    <Loader size={28} className="text-text-primary animate-spin" />
                  ) : (
                    <div className="w-16 h-16 rounded-full border-[3px] border-black" />
                  )}
                </button>

                {/* Spacer for symmetry */}
                <div className="w-12 h-12" />
              </div>
            )}

            {mode === "preview" && capturedPhoto && (
              <div className="flex items-center justify-center gap-8">
                {/* Retake */}
                <button
                  type="button"
                  onClick={handleRetry}
                  className="w-12 h-12 rounded-full bg-glass-hover backdrop-blur-md flex items-center justify-center text-text-secondary hover:text-text-primary border border-border-default active:scale-90 transition-all flex-col gap-0.5"
                  aria-label="Retake"
                >
                  <X size={16} />
                  <span className="text-2xs font-black uppercase tracking-widest">RETRY</span>
                </button>

                {/* Use photo */}
                <button
                  type="button"
                  onClick={handleAccept}
                  className="w-20 h-20 rounded-full bg-brand-accent flex items-center justify-center active:scale-90 transition-all shadow-[0_0_30px_rgba(0,210,255,0.3)] hover:bg-brand-accent/90"
                  aria-label="Use photo"
                >
                  <Check size={32} className="text-overlay" />
                </button>

                {/* Spacer for symmetry */}
                <div className="w-12 h-12" />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
