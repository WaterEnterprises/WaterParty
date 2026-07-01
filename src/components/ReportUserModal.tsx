import { useRef, useEffect } from "react";
import { gsap } from "../lib/gsap";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

interface ReportUserModalProps {
  show: boolean;
  onClose: () => void;
  targetUser: any | null;
  reason: string;
  onReasonChange: (reason: string) => void;
  details: string;
  onDetailsChange: (details: string) => void;
  error: string | null;
  onClearError: () => void;
  success: boolean;
  inFlight: boolean;
  onSubmit: () => void;
}

export function ReportUserModal({
  show, onClose, targetUser,
  reason, onReasonChange,
  details, onDetailsChange,
  error, onClearError,
  success, inFlight, onSubmit,
}: ReportUserModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && targetUser && backdropRef.current && cardRef.current) {
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      gsap.fromTo(cardRef.current, { scale: 0.95, y: 20, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.4, ease: "back.out(1.7)" });
    }
  }, [show, targetUser]);

  return (
    <>
      {show && targetUser && (
        <div
          ref={backdropRef}
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 cursor-default"
          onClick={() => { if (!inFlight && !success) onClose(); }}
        >
          <div
            ref={cardRef}
            className="w-full max-w-md bg-overlay border border-border-default rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {success ? (
              <div className="flex flex-col items-center text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 scale-110 mb-2">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <span className="text-xs font-black uppercase tracking-[0.25em] text-brand-accent">REPORT TRANSMITTED</span>
                <h3 className="text-xl font-bold text-text-primary tracking-wide uppercase">Safety Priority Queued</h3>
                <p className="text-xs text-text-muted leading-relaxed max-w-[280px]">Your report regarding <strong>{targetUser.RealName}</strong> has been secured and sent to the moderation team.</p>
              </div>
            ) : (
              <div className="flex flex-col space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-red-500">REPORT A USER</span>
                  <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors" disabled={inFlight}><X size={18} /></button>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary tracking-wide uppercase mb-1">Report {targetUser.RealName}</h3>
                  <p className="text-tiny text-text-muted leading-relaxed font-medium uppercase tracking-tight">Confidential reporting secures safety. Please select a reason below.</p>
                </div>
                {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold">{error}</div>}
                <div className="space-y-2">
                  {["Harassment or bullying", "Inappropriate profile photo or bio", "Spam, scam, or fake profile", "Hate speech or offensive conduct", "Other issues"].map((reasonItem) => {
                    const isSelected = reason === reasonItem;
                    return (
                      <button key={reasonItem} type="button" onClick={() => { onReasonChange(reasonItem); onClearError(); }}
                        className={cn("w-full px-4 py-3 rounded-2xl text-left text-xs font-bold uppercase tracking-wider transition-all duration-200 border cursor-pointer",
                          isSelected ? "bg-red-500/25 border-red-500 text-text-primary shadow-lg shadow-red-500/10" : "bg-glass border-border-default text-text-secondary hover:text-text-primary hover:bg-glass-hover"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span>{reasonItem}</span>
                          {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#EF4444]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-col space-y-1.5">
                  <label className="text-tiny font-bold text-text-muted uppercase tracking-widest">Details (Optional)</label>
                  <textarea value={details} onChange={(e) => onDetailsChange(e.target.value)} placeholder="PROVIDE ADDITIONAL REASONS OR CONTEXT REGARDING YOUR COMPLAINT..." rows={3}
                    className="w-full bg-glass border border-border-default rounded-2xl p-3 text-xs text-text-primary placeholder:text-text-faint outline-none focus:border-red-500/50 transition-colors uppercase font-bold tracking-tight" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={onClose} className="flex-1 py-3.5 rounded-2xl border border-border-default text-text-secondary hover:text-text-primary text-tiny font-black uppercase tracking-widest active:scale-95 transition-all text-center cursor-pointer" disabled={inFlight}>Cancel</button>
                  <button type="button" onClick={onSubmit} disabled={inFlight || !reason}
                    className={cn("flex-1 py-3.5 rounded-2xl text-tiny font-black uppercase tracking-widest active:scale-95 transition-all text-center cursor-pointer",
                      inFlight || !reason ? "bg-glass text-text-faint cursor-not-allowed" : "bg-gradient-to-r from-red-600 to-amber-600 text-text-primary shadow-lg shadow-red-600/20 hover:from-red-500 hover:to-amber-500"
                    )}
                  >{inFlight ? "Transmitting..." : "Submit Report"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
