import React, { useId } from "react";
import { cn } from "@/lib/utils";

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingRow({ label, description, children, className }: SettingRowProps) {
  const descId = useId();
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3 px-1", className)}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-kovy-text">{label}</div>
        {description && (
          <div id={descId} className="text-xs text-kovy-text-dim mt-0.5 leading-relaxed">{description}</div>
        )}
      </div>
      <div className="flex-shrink-0">
        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<{ "aria-describedby"?: string }>, {
              "aria-describedby": description ? descId : undefined,
            })
          : children}
      </div>
    </div>
  );
}

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
  onReset?: () => void;
}

export function SettingSection({ title, children, onReset }: SettingSectionProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-kovy-text-muted">
          {title}
        </h3>
        {onReset && (
          <button
            onClick={onReset}
            className="text-xs text-kovy-text-dim hover:text-kovy-accent transition-colors kovy-focus-ring"
          >
            Reset
          </button>
        )}
      </div>
      <div className="kovy-glass p-4 space-y-1 divide-y divide-kovy-border/30 transition-colors hover:border-kovy-border/30">
        {children}
      </div>
    </div>
  );
}
