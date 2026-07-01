import { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  Info,
  Calendar,
  MapPin,
  Users,
  Clock,
  Trash2,
  X,
} from "lucide-react";
import { PhotoCarousel } from "../components/PhotoCarousel";
import { cn, useMediaQuery } from "../lib/utils";
import { gsap } from "../lib/gsap";
import { getAssetUrl, API_BASE, fetchWithAuth, PLACEHOLDER_IMAGE } from "../lib/constants";
import { FundraiserContributeModal } from "../components/FundraiserContributeModal";
import { CameraCapture } from "../components/CameraCapture";
import { ChatLightbox } from "../components/ChatLightbox";
import { ReportUserModal } from "../components/ReportUserModal";
import { ChatInputBar } from "../components/ChatInputBar";
import { VideoCard } from "../components/VideoCard";
import { ProfileDetails } from "../components/ProfileDetails";
import { useChatRoom } from "../hooks/useChatRoom";

/** Helper to fetch with session auth header */
function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetchWithAuth(url, options);
}

export function PartyChatPage() {
  const ctx = useChatRoom();
  const {
    messages, messagesLoading,
    chat, associatedParty, isHost, user, navigate, chats,
    registrations, sendSocketMessage, addLocalChat,
    scrollRef, fileInputRef,
    message, setMessage,
    selectedImage, setSelectedImage,
    selectedImageFile, setSelectedImageFile,
    selectedVideo, setSelectedVideo,
    selectedVideoFile, setSelectedVideoFile,
    uploadError, setUploadError,
    uploadingImage, setUploadingImage,
    sending,
    showInfo, setShowInfo,
    selectedUser, setSelectedUser,
    selectedUserPhotoIndex, setSelectedUserPhotoIndex,
    lightboxImage, setLightboxImage,
    lightboxVideo, setLightboxVideo,
    showReportModal, setShowReportModal,
    reportReason, setReportReason,
    reportDetails, setReportDetails,
    reportingInFlight, setReportingInFlight,
    reportSuccess, setReportSuccess,
    reportError, setReportError,
    reportTargetUser, setReportTargetUser,
    showCameraCapture, setShowCameraCapture,
    handleSend, handleLocalImageUpload,
    handleDownloadMedia, handleDownloadImage,
    handleReportSubmit, handleUserClick, handleDM, handleCameraCapture,
    getETA,
  } = ctx;

  // ── Party-specific state ──────────────────────────────────────
  const [showManagement, setShowManagement] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [partyPhotoIndex, setPartyPhotoIndex] = useState(0);
  const [showFundraiser, setShowFundraiser] = useState(false);
  const [stripeConnected, setStripeConnected] = useState<boolean | null>(null);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const mgmtRef = useRef<HTMLDivElement>(null);
  const userOverlayRef = useRef<HTMLDivElement>(null);

  // Reset party-specific state when chat changes
  useEffect(() => {
    setShowManagement(false);
    setIsConfirmingDelete(false);
    setPartyPhotoIndex(0);
    setShowFundraiser(false);
    setStripeConnected(null);
    setOnboardingUrl(null);

  }, [chat?.ID]);

  // Fetch registrations when management opens
  useEffect(() => {
    if (isHost && showManagement && associatedParty) {
      sendSocketMessage("GET_REGISTRATIONS", { PartyID: associatedParty.ID });
    }
  }, [showManagement, isHost, associatedParty?.ID]);

  // Check Stripe Connect status when info panel opens
  useEffect(() => {
    if (showInfo && isHost) {
      authFetch(`${API_BASE}/api/connect/status`)
        .then((r) => r.json())
        .then((data) => setStripeConnected(data.connected))
        .catch(() => setStripeConnected(false));

    }
  }, [showInfo, isHost]);

  useEffect(() => {
    if (showInfo && sidebarRef.current) {
      gsap.fromTo(sidebarRef.current, { x: "100%" }, { x: 0, duration: 0.35, ease: "power3.inOut" });
    }
  }, [showInfo]);

  useEffect(() => {
    if (showManagement && mgmtRef.current) {
      gsap.fromTo(mgmtRef.current, { y: "100%" }, { y: 0, duration: 0.35, ease: "power3.out" });
    }
  }, [showManagement]);

  useEffect(() => {
    if (!!selectedUser && userOverlayRef.current) {
      gsap.fromTo(userOverlayRef.current, { y: "100%" }, { y: 0, duration: 0.35, ease: "power3.out" });
    }
  }, [selectedUser]);

  const handleConnectStripe = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/connect/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setOnboardingUrl(data.onboardingUrl);
        window.open(data.onboardingUrl, "_blank");
        setTimeout(async () => {
          try {
            const statusRes = await authFetch(`${API_BASE}/api/connect/status`);
            const statusData = await statusRes.json();
            setStripeConnected(statusData.connected);
          } catch {}
        }, 5000);
      }
    } catch (e) {
      console.error("Failed to create onboarding link:", e);
    }
  };

  const handleDeleteParty = () => {
    if (!associatedParty) return;
    sendSocketMessage("DELETE_PARTY", { PartyID: associatedParty.ID });
    navigate("/messages");
  };

  // ── Date helpers ───────────────────────────────────────────────
  function formatDateLabel(ts: string): string {
    const d = new Date(ts);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
    if (diffDays === 0) return "TODAY";
    if (diffDays === 1) return "YESTERDAY";
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  }

  function isSameDay(a: string, b: string): boolean {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
  }

  // ── Message bubbles ───────────────────────────────────────────
  const renderMessageBubbles = () => (
    <>
      {messages.map((msg: any, idx: number) => {
        const isMe = msg.SenderID === user?.ID;
        const prevMsg = idx > 0 ? messages[idx - 1] : null;
        const showDateSep = !prevMsg || !isSameDay(prevMsg.CreatedAt || prevMsg.Timestamp, msg.CreatedAt || msg.Timestamp);
        return (
          <div key={msg.ID || idx}>
            {showDateSep && (
              <div className="flex justify-center mb-6">
                <span className="px-4 py-1.5 rounded-full bg-glass text-tiny font-black text-text-faint uppercase tracking-[0.2em] select-none">
                  {formatDateLabel(msg.CreatedAt || msg.Timestamp)}
                </span>
              </div>
            )}
          <div className={cn("flex gap-3 mb-6", isMe ? "flex-row-reverse" : "flex-row")}>
            {!isMe && (
              <img
                src={msg.SenderThumbnail ? getAssetUrl(msg.SenderThumbnail) : PLACEHOLDER_IMAGE}
                className="w-9 h-9 rounded-xl object-cover border border-border-default bg-glass shrink-0 cursor-pointer hover:border-brand-accent transition-all active:scale-95 self-end"
                onClick={() => handleUserClick(msg.SenderID)}
              />
            )}
            <div className={cn("flex flex-col max-w-[75%]", isMe ? "items-end" : "items-start")}>
              <div
                onClick={() => !isMe && handleUserClick(msg.SenderID)}
                className={cn(
                  "px-5 py-3.5 rounded-[28px] shadow-2xl relative overflow-hidden",
                  isMe
                    ? "bg-gradient-to-br from-brand-primary to-brand-secondary text-text-primary rounded-tl-none"
                    : "bg-[#1A1A24] text-text-bright rounded-tr-none border border-border-default cursor-pointer hover:bg-[#252533] transition-colors",
                  (msg.ImageUrl || msg.VideoUrl) && "p-1.5 max-w-[280px]"
                )}
              >
                {msg.ImageUrl && !msg.VideoUrl && (
                  <div className="relative rounded-[20px] overflow-hidden bg-black/40">
                    <img
                      src={getAssetUrl(msg.ImageUrl)}
                      alt="Attached media"
                      className="w-full max-h-72 object-cover rounded-[20px] cursor-zoom-in hover:scale-[1.02] active:scale-95 transition-all duration-200"
                      referrerPolicy="no-referrer"
                      onClick={(e) => { e.stopPropagation(); setLightboxImage(getAssetUrl(msg.ImageUrl)); }}
                    />
                  </div>
                )}
                {msg.VideoUrl && (
                  <VideoCard
                    videoUrl={getAssetUrl(msg.VideoUrl)}
                    onClick={() => setLightboxVideo(getAssetUrl(msg.VideoUrl))}
                    thumbnailUrl={msg.ImageUrl ? getAssetUrl(msg.ImageUrl) : undefined}
                  />
                )}
                {msg.Content && (
                  <p className={cn("text-sm font-medium leading-relaxed tracking-tight", (msg.ImageUrl || msg.VideoUrl) ? "px-3.5 py-2.5 mt-1" : "")}>
                    {msg.Content}
                  </p>
                )}
              </div>
              <p className="text-micro mt-2 font-black uppercase tracking-widest text-text-faint px-1">
                {new Date(msg.CreatedAt || msg.Timestamp || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
          </div>
        );
      })}
      {(!messages || messages.length === 0) && !messagesLoading && (
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <p className="text-xs font-black text-text-faint uppercase tracking-[0.4em]">Establishing Signal...</p>
        </div>
      )}
      {messagesLoading && (
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <p className="text-xs font-black text-text-faint uppercase tracking-[0.4em] animate-pulse">Syncing Messages...</p>
        </div>
      )}
    </>
  );

  const isLandscape = useMediaQuery('(orientation: landscape) and (min-width: 768px)');

  return (
    <div className="h-full w-full flex flex-col bg-overlay shadow-2xl">
      {/* Header */}
      <header className="px-4 py-4 flex items-center justify-between border-b border-border-default bg-card z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/messages", { state: { activeTab: "party" } })}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-glass text-text-muted active:scale-95 transition-all"><ChevronLeft size={20} /></button>
          <div onClick={() => setShowInfo(true)} className="flex items-center gap-3 cursor-pointer group">
            <img src={chat.ImageUrl ? getAssetUrl(chat.ImageUrl) : PLACEHOLDER_IMAGE}
              className="w-10 h-10 rounded-full object-cover border border-border-default group-hover:border-brand-accent transition-colors" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-text-primary truncate max-w-[150px] group-hover:text-brand-accent transition-colors">{chat.Title}</h3>
              <p className="text-nano font-black text-brand-accent uppercase tracking-widest">{getETA()}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isHost && (
            <button onClick={() => setShowManagement(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-glass text-brand-accent hover:bg-glass-hover active:scale-95 transition-all"><Users size={20} /></button>
          )}
          <button onClick={() => setShowInfo(!showInfo)}
            className={cn("w-10 h-10 flex items-center justify-center rounded-xl transition-all", showInfo ? "bg-brand-accent text-overlay" : "bg-glass text-text-muted")}><Info size={20} /></button>
        </div>
      </header>

      {/* Fundraiser Progress Bar */}
      {chat.IsGroup && associatedParty?.CrowdfundTarget != null && Number(associatedParty.CrowdfundTarget) > 0 && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent border-b border-border-default shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-nano font-black text-rose-400 uppercase tracking-widest">Fundraiser</span>
            </div>
            <span className="text-nano font-bold text-text-muted">${(associatedParty.CrowdfundCurrent || 0).toFixed(0)} / ${associatedParty.CrowdfundTarget.toFixed(0)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-glass overflow-hidden mb-2">
            <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-700 ease-out"
              style={{ width: `${Math.min(((associatedParty.CrowdfundCurrent || 0) / associatedParty.CrowdfundTarget) * 100, 100)}%` }} />
          </div>
          <button onClick={() => setShowFundraiser(true)}
            className="w-full py-2 rounded-xl bg-glass border border-border-default text-nano font-black uppercase tracking-widest text-text-secondary hover:text-text-primary hover:bg-glass-hover transition-all active:scale-95 flex items-center justify-center gap-2">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            Contribute to this party
          </button>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Chat Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-hide pb-10">
          <div className="py-4" />
          {renderMessageBubbles()}
        </div>

        {/* Party Info Sidebar */}
        {showInfo && (
          <div ref={sidebarRef} className="absolute inset-0 bg-overlay z-20 border-l border-border-default flex flex-col overflow-y-auto scrollbar-hide">
            {chat.IsGroup && (
              <>
                {associatedParty?.PartyPhotos && associatedParty.PartyPhotos.length > 0 && (
                  <div className="relative shrink-0">
                    <PhotoCarousel photos={associatedParty.PartyPhotos || []} currentIndex={partyPhotoIndex} onIndexChange={setPartyPhotoIndex}
                      isLandscape={isLandscape}
                      dotVariant="profile" contain
                      gradient="from-overlay via-overlay/40 to-transparent" />
                    <button onClick={(e) => { e.stopPropagation(); setShowInfo(false); setPartyPhotoIndex(0); }}
                      className="absolute top-8 right-6 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors border border-border-default z-10 cursor-pointer"><X size={20} /></button>
                  </div>
                )}
                <div className="p-5 space-y-4">
                  <div>
                    <h2 className="text-3xl font-black text-text-primary tracking-widest uppercase mb-1">{associatedParty?.Title || chat.Title}</h2>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
                      <p className="text-tiny font-black text-brand-accent uppercase tracking-[0.2em]">{associatedParty?.PartyType || "SESSION"}</p>
                    </div>
                    <p className="text-sm font-medium text-text-muted leading-relaxed uppercase tracking-tight">{associatedParty?.Description || "NO DATA RECEIVED"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-card border border-border-default rounded-2xl p-3.5">
                      <Calendar className="text-brand-accent mb-1.5" size={16} />
                      <p className="text-nano font-black text-text-faint uppercase tracking-widest block mb-0.5">Timeline</p>
                      <p className="text-xs font-bold text-text-primary uppercase">{associatedParty?.StartTime ? new Date(associatedParty.StartTime).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : "TBD"}</p>
                    </div>
                    <div className="bg-card border border-border-default rounded-2xl p-3.5">
                      <MapPin className="text-brand-accent mb-1.5" size={16} />
                      <p className="text-nano font-black text-text-faint uppercase tracking-widest block mb-0.5">Vibe City</p>
                      <p className="text-xs font-bold text-text-primary uppercase">{associatedParty?.City || "LOCATION TBD"}</p>
                    </div>
                    <div className="bg-card border border-border-default rounded-2xl p-3.5">
                      <Users className="text-brand-accent mb-1.5" size={16} />
                      <p className="text-nano font-black text-text-faint uppercase tracking-widest block mb-0.5">Sync count</p>
                      <p className="text-xs font-bold text-text-primary uppercase tracking-tight">{associatedParty?.CurrentGuestCount || 0} / {associatedParty?.MaxCapacity || 300} GUESTS</p>
                    </div>
                    <div className="bg-card border border-border-default rounded-2xl p-3.5">
                      <Clock className="text-brand-accent mb-1.5" size={16} />
                      <p className="text-nano font-black text-text-faint uppercase tracking-widest block mb-0.5">Status</p>
                      <p className="text-xs font-bold text-text-primary uppercase">{getETA()}</p>
                    </div>
                  </div>
                  <div className="bg-card border border-border-default rounded-2xl p-4">
                    <h4 className="text-tiny font-black text-text-primary tracking-[0.2em] uppercase mb-1.5 flex items-center gap-2"><MapPin size={12} className="text-brand-accent" /> EXACT COORDINATES</h4>
                    <p className="text-tiny font-bold text-text-muted leading-relaxed">{associatedParty?.Address || "Visible only to confirmed attendees"}</p>
                  </div>
                  {associatedParty && !isHost && (
                    <div onClick={() => handleUserClick(associatedParty.HostID)} className="bg-card border border-border-default rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-glass transition-colors active:scale-95">
                      <img src={associatedParty.HostThumbnail ? getAssetUrl(associatedParty.HostThumbnail) : PLACEHOLDER_IMAGE}
                        className="w-10 h-10 rounded-full object-cover border-2 border-like" />
                      <div>
                        <p className="text-nano font-black text-text-muted uppercase tracking-widest block mb-0.5">Hosted By</p>
                        <p className="text-sm font-bold text-text-primary tracking-tight">{(associatedParty.HostName && associatedParty.HostName.toLowerCase() !== "unknown") ? associatedParty.HostName : ""}</p>
                      </div>
                      <ChevronLeft size={16} className="text-text-faint ml-auto rotate-180" />
                    </div>
                  )}
                  {user && associatedParty && associatedParty.HostID !== user.ID && (
                    <button onClick={async (e) => { e.stopPropagation(); /* DM the host */ if (!user || !associatedParty.HostID) return; const targetUserId = associatedParty.HostID; const targetName = (associatedParty.HostName && associatedParty.HostName.toLowerCase() !== "unknown") ? associatedParty.HostName : ""; const targetThumbnail = associatedParty.HostThumbnail; const existingChat = chats.find((c) => !c.IsGroup && c.ParticipantIDs?.includes(user.ID) && c.ParticipantIDs?.includes(targetUserId)); if (existingChat) { setShowInfo(false); setSelectedUser(null); navigate(`/chat/${existingChat.ID}`); } else { try { const res = await authFetch(`${API_BASE}/api/chats/dm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceUserId: user.ID, targetUserId: targetUserId }) }); if (res.ok) { const data = await res.json(); if (data && data.ChatID) { addLocalChat({ ID: data.ChatID, PartyID: "DM", Title: `${user.RealName} & ${targetName || "Host"}`, ImageUrl: targetThumbnail || "", RecentMessages: [], IsGroup: false, ParticipantIDs: [user.ID, targetUserId] }); sendSocketMessage("GET_CHATS", {}); setShowInfo(false); setSelectedUser(null); navigate(`/chat/${data.ChatID}`); } } } catch (err) { console.error("Failed to create DM with host:", err); } } }}
                      className="w-full mt-4 py-4 rounded-3xl bg-white text-black text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-white/90"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg> Send Message to Host</button>
                  )}

                  {/* Host Controls */}
                  {isHost && associatedParty && (
                    <div className="pt-8 border-t border-border-default mt-6 space-y-4">
                      {!isConfirmingDelete ? (
                        <button onClick={() => setIsConfirmingDelete(true)}
                          className="w-full py-5 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500 text-tiny font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-red-500/20">
                          <Trash2 size={16} /> Dissolve Party Hub
                        </button>
                      ) : (
                        <div className="flex flex-col gap-4">
                          <p className="text-red-500 text-tiny text-center font-bold tracking-widest uppercase">Are you absolutely sure? This cannot be undone.</p>
                          <div className="flex gap-3">
                            <button onClick={handleDeleteParty} className="flex-1 py-4 rounded-[20px] bg-red-500 border border-red-500 text-text-primary text-tiny font-black uppercase tracking-[0.2em] flex items-center justify-center active:scale-95 transition-all outline-none">YES, DISSOLVE</button>
                            <button onClick={() => setIsConfirmingDelete(false)} className="flex-1 py-4 rounded-[20px] bg-glass border border-border-default text-text-primary text-tiny font-black uppercase tracking-[0.2em] flex items-center justify-center active:scale-95 transition-all hover:bg-glass-hover outline-none">CANCEL</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Management Overlay */}
        {showManagement && (
          <div ref={mgmtRef} className="absolute inset-x-0 bottom-0 top-0 bg-overlay z-30 flex flex-col">
            <header className="px-6 py-6 border-b border-border-default flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-black text-text-primary uppercase tracking-widest">Guest Control</h3>
                <p className="text-nano font-bold text-text-faint uppercase mt-1">Manage Signal Requests</p>
              </div>
              <button onClick={() => setShowManagement(false)} className="w-10 h-10 rounded-xl bg-glass flex items-center justify-center text-text-muted"><X size={20} /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {registrations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-20 py-20">
                  <Users size={48} className="mb-4" />
                  <p className="text-xs font-black uppercase tracking-[0.3em]">No Pending Signals</p>
                </div>
              ) : (
                registrations.map((reg: any) => (
                  <div key={reg.ID} className="bg-card border border-border-default rounded-3xl p-4 flex items-center gap-4">
                    <img onClick={() => handleUserClick(reg.UserID)}
                      src={getAssetUrl(reg.UserThumbnail || reg.UserProfilePhotos?.[0] || "") || PLACEHOLDER_IMAGE}
                      className="w-12 h-12 rounded-full object-cover border border-border-default cursor-pointer hover:border-brand-accent transition-colors" />
                    <div className="flex-1 min-w-0" onClick={() => handleUserClick(reg.UserID)}>
                      <p className="text-sm font-bold text-text-primary truncate cursor-pointer hover:text-brand-accent transition-colors">{reg.RealName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("text-micro font-black uppercase px-2 py-0.5 rounded-full border", reg.Status === "PENDING" ? "text-yellow-500 border-yellow-500/20 bg-yellow-500/5" : "text-brand-accent border-brand-accent/20 bg-brand-accent/5")}>{reg.Status}</span>
                        <span className="text-micro font-bold text-text-faint uppercase">{new Date(reg.Timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {reg.Status === "PENDING" && (
                      <button onClick={() => sendSocketMessage("APPROVE_JOIN_REQUEST", { RegistrationID: reg.ID })}
                        className="px-4 py-2 bg-brand-accent text-overlay text-tiny font-black rounded-xl active:scale-95 transition-all shadow-lg shadow-brand-accent/20">APPROVE</button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* User Profile Overlay */}
        {!!selectedUser && (
          <div ref={userOverlayRef} className="absolute inset-0 bg-overlay z-[60] flex flex-col overflow-y-auto scrollbar-hide">
            <ProfileDetails
              user={selectedUser}
              photos={(selectedUser.ProfilePhotos?.length > 0 ? selectedUser.ProfilePhotos : [selectedUser.Thumbnail || ""]).filter(Boolean)}
              currentPhotoIndex={selectedUserPhotoIndex}
              onPhotoIndexChange={setSelectedUserPhotoIndex}
              onClose={() => { setSelectedUser(null); setSelectedUserPhotoIndex(0); }}
              closeIcon="back"
              trustScore={selectedUser.TrustScore}
              actions={
                <div className="flex flex-col items-center w-full pt-4">
                  <div className="pt-6 border-t border-border-default uppercase w-full max-w-sm">
                    <button onClick={() => { setReportReason(""); setReportDetails(""); setReportError(null); setReportSuccess(false); setReportTargetUser(selectedUser); setShowReportModal(true); }}
                      className="w-full py-4 text-xs font-black text-red-500 hover:text-red-400 transition-colors tracking-widest text-center cursor-pointer">REPORT PROFILE</button>
                  </div>
                  {chat.IsGroup && handleDM && (
                    <div className="pt-4 w-full max-w-sm">
                      <button onClick={handleDM} className="w-full py-5 rounded-3xl bg-white text-black text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-white/90">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        Send Message
                      </button>
                    </div>
                  )}
                </div>
              }
            />
          </div>
        )}

        {/* Lightbox */}
        <ChatLightbox
          lightboxImage={lightboxImage}
          lightboxVideo={lightboxVideo}
          onCloseImage={() => setLightboxImage(null)}
          onCloseVideo={() => setLightboxVideo(null)}
          onDownloadImage={handleDownloadImage}
          onDownloadVideo={(url) => handleDownloadMedia(url, true)}
        />

        {/* Report Modal */}
        <ReportUserModal
          show={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetUser={reportTargetUser}
          reason={reportReason}
          onReasonChange={setReportReason}
          details={reportDetails}
          onDetailsChange={setReportDetails}
          error={reportError}
          onClearError={() => setReportError(null)}
          success={reportSuccess}
          inFlight={reportingInFlight}
          onSubmit={handleReportSubmit}
        />
      </div>

      {/* Input */}
      <ChatInputBar
        fileInputRef={fileInputRef}
        handleLocalImageUpload={handleLocalImageUpload}
        uploadError={uploadError}
        onClearUploadError={() => setUploadError(null)}
        selectedImage={selectedImage}
        selectedVideo={selectedVideo}
        onClearSelectedMedia={() => { setSelectedImage(null); setSelectedVideo(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
        uploadingImage={uploadingImage}
        sending={sending}
        showCameraCapture={showCameraCapture}
        onOpenCamera={() => setShowCameraCapture(true)}
        onOpenGallery={() => fileInputRef.current?.click()}
        message={message}
        onMessageChange={setMessage}
        handleSend={handleSend}
      />

      {/* Fundraiser Modal */}
      {associatedParty && (
        <FundraiserContributeModal
          open={showFundraiser}
          onClose={() => setShowFundraiser(false)}
          partyId={associatedParty.ID}
          partyTitle={associatedParty.Title}
          currentAmount={associatedParty.CrowdfundCurrent || 0}
          targetAmount={associatedParty.CrowdfundTarget || 0}
          currency={associatedParty.CrowdfundCurrency}
        />
      )}

      {/* Camera Capture */}
      <CameraCapture
        open={showCameraCapture}
        onClose={() => setShowCameraCapture(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
}
