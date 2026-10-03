import { useState, useCallback, useRef, createContext, useContext } from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show: (msg: string) => console.warn("[toast]", msg),
      success: (msg: string) => console.warn("[toast]", msg),
      error: (msg: string) => console.warn("[toast]", msg),
      info: (msg: string) => console.warn("[toast]", msg),
      warning: (msg: string) => console.warn("[toast]", msg),
    };
  }
  return ctx;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-green-400/40 bg-green-900/30 text-green-300",
  error: "border-red-400/40 bg-red-900/30 text-red-300",
  info: "border-kovy-accent/40 bg-kovy-accent/10 text-kovy-accent-light",
  warning: "border-yellow-400/40 bg-yellow-900/30 text-yellow-300",
};

const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idCounter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info", duration = 4000) => {
      const id = ++idCounter.current;
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const ctx: ToastContextValue = {
    show,
    success: (msg, d) => show(msg, "success", d),
    error: (msg, d) => show(msg, "error", d),
    info: (msg, d) => show(msg, "info", d),
    warning: (msg, d) => show(msg, "warning", d),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-toast flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-lg border backdrop-blur-md shadow-elevated animate-toast-in max-w-sm",
              VARIANT_STYLES[toast.variant],
            )}
          >
            <span className="text-sm font-semibold flex-shrink-0 mt-0.5">
              {VARIANT_ICONS[toast.variant]}
            </span>
            <span className="text-sm leading-relaxed flex-1">{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-xs opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
