import { cn } from "@/lib/utils";

type BadgeVariant = "new" | "active" | "warning" | "disabled";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  new: "kovy-badge-new",
  active: "kovy-badge-active",
  warning: "kovy-badge-warning",
  disabled: "kovy-badge bg-kovy-surface-light text-kovy-text-dim",
};

export function Badge({ variant = "new", children, className }: BadgeProps) {
  return (
    <span className={cn(VARIANT_CLASSES[variant], className)}>
      {children}
    </span>
  );
}
