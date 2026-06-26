import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Check,
  Waves,
  MapPin,
  Users,
  Calendar,
  Clock,
  ChevronLeft,
  Send,
  User as UserIcon,
} from "lucide-react";
import { ProfileDetails } from "../components/ProfileDetails";
import { Carousel } from "../components/Carousel";
import { PhotoCarousel } from "../components/PhotoCarousel";
import { cn, useMediaQuery } from "../lib/utils";
import { useStore } from "../lib/Store";
import { getAssetUrl, PLACEHOLDER_IMAGE, API_BASE, fetchWithAuth } from "../lib/constants";
import { useBackButton } from "../hooks/useBackButton";

const USER_PLACEHOLDER = PLACEHOLDER_IMAGE;
const PARTY_PLACEHOLDER = PLACEHOLDER_IMAGE;

// ─── Memoized SwipeCard ───────────────────────────────────────────────
interface SwipeCardProps {
  party: any;
  isTop: boolean;
  index: number;
  totalCount: number;
  currentIdx: number;
  swipeDir: "left" | "right" | null;
  coords: { lat: number; lon: number } | null;
  isLandscape: boolean;
  onSwipe: (dir: "left" | "right", partyId: string) => void;
  onPhotoNav: (partyId: string, dir: "prev" | "next") => void;
  onPhotoGoTo: (partyId: string, idx: number) => void;
  onUserClick: (userId: string) => void;
  onOpenDetail: (party: any, photoIdx: number) => void;
}

