import React, { createContext, useContext, useState, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  durationMs: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
  dismissToast: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", durationMs = 3000) => {
      const id = `toast_${++counterRef.current}`;
      setToasts((prev) => [...prev, { id, message, type, durationMs }]);

      if (durationMs > 0) {
        setTimeout(() => dismissToast(id), durationMs);
      }
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a <ToastProvider>");
  return ctx;
}

// ─── Styles per type ──────────────────────────────────────────────────

const typeStyles: Record<ToastType, string> = {
  success:
    "bg-emerald-600/90 border-emerald-400/40 shadow-emerald-500/20",
  error:
    "bg-red-600/90 border-red-400/40 shadow-red-500/20",
  info:
    "bg-elevated border-border-default shadow-black/30",
  warning:
    "bg-amber-600/90 border-amber-400/40 shadow-amber-500/20",
};

const iconMap: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "i",
  warning: "⚠",
};

// ─── Container Component ──────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            pointer-events-auto animate-in slide-in-from-right-2 fade-in
            rounded-xl px-4 py-3
            border backdrop-blur-xl shadow-lg
            flex items-start gap-3
            ${typeStyles[toast.type]}
          `}
          style={{
            animation: "toastIn 0.25s ease-out",
          }}
        >
          <span className="text-text-primary font-black text-xs mt-0.5 shrink-0 w-4 h-4 flex items-center justify-center rounded-full bg-glass-active">
            {iconMap[toast.type]}
          </span>
          <p className="text-xs font-medium text-text-bright leading-relaxed flex-1">
            {toast.message}
          </p>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-text-muted hover:text-text-primary transition-colors shrink-0"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}

      <style>{`
        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
