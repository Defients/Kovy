import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InfoCardProps {
  title: string;
  children: ReactNode;
  accent?: "cyan" | "amber" | "violet" | "green" | "pink" | "blue";
  className?: string;
}

const ACCENT_COLORS: Record<NonNullable<InfoCardProps["accent"]>, string> = {
  cyan: "border-kovy-cyan/60",
  amber: "border-amber-400/60",
  violet: "border-kovy-violet/60",
  green: "border-green-400/60",
  pink: "border-pink-400/60",
  blue: "border-kovy-accent/60",
};

const ACCENT_TEXT: Record<NonNullable<InfoCardProps["accent"]>, string> = {
  cyan: "text-kovy-cyan",
  amber: "text-amber-400",
  violet: "text-kovy-violet",
  green: "text-green-400",
  pink: "text-pink-400",
  blue: "text-kovy-accent-light",
};

export function InfoCard({ title, children, accent = "cyan", className }: InfoCardProps) {
  return (
    <div role="note" className={cn("kovy-info-card px-5 transition-transform duration-fast hover:-translate-y-0.5", ACCENT_COLORS[accent], className)}>
      <h3 className={cn("text-sm font-semibold mb-1.5", ACCENT_TEXT[accent])}>{title}</h3>
      <div className="text-xs text-kovy-text-muted leading-relaxed">
        {children}
      </div>
    </div>
  );
}
