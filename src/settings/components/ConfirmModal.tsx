import React, { useEffect, useRef, useId } from "react";
import { cn } from "@/lib/utils";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocused.current = document.activeElement as HTMLElement;
      setTimeout(() => confirmRef.current?.focus(), 50);
    } else if (previouslyFocused.current) {
      previouslyFocused.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onCancel(); return; }
      if (e.key === "Enter") { e.preventDefault(); onConfirm(); return; }
      if (e.key === "Tab") {
        const focusables = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLButtonElement[];
        if (focusables.length === 0) return;
        const idx = focusables.indexOf(document.activeElement as HTMLButtonElement);
        e.preventDefault();
        const nextIdx = e.shiftKey ? (idx - 1 + focusables.length) % focusables.length : (idx + 1) % focusables.length;
        focusables[nextIdx].focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200"
      onMouseDown={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="kovy-glass max-w-sm w-full mx-4 shadow-elevated border border-kovy-border/50 rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <h3 id={titleId} className="text-base font-semibold text-kovy-text mb-2">{title}</h3>
          <p id={descId} className="text-sm text-kovy-text-muted leading-relaxed">{message}</p>
        </div>
        <div className="px-5 py-4 border-t border-kovy-border/30 bg-kovy-surface/50 flex items-center justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="kovy-btn-ghost text-xs kovy-focus-ring"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={cn(
              "kovy-btn text-xs font-medium text-white shadow-sm kovy-focus-ring",
              isDestructive ? "bg-red-600 hover:bg-red-500" : "bg-kovy-accent hover:bg-kovy-accent-light shadow-glow"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