const SwipeCard = React.memo(function SwipeCard({
  party, isTop, index, totalCount, currentIdx, swipeDir,
  coords, isLandscape, onSwipe, onPhotoNav, onPhotoGoTo, onUserClick, onOpenDetail,
}: SwipeCardProps) {
  // Memoize date string so it doesn't recalculate on every render
  const dateStr = React.useMemo(() => {
    const date = party.StartTime ? new Date(party.StartTime) : new Date();
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    if (diffMs < 0 && diffMs > -4 * 3600 * 1000) return "HAPPENING NOW";
    if (diffMs < 0) return "ENDED";
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `IN ${diffDays} DAY${diffDays > 1 ? "S" : ""}`;
    if (diffHours > 0) return `IN ${diffHours} HOUR${diffHours > 1 ? "S" : ""}`;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `IN ${diffMins} MIN${diffMins > 1 ? "S" : ""}`;
  }, [party.StartTime]);

  // Memoize distance string
  const distanceStr = React.useMemo(() => {
    if (!coords || !party.GeoLat || !party.GeoLon) return null;
    const R = 6371;
    const dLat = ((party.GeoLat - coords.lat) * Math.PI) / 180;
    const dLon = ((party.GeoLon - coords.lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((coords.lat * Math.PI) / 180) *
        Math.cos((party.GeoLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  }, [coords?.lat, coords?.lon, party.GeoLat, party.GeoLon]);

  const photos: string[] = party.PartyPhotos?.length > 0 ? party.PartyPhotos : [];
  const displayImage =
    photos.length > 0
      ? getAssetUrl(photos[currentIdx] || photos[0])
      : party.Thumbnail
        ? getAssetUrl(party.Thumbnail)
        : PARTY_PLACEHOLDER;

  const exitX = swipeDir === "left" ? -300 : swipeDir === "right" ? 300 : 0;
  const exitRotate = swipeDir === "left" ? -15 : swipeDir === "right" ? 15 : 0;

  return (
    <motion.div
      className={cn(
        "absolute inset-0 overflow-hidden bg-[#050505]",
        !isTop && "pointer-events-none",
      )}
      style={{ zIndex: index }}
      initial={{ scale: 0.95, y: 20, opacity: 0 }}
      animate={{
        scale: isTop ? 1 : 0.95 - (totalCount - 1 - index) * 0.05,
        y: isTop ? 0 : (totalCount - 1 - index) * 15,
        opacity: 1,
      }}
      exit={{
        x: exitX,
        y: -20,
        opacity: 0,
        rotate: exitRotate,
        transition: { duration: 0.2, ease: "easeIn" },
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(e, { offset, velocity }) => {
        if (!isTop) return;
        const swipeThreshold = 100;
        if (offset.x > swipeThreshold || velocity.x > 500) {
          onSwipe("right", party.ID);
        } else if (offset.x < -swipeThreshold || velocity.x < -500) {
          onSwipe("left", party.ID);
        }
      }}
    >
      {/* GPU-accelerated container for smooth mobile animations */}
      <div className="absolute inset-0 bg-[#111] z-0 pointer-events-none" style={{ transform: 'translateZ(0)', willChange: 'transform' }}>
        {/* Only render full Carousel for the top card — cheaper img for others */}
        {isTop && photos.length > 0 ? (
          <Carousel
            photos={photos}
            currentIndex={currentIdx}
            onIndexChange={(idx) => onPhotoGoTo(party.ID, idx)}
            showArrows={false}
            showDots
            dotVariant="bars"
            dotActiveColor="bg-white"
            clickToNavigate
            onCenterClick={() => onOpenDetail(party, currentIdx)}
            className="absolute inset-0"
            aspectRatio="auto"
            contain={isLandscape}
          />
        ) : (
          <img
            src={displayImage}
            alt={party.Title}
            className={cn("w-full h-full", isLandscape ? "object-contain" : "object-cover")}
            referrerPolicy="no-referrer"
            loading={isTop ? "eager" : "lazy"}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-30 pointer-events-none" />
      </div>

      <div
        className="absolute inset-0 flex flex-col justify-end p-8 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"
        style={{ paddingBottom: "148px" }}
      >
        <div className="flex items-center space-x-2 mb-3 pointer-events-none">
          <span className="px-2.5 py-1 bg-glass-hover backdrop-blur-xl rounded-lg text-nano font-black text-brand-accent border border-border-default flex items-center shadow-lg">
            ⏳ {dateStr}
          </span>
          <span className="px-2.5 py-1 bg-glass backdrop-blur-xl rounded-lg text-nano font-black text-text-muted border border-border-default uppercase">
            {party.City || "Unknown"}
          </span>
          {distanceStr && (
            <span className="px-2.5 py-1 bg-glass backdrop-blur-xl rounded-lg text-nano font-black text-brand-accent border border-border-default uppercase">
              {distanceStr} KM
            </span>
          )}
        </div>

        <h2 className="text-3xl font-black text-text-primary leading-[0.8] mb-4 drop-shadow-2xl uppercase tracking-tighter pointer-events-none">
          {party.Title}
        </h2>

        <div className="flex items-center gap-3 mb-6 relative">
          <div
            className="flex items-center gap-3 cursor-pointer group pointer-events-auto"
            onClick={(e) => {
              if (!isTop) return;
              e.stopPropagation();
              onUserClick(party.HostID);
            }}
          >
            <img
              src={party.HostThumbnail ? getAssetUrl(party.HostThumbnail) : USER_PLACEHOLDER}
              className="w-10 h-10 rounded-full object-cover border-2 border-like shadow-[0_0_15px_rgba(0,255,163,0.4)] group-hover:scale-110 transition-transform"
              alt="Host Thumbnail"
            />
            <div className="flex flex-col">
              <span className="text-nano font-black text-text-muted uppercase tracking-widest leading-none mb-1">Hosted By</span>
              <span className="text-xs font-black text-text-primary uppercase tracking-wider">
                {(!party.HostName || party.HostName.toLowerCase() === "unknown") ? "" : party.HostName}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pointer-events-none">
          {party.VibeTags?.map((tag: string) => (
            <span key={tag} className="px-2 py-1 bg-glass-hover backdrop-blur-md rounded-md text-micro font-black text-text-secondary uppercase tracking-widest border border-border-default">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Touch Zones — only on the top card */}
      {isTop && (
        <>
          <div
            className="absolute top-0 left-0 bottom-[150px] w-1/3 z-10 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (photos.length > 1) onPhotoNav(party.ID, "prev");
              else onOpenDetail(party, currentIdx);
            }}
          />
          <div
            className="absolute top-0 left-1/3 right-1/3 bottom-[150px] z-10 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(party, currentIdx);
            }}
          />
          <div
            className="absolute top-0 right-0 bottom-[150px] w-1/3 z-10 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (photos.length > 1) onPhotoNav(party.ID, "next");
              else onOpenDetail(party, currentIdx);
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-[150px] z-10 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(party, currentIdx);
            }}
          />
        </>
      )}

      {/* Action buttons — only on the top card */}
      {isTop && (
        <div className="absolute bottom-[72px] inset-x-0 flex justify-center items-center gap-6 z-20 pointer-events-auto">
          <button
            onClick={(e) => { e.stopPropagation(); onSwipe("left", party.ID); }}
            className="w-16 h-16 flex flex-shrink-0 items-center justify-center rounded-full bg-black/30 backdrop-blur-md border border-brand-primary/50 text-brand-primary hover:bg-brand-primary hover:text-text-primary active:scale-90 transition-all duration-200 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
            aria-label="Pass"
          >
            <X size={32} strokeWidth={3} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSwipe("right", party.ID); }}
            className="w-16 h-16 flex flex-shrink-0 items-center justify-center rounded-full bg-black/30 backdrop-blur-md border border-like/50 text-like hover:bg-like hover:text-black active:scale-90 transition-all duration-200 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
            aria-label="Like"
          >
            <Check size={32} strokeWidth={3} />
          </button>
        </div>
      )}
    </motion.div>
  );
});

export function SwipePage() {
  const {
    feed,
    user,
    sendSocketMessage,
    removeFromFeed,
    coords,
    refreshLocation,
    chats,
    addLocalChat,
    fetchUserProfile,
  } = useStore();
  const navigate = useNavigate();
  const [swipeDir, setSwipeDir] = useState<{
    [key: string]: "left" | "right" | null;
  }>({});
  const [selectedParty, setSelectedParty] = useState<any | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [loadingUserProfile, setLoadingUserProfile] = useState(false);
  const [currentPartyPhotoIndex, setCurrentPartyPhotoIndex] = useState(0);
  const [currentUserPhotoIndex, setCurrentUserPhotoIndex] = useState(0);
  const [cardPhotoIndices, setCardPhotoIndices] = useState<Record<string, number>>({});
  // Track swiped party IDs locally so they stay hidden even if feed refreshes
  const swipedIdsRef = useRef<Set<string>>(new Set());
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());

  // Push history state when overlays open so back button closes them
  useEffect(() => {
    if (selectedUser || selectedParty) {
      window.history.pushState({ overlayOpen: true }, '');
    }
  }, [selectedUser !== null || selectedParty !== null]);

  // Back button handling — close overlays via popstate
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (selectedUser) {
        setSelectedUser(null);
        return;
      }
      if (selectedParty) {
        setSelectedParty(null);
        return;
      }
    };
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [selectedUser, selectedParty]);

  // Capacitor native back button — close overlays
  useBackButton(() => {
    if (selectedUser) setSelectedUser(null);
    else if (selectedParty) setSelectedParty(null);
  });

  const handleUserClick = async (userId: string) => {
    if (userId === user?.ID || loadingUserProfile) return;
    if (userId === user?.ID || loadingUserProfile) return;
    setLoadingUserProfile(true);
    try {
      const data = await fetchUserProfile(userId);
      if (data) {
        setCurrentUserPhotoIndex(0);
        setSelectedUser(data);
      } else {
        console.error("Failed to fetch user profile: not found");
      }
    } catch (e: any) {
      console.error("Failed to fetch user profile:", e);
    } finally {
      setLoadingUserProfile(false);
    }
  };

  const handleDMWithUserId = async (targetUserId: string, targetName?: string, targetThumbnail?: string) => {
    if (!user || !targetUserId) return;
    if (targetUserId === user.ID) return;

    // check if we already have a DM with this user
    const existingChat = chats.find(
      (c) =>
        !c.IsGroup &&
        c.ParticipantIDs?.includes(user.ID) &&
        c.ParticipantIDs?.includes(targetUserId),
    );

    if (existingChat) {
      setSelectedUser(null);
      setSelectedParty(null);
      navigate(`/chat/${existingChat.ID}`);
    } else {
      try {
        const res = await fetchWithAuth(`${API_BASE}/api/chats/dm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceUserId: user.ID,
            targetUserId: targetUserId,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.ChatID) {
            // Register new chat room instantly in client store
            addLocalChat({
              ID: data.ChatID,
              PartyID: "DM",
              Title: `${user.RealName} & ${targetName || "Host"}`,
              ImageUrl: targetThumbnail || "",
              RecentMessages: [],
              IsGroup: false,
              ParticipantIDs: [user.ID, targetUserId]
            });
            sendSocketMessage("GET_CHATS", {});
            setSelectedUser(null);
            setSelectedParty(null);
            navigate(`/chat/${data.ChatID}`);
          }
        }
      } catch (err) {
        console.error("Failed to create DM via POST:", err);
      }
    }
  };

  const handleDM = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!selectedUser) return;
    await handleDMWithUserId(selectedUser.ID, selectedUser.RealName, selectedUser.Thumbnail);
  };

  useEffect(() => {
    refreshLocation((newCoords) => {
      sendSocketMessage("GET_FEED", {
        Lat: newCoords.lat,
        Lon: newCoords.lon,
        RadiusKm: 50,
      });
    });

    // Fallback if location prompt is ignored/slow
    if (!coords) {
      sendSocketMessage("GET_FEED", { Lat: 0, Lon: 0 });
    }
  }, []);

  // Re-check location when user returns from system settings
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && !coords) {
        refreshLocation(
          (newCoords) => sendSocketMessage("GET_FEED", { Lat: newCoords.lat, Lon: newCoords.lon, RadiusKm: 50 }),
          () => {} // silently fail
        );
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [!coords]);

  const isLandscape = useMediaQuery('(orientation: landscape) and (min-width: 768px)');
  const [locBannerDismissed, setLocBannerDismissed] = useState(false);
  const showLocationPrompt = !coords && !locBannerDismissed;

  const handleEnableLocation = async () => {
    window.location.href = 'intent://#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;end';
    setTimeout(() => {
      window.location.href = 'package:com.waterparty.app';
    }, 500);
    setTimeout(() => {
      alert('Please enable location in your device settings to find nearby parties.');
    }, 1000);
  };

  const swipeFeed = feed.filter((p) => p.HostID !== user?.ID && !swipedIds.has(p.ID));
  const activeIndex = swipeFeed.length - 1;

  // Use refs to keep callbacks stable (avoid breaking React.memo on feed updates)
  const feedRef = useRef(feed);
  feedRef.current = feed;

  // Stable callbacks for memoized SwipeCard
  const handleSwipe = React.useCallback((dir: "left" | "right", partyId: string) => {
    setSwipeDir((prev) => ({ ...prev, [partyId]: dir }));
    swipedIdsRef.current = new Set(swipedIdsRef.current).add(partyId);
    setSwipedIds(new Set(swipedIdsRef.current));

    sendSocketMessage("SWIPE", { PartyID: partyId, Direction: dir });

    try { if (navigator.vibrate) navigator.vibrate(12); } catch {}

    setTimeout(() => { removeFromFeed(partyId); }, 300);
  }, [sendSocketMessage, removeFromFeed]);

  const handlePhotoNav = React.useCallback((partyId: string, dir: "prev" | "next") => {
    setCardPhotoIndices(prev => {
      const currentIdx = prev[partyId] || 0;
      const photos = feedRef.current.find(p => p.ID === partyId)?.PartyPhotos || [];
      if (photos.length <= 1) return prev;
      const nextIdx = dir === "next"
        ? (currentIdx + 1) % photos.length
        : ((currentIdx - 1) % photos.length + photos.length) % photos.length;
      return { ...prev, [partyId]: nextIdx };
    });
  }, []); // stable — uses feedRef instead of feed

  const handlePhotoGoTo = React.useCallback((partyId: string, idx: number) => {
    setCardPhotoIndices(prev => ({ ...prev, [partyId]: idx }));
  }, []);

  const handleOpenDetail = React.useCallback((party: any, photoIdx: number) => {
    setCurrentPartyPhotoIndex(photoIdx);
    setSelectedParty(party);
  }, []);

  const handleUserClickCb = React.useCallback((userId: string) => {
    if (userId === user?.ID) return;
    fetchUserProfile(userId).then(data => {
      if (data) {
        setCurrentUserPhotoIndex(0);
        setSelectedUser(data);
      }
    });
  }, [user?.ID, fetchUserProfile]);

  return (
    <div className="relative h-full w-full flex flex-col bg-[#050505] overflow-hidden">
      {/* Location prompt modal — full-screen overlay to guide user to enable GPS */}
      <AnimatePresence>
        {showLocationPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="bg-card border border-border-default rounded-3xl p-8 mx-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex flex-col items-center text-center gap-5">
                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-brand-accent/15 flex items-center justify-center">
                  <MapPin size={32} className="text-brand-accent" />
                </div>

                {/* Title */}
                <div>
                  <h3 className="text-lg font-black text-text-primary tracking-wide mb-1">
                    Enable Location
                  </h3>
                  <p className="text-tiny font-bold text-text-muted uppercase tracking-widest leading-relaxed">
                    Turn on GPS to discover parties happening near you
                  </p>
                </div>

                {/* Action buttons */}
                <div className="w-full flex flex-col gap-2 mt-1">
                  <button
                    onClick={handleEnableLocation}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-accent to-brand-secondary text-text-primary text-tiny font-black uppercase tracking-[0.15em] active:scale-95 hover:brightness-110 transition-all"
                  >
                    Turn On Location
                  </button>
                  <button
                    onClick={() => setLocBannerDismissed(true)}
                    className="w-full py-3 rounded-2xl bg-glass text-text-muted text-nano font-black uppercase tracking-[0.15em] hover:bg-glass-hover active:scale-95 transition-all"
                  >
                    Not Now
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header - Floating over the cards */}
      <header className="absolute left-0 right-0 px-6 pt-8 pb-4 flex justify-between items-center z-40 bg-gradient-to-b from-black/60 to-transparent pointer-events-none top-0">
        <div className="text-2xl font-black bg-gradient-to-r from-brand-primary to-brand-secondary text-transparent bg-clip-text tracking-tighter pointer-events-auto">
          WaterParty
        </div>
        <div className="bg-black/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-text-secondary tracking-wide flex items-center gap-1 pointer-events-auto border border-border-default">
          <Waves size={14} className="text-brand-accent" />{" "}
          <span className="mt-0.5 uppercase">Nearby</span>
        </div>
      </header>

      {/* Cards Container */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 w-full h-full overflow-hidden flex flex-col">
          {swipeFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 animate-in fade-in zoom-in duration-500">
              <Waves size={48} className="text-brand-accent opacity-80" />
              <div className="text-center">
                <h2 className="text-lg tracking-[0.2em] font-light text-text-muted uppercase">
                  Silence
                </h2>
                <p className="text-xs text-text-faint tracking-widest uppercase mt-1">
                  No parties nearby
                </p>
              </div>
            </div>
          ) : (
            <AnimatePresence>
              {swipeFeed.map((party, index) => (
                <SwipeCard
                  key={party.ID}
                  party={party}
                  isTop={index === activeIndex}
                  index={index}
                  totalCount={swipeFeed.length}
                  currentIdx={cardPhotoIndices[party.ID] || 0}
                  swipeDir={swipeDir[party.ID] || null}
                  coords={coords}
                  onSwipe={handleSwipe}
                  onPhotoNav={handlePhotoNav}
                  onPhotoGoTo={handlePhotoGoTo}
                  isLandscape={isLandscape}
                  onUserClick={handleUserClickCb}
                  onOpenDetail={handleOpenDetail}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Party Detail Overlay */}
      <AnimatePresence>
        {selectedParty && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-[50] flex items-center justify-center overflow-hidden bg-black"
          >
            <div className="w-full h-full bg-overlay overflow-y-auto scrollbar-hide flex flex-col relative">
              {selectedParty?.PartyPhotos?.length > 0 ? (
                <PhotoCarousel
                  photos={selectedParty.PartyPhotos}
                  currentIndex={currentPartyPhotoIndex}
                  onIndexChange={setCurrentPartyPhotoIndex}
                  isLandscape={isLandscape}
                  showDots
                  dotActiveColor="bg-brand-accent shadow-[0_0_8px_rgba(0,210,255,0.6)]"
                  gradient="from-overlay via-overlay/40 to-transparent"
                  clickToNavigate
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedParty(null);
                    }}
                    className="absolute top-8 left-6 w-10 h-10 z-20 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors border border-border-default cursor-pointer pointer-events-auto"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="absolute bottom-6 left-8 right-8 pointer-events-none z-10">
                    <h2 className="text-4xl font-black text-text-primary tracking-widest uppercase mb-2 drop-shadow-lg leading-tight">
                      {selectedParty.Title}
                    </h2>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-like inline-block shadow-[0_0_8px_rgba(0,255,163,0.8)]" />
                      <p className="text-sm font-bold text-text-primary uppercase tracking-widest drop-shadow-md">
                        Host •{" "}
                        {(!selectedParty.HostName || selectedParty.HostName.toLowerCase() === "unknown") ? "" : selectedParty.HostName}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedParty.VibeTags?.map((tag: string) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 bg-glass-active backdrop-blur-md rounded-lg text-tiny font-bold text-text-primary uppercase tracking-wide"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </PhotoCarousel>
              ) : (
                <div className={cn("relative w-full shrink-0 overflow-hidden", isLandscape ? "h-[85dvh] max-h-[700px]" : "aspect-[9/16]")}>
                  <img
                    src={getAssetUrl(selectedParty.Thumbnail || "") || PARTY_PLACEHOLDER}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-overlay via-overlay/40 to-transparent pointer-events-none" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedParty(null);
                    }}
                    className="absolute top-8 left-6 w-10 h-10 z-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors border border-border-default cursor-pointer"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="absolute bottom-6 left-8 right-8 pointer-events-none z-10">
                    <h2 className="text-4xl font-black text-text-primary tracking-widest uppercase mb-2 drop-shadow-lg leading-tight">
                      {selectedParty.Title}
                    </h2>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-like inline-block shadow-[0_0_8px_rgba(0,255,163,0.8)]" />
                      <p className="text-sm font-bold text-text-primary uppercase tracking-widest drop-shadow-md">
                        Host •{" "}
                        {(!selectedParty.HostName || selectedParty.HostName.toLowerCase() === "unknown") ? "" : selectedParty.HostName}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            <div className="p-5 pb-32 space-y-4 flex-1">
              {selectedParty.Description && (
                <div>
                  <h4 className="text-tiny font-black text-text-faint tracking-[0.2em] uppercase mb-1.5">
                    About
                  </h4>
                  <p className="text-sm font-medium text-text-secondary leading-relaxed tracking-tight">
                    {selectedParty.Description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-card border border-border-default rounded-2xl p-3.5">
                  <Calendar className="text-brand-accent mb-1.5" size={16} />
                  <p className="text-nano font-black text-text-faint uppercase tracking-widest block mb-0.5">
                    Date
                  </p>
                  <p className="text-xs font-bold text-text-primary uppercase">
                    {selectedParty.StartTime
                      ? new Date(selectedParty.StartTime).toLocaleDateString(
                          [],
                          { weekday: "short", month: "short", day: "numeric" },
                        )
                      : "TBD"}
                  </p>
                </div>
                <div className="bg-card border border-border-default rounded-2xl p-3.5">
                  <MapPin className="text-brand-accent mb-1.5" size={16} />
                  <p className="text-nano font-black text-text-faint uppercase tracking-widest block mb-0.5">
                    City
                  </p>
                  <p className="text-xs font-bold text-text-primary uppercase">
                    {selectedParty.City || "LOCATION TBD"}
                  </p>
                </div>
                <div className="bg-card border border-border-default rounded-2xl p-3.5">
                  <Users className="text-brand-accent mb-1.5" size={16} />
                  <p className="text-nano font-black text-text-faint uppercase tracking-widest block mb-0.5">
                    Capacity
                  </p>
                  <p className="text-xs font-bold text-text-primary uppercase tracking-tight">
                    {selectedParty.CurrentGuestCount || 0} /{" "}
                    {selectedParty.MaxCapacity || 300} MAX
                  </p>
                </div>
                <div className="bg-card border border-border-default rounded-2xl p-3.5">
                  <Clock className="text-brand-accent mb-1.5" size={16} />
                  <p className="text-nano font-black text-text-faint uppercase tracking-widest block mb-0.5">
                    Time
                  </p>
                  <p className="text-xs font-bold text-text-primary uppercase">
                    {selectedParty.StartTime
                      ? new Date(selectedParty.StartTime).toLocaleTimeString(
                          [],
                          { hour: "2-digit", minute: "2-digit" },
                        )
                      : "TBD"}
                  </p>
                </div>
              </div>

              <div
                onClick={() => handleUserClick(selectedParty.HostID)}
                className="bg-card border border-border-default rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-glass transition-colors active:scale-95"
              >
                <img
                  src={
                    selectedParty.HostThumbnail
                      ? getAssetUrl(selectedParty.HostThumbnail)
                      : USER_PLACEHOLDER
                  }
                  className="w-10 h-10 rounded-full object-cover border-2 border-like"
                />
                <div>
                  <p className="text-nano font-black text-text-muted uppercase tracking-widest block mb-0.5">
                    Hosted By
                  </p>
                  <p className="text-sm font-bold text-text-primary tracking-tight">
                    {(!selectedParty.HostName || selectedParty.HostName.toLowerCase() === "unknown") ? "" : selectedParty.HostName}
                  </p>
                </div>
                <ChevronLeft
                  size={16}
                  className="text-text-faint ml-auto rotate-180"
                />
              </div>
            </div>
           </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Profile Loading Overlay */}
      {loadingUserProfile && !selectedUser && (
        <div className="absolute inset-0 z-[55] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-tiny font-bold text-text-muted uppercase tracking-widest">Loading Profile...</p>
          </div>
        </div>
      )}

      {/* User Profile Overlay */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 250 }}
            className="absolute inset-0 z-[60] flex items-center justify-center overflow-hidden bg-black"
          >
            <div className="w-full h-full bg-overlay flex flex-col">
              {(() => {
                const photos = Array.isArray(selectedUser.ProfilePhotos) && selectedUser.ProfilePhotos.length > 0
                  ? selectedUser.ProfilePhotos
                  : [selectedUser.Thumbnail].filter(Boolean) as string[];
                return (
                  <ProfileDetails
                    user={selectedUser}
                    photos={photos}
                    currentPhotoIndex={currentUserPhotoIndex}
                    onPhotoIndexChange={setCurrentUserPhotoIndex}
                    onClose={() => setSelectedUser(null)}
                    closeIcon="back"
                    trustScore={selectedUser.TrustScore}
                    isLandscape={isLandscape}
                    showPhotoDots={photos.length > 1}
                    photoGradient="from-overlay via-transparent to-transparent opacity-60"
                    actions={
                      <div className="pt-4">
                        <button
                          onClick={handleDM}
                          className="w-full py-5 rounded-3xl bg-white text-black text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-white/90"
                        >
                          <Send size={16} />
                          Send Message
                        </button>
                      </div>
                    }
                  />
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}