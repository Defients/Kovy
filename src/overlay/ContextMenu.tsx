import { useState, useEffect, useRef, useCallback } from "react";
import { Heart, Utensils, Moon, Gamepad2, Settings, EyeOff, Smile, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BehaviorState, SurfaceMood } from "@/store/types";

export interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  submenu?: ContextMenuAction[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  onAction: (action: string) => void;
  onClose: () => void;
  visible: boolean;
}

const MOOD_OPTIONS: { label: string; value: SurfaceMood }[] = [
  { label: "Calm", value: "calm" },
  { label: "Excited", value: "excited" },
  { label: "Sleepy", value: "sleepy" },
  { label: "Playful", value: "playful" },
  { label: "Focused", value: "focused" },
  { label: "Curious", value: "curious" },
];

const BEHAVIOR_OPTIONS: { label: string; value: BehaviorState; icon: React.ReactNode }[] = [
  { label: "Nap", value: "nap", icon: <Moon size={14} /> },
  { label: "Play", value: "dance", icon: <Gamepad2 size={14} /> },
];

export function ContextMenu({ x, y, onAction, onClose, visible }: ContextMenuProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [submenuPos, setSubmenuPos] = useState<{ x: number; y: number } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuSize, setMenuSize] = useState({ w: 180, h: 0 });

  const actions: ContextMenuAction[] = [
    { id: "pet", label: "Pet", icon: <Heart size={14} />, onClick: () => handleAction("pet") },
    { id: "feed", label: "Feed", icon: <Utensils size={14} />, onClick: () => handleAction("feed") },
    ...BEHAVIOR_OPTIONS.map(b => ({
      id: `behavior:${b.value}`,
      label: b.label,
      icon: b.icon,
      onClick: () => handleAction(`behavior:${b.value}`),
    })),
    {
      id: "mood",
      label: "Set Mood",
      icon: <Smile size={14} />,
      onClick: () => {},
      submenu: MOOD_OPTIONS.map(m => ({
        id: `mood:${m.value}`,
        label: m.label,
        icon: <Smile size={12} />,
        onClick: () => handleAction(`mood:${m.value}`),
      })),
    },
    { id: "settings", label: "Settings", icon: <Settings size={14} />, onClick: () => handleAction("settings") },
    { id: "hide", label: "Hide Kovy", icon: <EyeOff size={14} />, onClick: () => handleAction("hide") },
  ];

  useEffect(() => {
    if (visible && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      setMenuSize({ w: rect.width, h: rect.height });
      setFocusedIndex(0);
    } else {
      setFocusedIndex(-1);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex(i => Math.min(i + 1, actions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && focusedIndex >= 0) {
        e.preventDefault();
        const action = actions[focusedIndex];
        if (action && !action.submenu) action.onClick();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [visible, onClose, focusedIndex, actions]);

  const handleAction = useCallback((action: string) => {
    onAction(action);
    onClose();
  }, [onAction, onClose]);

  if (!visible) return null;

  const adjustedX = Math.min(x, window.innerWidth - menuSize.w - 10);
  const adjustedY = Math.min(y, window.innerHeight - (menuSize.h || 300) - 10);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Kovy context menu"
      className="fixed z-50 kovy-glass rounded-lg shadow-xl py-1.5 min-w-[180px] select-none"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {actions.map((action, i) => (
        <div
          key={action.id}
          className="relative"
          onMouseEnter={() => {
            setHoveredItem(action.id);
            setFocusedIndex(i);
            if (action.submenu) {
              setSubmenuPos({ x: adjustedX + menuSize.w, y: adjustedY });
            }
          }}
          onMouseLeave={() => {
            setHoveredItem(null);
            if (action.submenu) setSubmenuPos(null);
          }}
        >
          <button
            role="menuitem"
            tabIndex={focusedIndex === i ? 0 : -1}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors kovy-focus-ring",
              (hoveredItem === action.id || focusedIndex === i) ? "bg-kovy-accent/20 text-kovy-accent" : "text-kovy-text hover:bg-kovy-border/30"
            )}
            onClick={() => {
              if (action.submenu) return;
              action.onClick();
            }}
          >
            <span className="opacity-70">{action.icon}</span>
            <span>{action.label}</span>
            {action.submenu && <span className="ml-auto text-xs opacity-50">▶</span>}
          </button>
          {action.submenu && hoveredItem === action.id && (
            <div
              role="menu"
              aria-label={`${action.label} submenu`}
              className="fixed z-50 kovy-glass rounded-lg shadow-xl py-1.5 min-w-[140px] select-none"
              style={{ left: submenuPos?.x ?? 0, top: submenuPos?.y ?? 0 }}
            >
              {action.submenu.map((sub) => (
                <button
                  key={sub.id}
                  role="menuitem"
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-kovy-text hover:bg-kovy-accent/20 hover:text-kovy-accent transition-colors kovy-focus-ring"
                  onClick={sub.onClick}
                >
                  <span className="opacity-70">{sub.icon}</span>
                  <span>{sub.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
