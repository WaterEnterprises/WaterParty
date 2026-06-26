import { useState, useEffect } from "react";
import {
  ChevronLeft,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { getAssetUrl, PLACEHOLDER_IMAGE } from "../lib/constants";
import { useStore } from "../lib/Store";
import { CameraCapture } from "../components/CameraCapture";
import { ChatLightbox } from "../components/ChatLightbox";
import { ReportUserModal } from "../components/ReportUserModal";
import { ChatInputBar } from "../components/ChatInputBar";
import { VideoCard } from "../components/VideoCard";
import { TipModal } from "../components/TipModal";

import { ProfileDetails } from "../components/ProfileDetails";
import { useChatRoom } from "../hooks/useChatRoom";

export function DmChatPage() {
  const ctx = useChatRoom();
  const { fetchUserProfile } = useStore();
  const {
    messages, messagesLoading,
    chat, user, navigate,
    sendSocketMessage, removeChat,
    scrollRef, fileInputRef,
    message, setMessage,
    selectedImage, setSelectedImage,
    selectedVideo, setSelectedVideo,
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
    handleReportSubmit, handleUserClick,
    handleCameraCapture,
  } = ctx;

  // ── DM-specific state ─────────────────────────────────────────
  const [otherUser, setOtherUser] = useState<any | null>(null);
  const [otherUserPhotoIndex, setOtherUserPhotoIndex] = useState(0);
  const [isConfirmingDeleteDm, setIsConfirmingDeleteDm] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);

  // Fetch other user info (cached via IndexedDB)
  useEffect(() => {
    if (chat && !chat.IsGroup && user) {
      const otherId = chat.ParticipantIDs?.find((id: string) => id !== user.ID);
      if (otherId) {
        fetchUserProfile(otherId).then(data => {
          if (data) setOtherUser(data);
        });
      }
    }
  }, [chat, user, fetchUserProfile]);

  // Reset DM-specific state on chat change
  useEffect(() => {
    setOtherUser(null);
    setOtherUserPhotoIndex(0);
    setIsConfirmingDeleteDm(false);
  }, [chat?.ID]);

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
          <div className={cn("flex gap-3 mb-6", isMe ? "justify-end" : "flex-row-reverse")}>
            {!isMe && (
              <img
                src={
                  otherUser && msg.SenderID === otherUser.ID
                    ? getAssetUrl(otherUser.Thumbnail || otherUser.ProfilePhotos?.[0] || "")
                    : chat.ImageUrl
                      ? getAssetUrl(chat.ImageUrl)
                      : PLACEHOLDER_IMAGE
                }
                className="w-10 h-10 rounded-2xl object-cover border border-border-default bg-glass shrink-0 cursor-pointer hover:border-brand-accent transition-all active:scale-95"
                onClick={() => handleUserClick(msg.SenderID)}
              />
            )}
            <div className={cn("flex flex-col max-w-[75%]", isMe ? "items-start" : "items-end")}>
              <div
                onClick={() => !isMe && handleUserClick(msg.SenderID)}
                className={cn(
                  "px-5 py-3.5 rounded-[28px] shadow-2xl relative overflow-hidden",
                  isMe
                    ? "bg-gradient-to-br from-brand-primary to-brand-secondary text-text-primary rounded-tr-none"
                    : "bg-[#1A1A24] text-text-bright rounded-tl-none border border-border-default cursor-pointer hover:bg-[#252533] transition-colors",
                  (msg.ImageUrl || msg.VideoUrl) && "p-1.5 max-w-[280px]"
                )}
              >
                {msg.ImageUrl && !msg.VideoUrl && (
                  <div className="relative rounded-[20px] overflow-hidden bg-black/40">
                    <img src={getAssetUrl(msg.ImageUrl)} alt="Attached media"
                      className="w-full max-h-72 object-cover rounded-[20px] cursor-zoom-in hover:scale-[1.02] active:scale-95 transition-all duration-200"
                      referrerPolicy="no-referrer"
                      onClick={(e) => { e.stopPropagation(); setLightboxImage(getAssetUrl(msg.ImageUrl)); }} />
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

  const renderDmSidebar = () => {
    const photos = (otherUser.ProfilePhotos?.length > 0
      ? otherUser.ProfilePhotos
      : [otherUser.Thumbnail || ""]
    ).filter(Boolean);

    return (
      <ProfileDetails
        user={otherUser}
        photos={photos}
        currentPhotoIndex={otherUserPhotoIndex}
        onPhotoIndexChange={setOtherUserPhotoIndex}
        onClose={() => { setShowInfo(false); setOtherUserPhotoIndex(0); }}
        trustScore={otherUser.TrustScore}
        actions={
          <div className="pt-6 border-t border-border-default space-y-4">
            <button onClick={() => { setReportReason(""); setReportDetails(""); setReportError(null); setReportSuccess(false); setReportTargetUser(otherUser); setShowReportModal(true); }}
              className="w-full py-4 text-xs font-black text-red-500 hover:text-red-400 transition-colors tracking-widest text-center cursor-pointer rounded-2xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 active:scale-95">🚩 REPORT PROFILE</button>
            {!isConfirmingDeleteDm ? (
              <button onClick={() => setIsConfirmingDeleteDm(true)}
                className="w-full py-4 text-xs font-black text-rose-500 hover:text-rose-400 transition-colors tracking-widest text-center cursor-pointer rounded-2xl bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 active:scale-95">🗑️ DELETE CONVERSATION</button>
            ) : (
              <div className="flex flex-col gap-3 p-4 rounded-2xl bg-red-500/5 border border-red-500/20">
                <p className="text-red-400 text-tiny text-center font-bold tracking-widest uppercase">Are you sure? This cannot be undone.</p>
                <div className="flex gap-3">
                  <button onClick={() => { removeChat(chat.ID); sendSocketMessage("DELETE_CHAT", { ChatID: chat.ID }); setIsConfirmingDeleteDm(false); navigate("/messages", { state: { activeTab: "direct" } }); }}
                    className="flex-1 py-3 rounded-2xl bg-red-500 text-text-primary text-tiny font-black uppercase tracking-[0.2em] active:scale-95 transition-all">YES, DELETE</button>
                  <button onClick={() => setIsConfirmingDeleteDm(false)}
                    className="flex-1 py-3 rounded-2xl bg-glass border border-border-default text-text-primary text-tiny font-black uppercase tracking-[0.2em] active:scale-95 transition-all">CANCEL</button>
                </div>
              </div>
            )}
          </div>
        }
      />
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-overlay shadow-2xl">
      {/* Header */}
      <header className="px-4 py-4 flex items-center justify-between border-b border-border-default bg-card z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/messages", { state: { activeTab: "direct" } })}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-glass text-text-muted active:scale-95 transition-all"><ChevronLeft size={20} /></button>
          <div onClick={() => setShowInfo(true)} className="flex items-center gap-3 cursor-pointer group">
            <img src={otherUser ? getAssetUrl(otherUser.Thumbnail || otherUser.ProfilePhotos?.[0] || "") : chat.ImageUrl ? getAssetUrl(chat.ImageUrl) : PLACEHOLDER_IMAGE}
              className="w-10 h-10 rounded-full object-cover border border-border-default group-hover:border-brand-accent transition-colors" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-text-primary truncate max-w-[150px] group-hover:text-brand-accent transition-colors">{otherUser?.RealName || chat.Title}</h3>
              <p className="text-nano font-black text-brand-accent uppercase tracking-widest">DIRECT</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowInfo(!showInfo)}
            className={cn("w-10 h-10 flex items-center justify-center rounded-xl transition-all", showInfo ? "bg-brand-accent text-overlay" : "bg-glass text-text-muted")}><Info size={20} /></button>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Chat Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-hide pb-10">
          <div className="py-4" />
          {renderMessageBubbles()}
        </div>

        {/* DM Info Sidebar */}
        <AnimatePresence>
          {showInfo && otherUser && (
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 250 }}
              className="absolute inset-0 bg-overlay z-20 border-l border-border-default flex flex-col overflow-y-auto scrollbar-hide"
            >
              {renderDmSidebar()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Profile Overlay */}
        <AnimatePresence>
          {!!selectedUser && (
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 250 }}
              className="absolute inset-0 bg-overlay z-[60] flex flex-col overflow-y-auto scrollbar-hide"
            >
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
                  </div>
                }
              />
            </motion.div>
          )}
        </AnimatePresence>

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
        onOpenSendMoney={() => setShowTipModal(true)}
        message={message}
        onMessageChange={setMessage}
        handleSend={handleSend}
      />

      {/* Camera Capture */}
      <CameraCapture
        open={showCameraCapture}
        onClose={() => setShowCameraCapture(false)}
        onCapture={handleCameraCapture}
      />

      {/* Tip Modal */}
      {otherUser && (
        <TipModal
          open={showTipModal}
          onClose={() => setShowTipModal(false)}
          receiverId={otherUser.ID}
          receiverName={otherUser.RealName}
          receiverThumbnail={otherUser.Thumbnail}
          onSuccess={(amount) => {
            sendSocketMessage("SEND_MESSAGE", {
              ChatID: chat.ID,
              Content: `💰 Sent $${amount} to ${otherUser.RealName}`,
            });
          }}
        />
      )}
    </div>
  );
}
