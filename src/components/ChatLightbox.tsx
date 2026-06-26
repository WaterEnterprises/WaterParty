import { motion, AnimatePresence } from "motion/react";
import { X, Download } from "lucide-react";

interface ChatLightboxProps {
  lightboxImage: string | null;
  lightboxVideo: string | null;
  onCloseImage: () => void;
  onCloseVideo: () => void;
  onDownloadImage: (url: string) => void;
  onDownloadVideo: (url: string) => void;
}

export function ChatLightbox({
  lightboxImage, lightboxVideo,
  onCloseImage, onCloseVideo,
  onDownloadImage, onDownloadVideo,
}: ChatLightboxProps) {
  return (
    <>
      {/* Image Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCloseImage}
            className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between px-6 pointer-events-auto"
            >
              <button onClick={onCloseImage} className="w-10 h-10 rounded-full flex items-center justify-center bg-black/40 text-text-secondary hover:text-text-primary hover:bg-black/60 transition-all cursor-pointer border border-border-default active:scale-95"><X size={18} /></button>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">IMAGE VIEWER</span>
              <button onClick={() => onDownloadImage(lightboxImage)} className="w-10 h-10 rounded-full flex items-center justify-center bg-brand-accent/20 text-brand-accent hover:text-text-primary hover:bg-brand-accent transition-all cursor-pointer border border-brand-accent/25 active:scale-95" title="Save Shared Image"><Download size={18} /></button>
            </motion.div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-full max-h-[85vh] flex items-center justify-center"
            >
              <img src={lightboxImage} alt="Shared media detail" className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-border-default select-all" referrerPolicy="no-referrer" />
            </motion.div>
            <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 15, opacity: 0 }} className="absolute bottom-6 text-tiny font-black uppercase tracking-[0.25em] text-text-muted">Click backdrop to return</motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Video Lightbox */}
      <AnimatePresence>
        {lightboxVideo && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCloseVideo}
            className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between px-6 pointer-events-auto"
            >
              <button onClick={onCloseVideo} className="w-10 h-10 rounded-full flex items-center justify-center bg-black/40 text-text-secondary hover:text-text-primary hover:bg-black/60 transition-all cursor-pointer border border-border-default active:scale-95"><X size={18} /></button>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">VIDEO PLAYER</span>
              <button onClick={() => onDownloadVideo(lightboxVideo)} className="w-10 h-10 rounded-full flex items-center justify-center bg-brand-accent/20 text-brand-accent hover:text-text-primary hover:bg-brand-accent transition-all cursor-pointer border border-brand-accent/25 active:scale-95" title="Save Shared Video"><Download size={18} /></button>
            </motion.div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-full max-h-[85vh] flex items-center justify-center"
            >
              <video src={lightboxVideo} controls autoPlay playsInline className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-border-default" />
            </motion.div>
            <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 15, opacity: 0 }} className="absolute bottom-6 text-tiny font-black uppercase tracking-[0.25em] text-text-muted">Click backdrop to return</motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
