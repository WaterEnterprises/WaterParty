import { useRef, useEffect } from "react";
import { gsap } from "../lib/gsap";
import { X, Download } from "lucide-react";

interface ChatLightboxProps {
  lightboxImage: string | null;
  lightboxVideo: string | null;
  onCloseImage: () => void;
  onCloseVideo: () => void;
  onDownloadImage: (url: string) => void;
  onDownloadVideo: (url: string) => void;
}

function Lightbox({ visible, type, url, onClose, onDownload, headerText }: {
  visible: boolean;
  type: "image" | "video";
  url: string | null;
  onClose: () => void;
  onDownload: (url: string) => void;
  headerText: string;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !url) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      tl.fromTo(headerRef.current, { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.2 }, "-=0.1");
      tl.fromTo(contentRef.current, { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(1.7)" }, "-=0.15");
      tl.fromTo(footerRef.current, { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.2 }, "-=0.1");
    });
    return () => ctx.revert();
  }, [visible, url]);

  if (!visible || !url) return null;

  return (
    <div ref={backdropRef} onClick={onClose} className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 cursor-zoom-out">
      <div ref={headerRef} onClick={(e) => e.stopPropagation()} className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between px-6 pointer-events-auto">
        <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center bg-black/40 text-text-secondary hover:text-text-primary hover:bg-black/60 transition-all cursor-pointer border border-border-default active:scale-95"><X size={18} /></button>
        <span className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">{headerText}</span>
        <button onClick={() => url && onDownload(url)} className="w-10 h-10 rounded-full flex items-center justify-center bg-brand-accent/20 text-brand-accent hover:text-text-primary hover:bg-brand-accent transition-all cursor-pointer border border-brand-accent/25 active:scale-95" title="Save Shared Media"><Download size={18} /></button>
      </div>
      <div ref={contentRef} onClick={(e) => e.stopPropagation()} className="relative max-w-full max-h-[85vh] flex items-center justify-center">
        {type === "image" ? (
          <img src={url} alt="Shared media detail" className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-border-default select-all" referrerPolicy="no-referrer" />
        ) : (
          <video src={url} controls autoPlay playsInline className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-border-default" />
        )}
      </div>
      <div ref={footerRef} className="absolute bottom-6 text-tiny font-black uppercase tracking-[0.25em] text-text-muted">Click backdrop to return</div>
    </div>
  );
}

export function ChatLightbox({
  lightboxImage, lightboxVideo,
  onCloseImage, onCloseVideo,
  onDownloadImage, onDownloadVideo,
}: ChatLightboxProps) {
  return (
    <>
      <Lightbox visible={!!lightboxImage} type="image" url={lightboxImage} onClose={onCloseImage} onDownload={onDownloadImage} headerText="IMAGE VIEWER" />
      <Lightbox visible={!!lightboxVideo} type="video" url={lightboxVideo} onClose={onCloseVideo} onDownload={onDownloadVideo} headerText="VIDEO PLAYER" />
    </>
  );
}
