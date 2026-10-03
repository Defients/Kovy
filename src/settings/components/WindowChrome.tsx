import { useCallback } from "react";

interface WindowChromeProps {
  title: string;
  onClose?: () => void;
  onMinimize?: () => void;
}

export function WindowChrome({ title, onClose, onMinimize }: WindowChromeProps) {
  const handleClose = useCallback(async () => {
    if (onClose) {
      onClose();
      return;
    }
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().hide();
    } catch {
      window.close();
    }
  }, [onClose]);

  const handleMinimize = useCallback(async () => {
    if (onMinimize) {
      onMinimize();
      return;
    }
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch (err) {
      console.error("Failed to minimize window:", err);
    }
  }, [onMinimize]);

  return (
    <div
      data-tauri-drag-region
      role="banner"
      className="flex items-center justify-between h-8 bg-kovy-surface/60 border-b border-kovy-border/30 select-none flex-shrink-0"
    >
      <span
        data-tauri-drag-region
        className="text-[11px] text-kovy-text-dim font-medium pl-3 pointer-events-none"
      >
        {title}
      </span>
      <div className="flex items-center h-full">
        <button
          onClick={handleMinimize}
          className="h-full px-3 text-kovy-text-dim hover:bg-kovy-surface-light hover:text-kovy-text transition-colors duration-fast text-sm kovy-focus-ring"
          title="Minimize"
          aria-label="Minimize window"
        >
          ─
        </button>
        <button
          onClick={handleClose}
          className="h-full px-3 text-kovy-text-dim hover:bg-red-600 hover:text-white transition-colors duration-fast text-sm kovy-focus-ring"
          title="Close"
          aria-label="Close window"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
