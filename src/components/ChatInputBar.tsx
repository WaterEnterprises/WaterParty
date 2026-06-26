import { RefObject, ChangeEvent } from "react";
import { Send, X, Image as ImageIcon, Camera, Wallet } from "lucide-react";
import { cn } from "../lib/utils";

interface ChatInputBarProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleLocalImageUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  uploadError: string | null;
  onClearUploadError: () => void;
  selectedImage: string | null;
  selectedVideo: string | null;
  onClearSelectedMedia: () => void;
  uploadingImage: boolean;
  sending?: boolean;
  showCameraCapture: boolean;
  onOpenCamera: () => void;
  onOpenGallery: () => void;
  onOpenSendMoney?: () => void;
  message: string;
  onMessageChange: (msg: string) => void;
  handleSend: (e?: any) => void;
}

export function ChatInputBar({
  fileInputRef, handleLocalImageUpload,
  uploadError, onClearUploadError,
  selectedImage, selectedVideo,
  onClearSelectedMedia,
  uploadingImage, sending,
  showCameraCapture, onOpenCamera, onOpenGallery,
  onOpenSendMoney,
  message, onMessageChange, handleSend,
}: ChatInputBarProps) {
  return (
    <div className="p-4 pt-2 shrink-0 bg-card border-t border-border-default flex flex-col gap-2">
      <input type="file" ref={fileInputRef} accept="image/*,video/mp4,video/webm,video/quicktime,video/mov" className="hidden" onChange={handleLocalImageUpload} />
      {uploadError && (
        <div className="relative self-start ml-2 mb-1 px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-2 text-xs font-semibold">
          <span>{uploadError}</span>
          <button type="button" onClick={onClearUploadError} className="text-red-400 hover:text-text-primary transition-colors ml-2"><X size={12} /></button>
        </div>
      )}
      {selectedImage && (
        <div className="relative self-start ml-2 mb-1 p-1 bg-glass border border-border-default rounded-2xl flex items-center gap-2 max-w-full">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-black/40 border border-border-default shrink-0">
            <img src={selectedImage} alt="Selected preview" className="w-full h-full object-cover" />
            {uploadingImage && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-tiny font-bold text-text-primary uppercase tracking-wider">Sync...</div>}
          </div>
          <div className="flex flex-col min-w-0 pr-6">
            <span className="text-tiny font-black text-brand-accent uppercase tracking-widest leading-none">ATTACHED</span>
            <span className="text-nano text-text-muted truncate max-w-[120px] mt-1">Image ready to transmit</span>
          </div>
          <button type="button" onClick={onClearSelectedMedia}
            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500/90 text-text-primary flex items-center justify-center border border-black/50 hover:bg-red-600 transition-colors cursor-pointer"><X size={12} /></button>
        </div>
      )}
      {selectedVideo && (
        <div className="relative self-start ml-2 mb-1 p-1 bg-glass border border-border-default rounded-2xl flex items-center gap-2 max-w-full">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-black/40 border border-border-default shrink-0">
            <video src={selectedVideo} className="w-full h-full object-cover" />
            {uploadingImage && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-tiny font-bold text-text-primary uppercase tracking-wider">Sync...</div>}
          </div>
          <div className="flex flex-col min-w-0 pr-6">
            <span className="text-tiny font-black text-brand-accent uppercase tracking-widest leading-none">ATTACHED VIDEO</span>
            <span className="text-nano text-text-muted truncate max-w-[120px] mt-1">Video ready to transmit (Max 20MB)</span>
          </div>
          <button type="button" onClick={onClearSelectedMedia}
            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500/90 text-text-primary flex items-center justify-center border border-black/50 hover:bg-red-600 transition-colors cursor-pointer"><X size={12} /></button>
        </div>
      )}
      <form onSubmit={handleSend} className="flex items-center gap-0.5 bg-glass rounded-full p-0.5 border border-border-default overflow-hidden">
        <button type="button" onClick={onOpenCamera}
          className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer",
            showCameraCapture ? "bg-brand-accent/25 text-brand-accent" : "bg-glass text-text-muted hover:text-text-primary"
          )}><Camera size={14} /></button>
        <button type="button" onClick={onOpenGallery}
          className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer",
            (selectedImage || selectedVideo) ? "bg-brand-accent/25 text-brand-accent" : "bg-glass text-text-muted hover:text-text-primary"
          )}><ImageIcon size={14} /></button>
        {onOpenSendMoney && (
          <button type="button" onClick={onOpenSendMoney}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-glass text-emerald-400 hover:text-emerald-300 transition-all shrink-0 cursor-pointer"
          ><Wallet size={14} /></button>
        )}
        <input type="text" placeholder={selectedImage ? "ADD CAPTION (OPTIONAL)..." : selectedVideo ? "ADD CAPTION (OPTIONAL)..." : "TYPE YOUR FREQUENCY..."}
          value={message} onChange={(e) => onMessageChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent px-1.5 py-2 outline-none text-xs text-text-primary placeholder:text-text-faint font-bold uppercase tracking-tight" />
        <button type="submit" disabled={sending}
          className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0",
            (sending || message.trim() || selectedImage || selectedVideo) ? "bg-gradient-to-r from-brand-primary to-brand-secondary text-text-primary shadow-lg shadow-brand-primary/20" : "bg-glass text-text-faint"
          )}>
          {sending ? (
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <Send size={14} />
          )}
        </button>
      </form>
    </div>
  );
}
