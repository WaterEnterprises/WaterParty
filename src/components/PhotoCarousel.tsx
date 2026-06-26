import React from 'react';
import { UserIcon, ChevronLeft, X } from 'lucide-react';
import { Carousel } from './Carousel';
import { cn, useMediaQuery } from '../lib/utils';

interface PhotoCarouselProps {
  /** Array of photo URLs or media IDs */
  photos: string[];
  /** Current index (controlled) */
  currentIndex: number;
  /** Called when index changes */
  onIndexChange: (index: number) => void;
  /** Whether in landscape orientation (uses fixed height instead of 9:16) */
  isLandscape?: boolean;
  /** Optional trust score — renders the shield badge */
  trustScore?: number;
  /** Container class name — overrides default responsive sizing if height is set */
  className?: string;
  /** Content rendered on top of the carousel image (over gradient) */
  children?: React.ReactNode;
  /** Show navigation arrows */
  showArrows?: boolean;
  /** Show dot indicators */
  showDots?: boolean;
  /** Dot variant */
  dotVariant?: 'bars' | 'pills' | 'profile';
  /** Active dot color class */
  dotActiveColor?: string;
  /** Dot indicator position */
  dotPosition?: 'top' | 'bottom';
  /** Whether to use object-contain instead of object-cover */
  contain?: boolean;
  /** Aspect ratio override (default: "9/16" portrait, "auto" landscape) */
  aspectRatio?: string;
  /** Enable click-to-navigate zones (left/center/right tap areas) */
  clickToNavigate?: boolean;
  /** Called when center of photo is clicked (only with clickToNavigate) */
  onCenterClick?: () => void;
  /** Override gradient overlay (set to "none" to disable) */
  gradient?: string | 'none';
  /** Empty state icon */
  emptyIcon?: React.ReactNode;
  /** Empty state text */
  emptyText?: string;

  // ── Profile overlay props ─────────────────────────────────────
  /** If set, renders a close button (ChevronLeft if backButton, X otherwise) */
  onClose?: () => void;
  /** Close button icon style — back (left arrow) or x (default) */
  closeIcon?: 'back' | 'x';
  /** User name to overlay at the bottom of the carousel */
  userName?: string;
  /** User gender to show below the name */
  userGender?: string;
}

export function PhotoCarousel({
  photos,
  currentIndex,
  onIndexChange,
  isLandscape: isLandscapeProp,
  trustScore,
  className,
  children,
  showArrows = true,
  showDots = true,
  dotVariant = 'bars',
  dotActiveColor = 'bg-white',
  dotPosition,
  contain: containProp,
  aspectRatio: aspectRatioProp,
  gradient = 'from-brand-bg via-transparent to-brand-bg/20',
  emptyIcon,
  emptyText = 'No Photos',
  clickToNavigate,
  onCenterClick,
  onClose,
  closeIcon = 'x',
  userName,
  userGender,
}: PhotoCarouselProps) {
  // Auto-detect landscape for profile-style carousels when not explicitly set
  const detectedLandscape = useMediaQuery('(orientation: landscape) and (min-width: 768px)');
  const isLandscape = isLandscapeProp ?? detectedLandscape;

  const hasPhotos = photos.length > 0;
  const contain = containProp ?? isLandscape;
  const aspectRatio = aspectRatioProp ?? (isLandscape ? 'auto' : '9/16');

  const containerClass = cn(
    'relative w-full shrink-0',
    // Default responsive sizing: landscape = fixed height, portrait = 9:16
    // className can override these via twMerge (e.g. "h-96" replaces "h-[85dvh]")
    isLandscape ? 'h-[85dvh] max-h-[700px]' : 'aspect-[9/16]',
    className,
  );

  return (
    <div className={containerClass}>
      {hasPhotos ? (
        <Carousel
          photos={photos}
          currentIndex={currentIndex}
          onIndexChange={onIndexChange}
          showArrows={showArrows}
          showDots={showDots}
          dotVariant={dotVariant}
          dotActiveColor={dotActiveColor}
          dotPosition={dotPosition}
          className="absolute inset-0"
          aspectRatio={aspectRatio}
          contain={contain}
          clickToNavigate={clickToNavigate}
          onCenterClick={onCenterClick}
        >
          {/* Gradient overlay */}
          {gradient !== 'none' && (
            <div className={cn('absolute inset-0 bg-gradient-to-t pointer-events-none', gradient)} />
          )}

          {/* Trust score badge */}
          {trustScore !== undefined && (
            <div className="absolute bottom-6 right-6 z-20 pointer-events-auto">
              <div className="px-3 py-1.5 bg-black/80 backdrop-blur-md rounded-xl text-xs font-bold text-amber-400 flex items-center shadow-lg border border-border-default uppercase">
                🛡️ {trustScore.toFixed(1)} TRUST
              </div>
            </div>
          )}

          {/* Close button (profile overlay) */}
          {onClose && (
            <button onClick={onClose}
              className={cn(
                "absolute top-6 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors border border-border-default z-10 pointer-events-auto cursor-pointer",
                closeIcon === 'back' ? "left-6" : "right-6",
              )}
            >
              {closeIcon === 'back' ? <ChevronLeft size={20} /> : <X size={20} />}
            </button>
          )}

          {/* Name / gender overlay (profile) */}
          {userName && (
            <div className="absolute bottom-6 left-8 right-8 pointer-events-none z-10">
              <h2 className="text-4xl font-black text-text-primary tracking-widest uppercase mb-1 drop-shadow-lg">{userName}</h2>
              {userGender && <p className="text-sm font-bold text-brand-accent uppercase tracking-widest drop-shadow-md">{userGender}</p>}
            </div>
          )}

          {/* Children overlay */}
          {children}
        </Carousel>
      ) : (
        <div className="h-full w-full bg-overlay flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            {emptyIcon || <UserIcon size={64} className="text-text-faint" />}
            <p className="text-tiny text-text-faint tracking-widest uppercase">{emptyText}</p>
          </div>
        </div>
      )}
    </div>
  );
}
