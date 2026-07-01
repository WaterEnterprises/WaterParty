import React, { useState, useRef, useEffect, useCallback } from "react";
import { gsap } from "../lib/gsap";
import { X, RotateCw, Check } from "lucide-react";
import { cn, uploadImage } from "../lib/utils";

interface PhotoEditorProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onSave: (croppedBlob: Blob, croppedUrl: string) => void;
  aspectRatio?: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export function PhotoEditor({
  isOpen,
  imageSrc,
  onClose,
  onSave,
  aspectRatio = "9:16",
  maxWidth = 1080,
  maxHeight = 1920,
  quality = 0.85,
}: PhotoEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Refs for smooth drag tracking
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Refs for pinch-to-zoom
  const lastPinchDist = useRef(0);
  const pinchStartScale = useRef(1);

  // Refs for double-tap
  const lastTapTime = useRef(0);
  const lastTapPos = useRef({ x: 0, y: 0 });

  // Parse aspect ratio
  const [aW, aH] = aspectRatio.split(":").map(Number);
  const aspectW = aW || 9;
  const aspectH = aH || 16;

  // Canvas-to-screen scale factor
  const getCanvasScale = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return 1;
    const rect = canvas.getBoundingClientRect();
    return rect.width > 0 ? canvas.width / rect.width : 1;
  }, []);

  // Load image
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      setImgDimensions({ width: img.width, height: img.height });
      setOffset({ x: 0, y: 0 });
      setScale(1);
      setRotation(0);
    };
  }, [imageSrc]);

  // Draw the crop preview
  const drawPreview = useCallback(() => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const padX = parseFloat(getComputedStyle(container).paddingLeft) + parseFloat(getComputedStyle(container).paddingRight);
    const padY = parseFloat(getComputedStyle(container).paddingTop) + parseFloat(getComputedStyle(container).paddingBottom);
    const availW = containerRect.width - padX;
    const availH = containerRect.height - padY;

    // Fit within both dimensions maintaining aspect ratio
    let displayWidth = availW;
    let displayHeight = displayWidth * (aspectH / aspectW);
    if (displayHeight > availH) {
      displayHeight = availH;
      displayWidth = displayHeight * (aspectW / aspectH);
    }

    canvas.width = displayWidth * 2;
    canvas.height = displayHeight * 2;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Draw the image (can extend beyond canvas bounds) ---
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    const canvasW = canvas.width;
    const canvasH = canvas.height;
    const imgAspect = img.width / img.height;

    // Image covers the canvas (larger than canvas, allowing offset to push it outside)
    let drawW: number, drawH: number, drawX: number, drawY: number;

    if (imgAspect > canvasW / canvasH) {
      drawH = canvasH;
      drawW = canvasH * imgAspect;
      drawX = (canvasW - drawW) / 2 + offset.x * scale;
      drawY = 0;
    } else {
      drawW = canvasW;
      drawH = canvasW / imgAspect;
      drawX = 0;
      drawY = (canvasH - drawH) / 2 + offset.y * scale;
    }

    ctx.drawImage(img, drawX, drawY, drawW * scale, drawH * scale);
    ctx.restore();

    // --- Semi-transparent mask outside 9:16 crop area ---
    // The canvas itself IS the 9:16 area. We draw a mask over the FULL container
    // to show what's being cropped out.
    // Since the canvas IS the 9:16 rectangle, we just draw a darkened overlay
    // using the full container dimensions if the canvas is smaller.
    // Actually, the canvas fills the container at 9:16 aspect ratio.
    // The parts of the image that extend beyond the canvas edges represent
    // what will be cropped out.
    
    // We clip to the canvas bounds and then draw the dark overlay only where
    // the image exceeds the canvas. But since the canvas IS the crop area,
    // we need a different approach: clip to canvas, draw a semi-transparent
    // overlay, then CUT OUT the center 9:16 area.
    // 
    // Better approach: just outline the 9:16 area clearly and let the user
    // see that anything outside the canvas is cropped. The canvas bg is
    // transparent, so the dark page bg shows through outside the 9:16 area.
    // We add a white border around the crop area and a subtle overlay.

    // Rule of thirds grid overlay
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo((canvas.width / 3) * i, 0);
      ctx.lineTo((canvas.width / 3) * i, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (canvas.height / 3) * i);
      ctx.lineTo(canvas.width, (canvas.height / 3) * i);
      ctx.stroke();
    }

    // Crop area border (white glow)
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(255,255,255,0.15)";
    ctx.shadowBlur = 8;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    ctx.shadowBlur = 0;

    // Cross-hair center marker
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy);
    ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15);
    ctx.lineTo(cx, cy + 15);
    ctx.stroke();
  }, [offset, scale, rotation, aspectW, aspectH]);

  // Redraw on changes
  useEffect(() => {
    drawPreview();
  }, [drawPreview, imageSrc]);

  // --- Pointer handlers for smooth dragging ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSaving) return;
    setIsDragging(true);
    dragStartOffset.current = { x: offset.x, y: offset.y };
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isSaving) return;
    const cs = getCanvasScale();
    setOffset({
      x: dragStartOffset.current.x + (e.clientX - dragStartPos.current.x) * cs,
      y: dragStartOffset.current.y + (e.clientY - dragStartPos.current.y) * cs,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // --- Touch handlers for pinch-to-zoom ---
  const getTouchDist = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastPinchDist.current = getTouchDist(e.touches);
      pinchStartScale.current = scale;
    }

    // Double-tap detection
    if (e.touches.length === 1) {
      const now = Date.now();
      const tapPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const timeSince = now - lastTapTime.current;
      const distSince = Math.abs(tapPos.x - lastTapPos.current.x) + Math.abs(tapPos.y - lastTapPos.current.y);
      if (timeSince < 300 && distSince < 30) {
        // Double tap — toggle zoom between 1x and 1.8x
        setScale((prev) => (prev > 1.3 ? 1 : 1.8));
        lastTapTime.current = 0;
        return;
      }
      lastTapTime.current = now;
      lastTapPos.current = tapPos;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDist.current > 0) {
      e.preventDefault();
      const currentDist = getTouchDist(e.touches);
      const ratio = currentDist / lastPinchDist.current;
      setScale(Math.min(Math.max(pinchStartScale.current * ratio, 0.5), 3));
    }
  };

  const handleTouchEnd = () => {
    lastPinchDist.current = 0;
  };

  // --- Rotation ---
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // --- Zoom buttons ---
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.1, 0.5));
  };

  // --- Save: crop the visible 9:16 area ---
  const handleSave = async () => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    setIsSaving(true);

    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Create output canvas at max dimensions
      const outCanvas = document.createElement("canvas");
      let outW: number, outH: number;
      if (maxWidth / maxHeight > aspectW / aspectH) {
        outH = maxHeight;
        outW = outH * (aspectW / aspectH);
      } else {
        outW = maxWidth;
        outH = outW * (aspectH / aspectW);
      }
      outCanvas.width = Math.round(outW);
      outCanvas.height = Math.round(outH);
      const outCtx = outCanvas.getContext("2d");
      if (!outCtx) return;

      // Draw the visible portion of the preview canvas onto the output
      outCtx.drawImage(canvas, 0, 0, outCanvas.width, outCanvas.height);

      const blob = await new Promise<Blob | null>((resolve) => {
        outCanvas.toBlob((b) => resolve(b), "image/jpeg", quality);
      });

      if (blob) {
        const url = URL.createObjectURL(blob);
        onSave(blob, url);
      }
    } catch (err) {
      console.error("PhotoEditor save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (overlayRef.current) {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    }
  }, [isOpen, imageSrc]);

  return (
    <>
      {isOpen && imageSrc && (
        <div
          ref={overlayRef}
          className="fixed inset-0 bg-black/95 backdrop-blur-lg z-[200] flex flex-col"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Header */}
          <div className="px-4 py-4 flex items-center justify-between shrink-0 border-b border-border-default">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-glass flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-glass-hover transition-all active:scale-95"
            >
              <X size={18} />
            </button>
            <span className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">
              CROP TO {aspectRatio}
            </span>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95",
                isSaving
                  ? "bg-glass text-text-faint"
                  : "bg-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-black"
              )}
            >
              <Check size={18} />
            </button>
          </div>

          {/* Container — dark outside 9:16, canvas shows crop area */}
          <div
            ref={containerRef}
            className="flex-1 flex items-center justify-center overflow-hidden p-4 bg-black"
          >
            <div
              className={cn(
                "relative max-w-full max-h-full",
                isDragging ? "cursor-grabbing" : "cursor-grab"
              )}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {/* Dark vignette outside the 9:16 crop canvas */}
              <div className="absolute inset-0 rounded-xl shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.6)] pointer-events-none z-[1]" />
              <canvas
                ref={canvasRef}
                className="relative rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] z-[2]"
              />
            </div>
          </div>

          {/* Controls */}
          <div className="px-6 py-4 flex items-center justify-center gap-4 shrink-0 border-t border-border-default">
            <button
              onClick={handleZoomOut}
              className="px-4 py-2 rounded-xl bg-glass text-text-secondary hover:text-text-primary hover:bg-glass-hover text-xs font-black uppercase tracking-wider transition-all active:scale-95 border border-border-default"
            >
              ZOOM -
            </button>
            <button
              onClick={handleZoomIn}
              className="px-4 py-2 rounded-xl bg-glass text-text-secondary hover:text-text-primary hover:bg-glass-hover text-xs font-black uppercase tracking-wider transition-all active:scale-95 border border-border-default"
            >
              ZOOM +
            </button>
            <button
              onClick={handleRotate}
              className="px-4 py-2 rounded-xl bg-glass text-text-secondary hover:text-text-primary hover:bg-glass-hover text-xs font-black uppercase tracking-wider transition-all active:scale-95 border border-border-default flex items-center gap-2"
            >
              <RotateCw size={14} />
              ROTATE
            </button>
          </div>

          {/* Instructions */}
          <div className="pb-4 text-center text-micro font-black uppercase tracking-[0.25em] text-text-faint">
            Drag to reposition • Pinch to zoom • Double-tap to zoom in/out
          </div>
        </div>
      )}
    </>
  );
}
