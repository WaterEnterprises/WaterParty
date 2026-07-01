import React, { useState, useEffect, useCallback, useRef } from "react";
import { gsap } from "../lib/gsap";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { getAssetUrl } from "../lib/constants";

interface CarouselProps {
  /** Array of photo URLs or media IDs */
  photos: string[];
  /** Current index (controlled) */
  currentIndex?: number;
  /** Called when index changes */
  onIndexChange?: (index: number) => void;
  /** Whether navigation arrows are visible */
  showArrows?: boolean;
  /** Whether dot indicators are visible */
  showDots?: boolean;
  /** Auto-play interval in ms (0 = disabled) */
  autoPlay?: number;
  /** Whether to use object-contain instead of object-cover */
  contain?: boolean;
  /** Additional class names for the container */
  className?: string;
  /** Optional overlay gradient at the bottom (e.g., "from-black/80 via-transparent to-transparent") */
  overlayGradient?: string;
  /** Optional children rendered on top of the image */
  children?: React.ReactNode;
  /** Whether to enable click-to-navigate zones (left/center/right) */
  clickToNavigate?: boolean;
  /** Called when the center of the image is clicked (for opening modals) */
  onCenterClick?: () => void;
  /** The aspect ratio as a string, default "9/16". Use "auto" for fill/flex sizing. */
  aspectRatio?: string;
  /** Dot style variant: bars (top), pills (bottom), or profile (top pills with glow) */
  dotVariant?: "bars" | "pills" | "profile";
  /** Color of the active dot (CSS class, e.g. "bg-brand-accent") */
  dotActiveColor?: string;
  /** Position of dot indicators */
  dotPosition?: "top" | "bottom";
  /** Size variant */
  size?: "sm" | "md" | "lg" | "full";
}

export function Carousel({
  photos,
  currentIndex: externalIndex,
  onIndexChange,
  showArrows = true,
  showDots = true,
  autoPlay = 0,
  contain = false,
  className,
  overlayGradient,
  children,
  clickToNavigate = false,
  onCenterClick,
  aspectRatio = "9/16",
  dotVariant = "bars",
  dotActiveColor = "bg-white",
  dotPosition,
  size = "full",
}: CarouselProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const index = externalIndex ?? internalIndex;
  const setIndex = onIndexChange ?? setInternalIndex;

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const safePhotos = photos.filter(Boolean);
  const hasMultiple = safePhotos.length > 1;

  const goTo = useCallback((i: number) => {
    if (!hasMultiple) return;
    const next = ((i % safePhotos.length) + safePhotos.length) % safePhotos.length;
    setIndex(next);
  }, [hasMultiple, safePhotos.length, setIndex]);

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Auto-play
  useEffect(() => {
    if (!autoPlay || !hasMultiple) return;
    const timer = setInterval(next, autoPlay);
    return () => clearInterval(timer);
  }, [autoPlay, hasMultiple, next]);

  const imgRef = useRef<HTMLImageElement>(null);

  // GSAP crossfade on image index change
  useEffect(() => {
    if (imgRef.current) {
      gsap.fromTo(imgRef.current,
        { opacity: 0, scale: 1.05 },
        { opacity: 1, scale: 1, duration: 0.25, ease: "easeInOut" }
      );
    }
  }, [index]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    if (!hasMultiple) return;
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (diff > threshold) next();
    else if (diff < -threshold) prev();
  };

  if (!safePhotos.length) {
    return (
      <div className={cn("relative bg-[#111] overflow-hidden", className)}>
        <div className={cn("w-full", aspectRatio !== "auto" ? "aspect-[9/16]" : "h-full")} style={aspectRatio && aspectRatio !== "auto" && aspectRatio !== "9/16" ? { aspectRatio } : undefined} />
        {children && <div className="absolute inset-0">{children}</div>}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden bg-[#111] select-none",
        size === "sm" && "rounded-lg",
        size === "md" && "rounded-xl",
        size === "lg" && "rounded-2xl",
        size === "full" && "rounded-none",
        className,
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Image with transitions */}
      <div className={cn("w-full", aspectRatio !== "auto" ? "aspect-[9/16]" : "h-full")} style={aspectRatio && aspectRatio !== "auto" && aspectRatio !== "9/16" ? { aspectRatio } as React.CSSProperties : undefined}>
        <img
          key={index}
          ref={imgRef}
          src={getAssetUrl(safePhotos[index])}
          className={cn(
            "absolute inset-0 w-full h-full",
            contain ? "object-contain" : "object-cover",
          )}
          draggable={false}
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Overlay gradient */}
      {overlayGradient && (
        <div className={cn("absolute inset-0 pointer-events-none", overlayGradient)} />
      )}

      {/* Children overlay */}
      {children && (
        <div className="absolute inset-0 pointer-events-none">
          {children}
        </div>
      )}

      {/* Navigation Arrows */}
      {showArrows && hasMultiple && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 flex items-center justify-center text-text-secondary hover:text-text-primary transition-all border border-border-default active:scale-90"
            aria-label="Previous photo"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 flex items-center justify-center text-text-secondary hover:text-text-primary transition-all border border-border-default active:scale-90"
            aria-label="Next photo"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {/* Click zones for navigation */}
      {clickToNavigate && hasMultiple && (
        <>
          <div
            className="absolute top-0 left-0 bottom-0 w-1/3 z-10 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); prev(); }}
          />
          <div
            className="absolute top-0 left-1/3 right-1/3 bottom-0 z-10 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onCenterClick?.(); }}
          />
          <div
            className="absolute top-0 right-0 bottom-0 w-1/3 z-10 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); next(); }}
          />
        </>
      )}

      {/* Dot Indicators */}
      {showDots && hasMultiple && (
        <div className={cn(
          "absolute z-20 pointer-events-none",
          dotPosition === "bottom" && "bottom-3 inset-x-0 flex justify-center gap-1.5",
          dotPosition === "top" && "top-3 inset-x-0 flex justify-center gap-1.5",
          !dotPosition && dotVariant === "bars" && "top-3 inset-x-0 flex justify-center gap-1 px-4",
          !dotPosition && dotVariant === "pills" && "bottom-3 inset-x-0 flex justify-center gap-1.5",
          !dotPosition && dotVariant === "profile" && "top-6 inset-x-0 flex justify-center gap-1.5",
        )}>
          {safePhotos.map((_, idx) => {
            const isActive = idx === index;
            return (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); goTo(idx); }}
                className={cn(
                  "pointer-events-auto transition-all duration-300",
                  dotVariant === "bars"
                    ? cn("h-1 rounded-full flex-1", isActive ? dotActiveColor : "bg-glass-active")
                    : dotVariant === "profile"
                      ? cn(
                          "h-1.5 rounded-full",
                          isActive
                            ? "w-4 bg-brand-accent shadow-[0_0_8px_rgba(33,212,253,0.5)]"
                            : "w-1.5 bg-glass-active"
                        )
                      : cn("rounded-full", isActive
                        ? "w-2.5 h-2.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.5)]"
                        : "w-2 h-2 bg-glass-active hover:bg-glass0"
                      )
                )}
                aria-label={`Go to photo ${idx + 1}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
