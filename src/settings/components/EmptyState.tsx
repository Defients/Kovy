import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-8 px-4 text-center", className)}>
      {icon && <div className="text-3xl mb-3 opacity-40">{icon}</div>}
      <div className="text-sm font-medium text-kovy-text-dim">{title}</div>
      {description && (
        <div className="text-xs text-kovy-text-dim/60 mt-1 max-w-xs leading-relaxed">{description}</div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 kovy-btn-outline text-xs"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
