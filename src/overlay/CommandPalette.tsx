import { useState, useEffect, useRef, useCallback } from "react";
import { Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { commandRegistry, type Command } from "@/lib/commandRegistry";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<Command[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setResults(commandRegistry.search(""));
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setResults(commandRegistry.search(query));
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = results[selectedIndex];
        if (cmd) {
          commandRegistry.execute(cmd.id);
          onClose();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, results, selectedIndex, onClose]);

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement;
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleSelect = useCallback((cmd: Command) => {
    commandRegistry.execute(cmd.id);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const categories = new Map<string, Command[]>();
  for (const cmd of results) {
    const list = categories.get(cmd.category) ?? [];
    list.push(cmd);
    categories.set(cmd.category, list);
  }

  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/30 backdrop-blur-sm"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-[560px] max-h-[60vh] kovy-glass rounded-xl shadow-2xl overflow-hidden flex flex-col animate-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-kovy-border/30">
          <Search size={18} className="text-kovy-accent opacity-60" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands..."
            aria-label="Search commands"
            aria-controls="command-list"
            aria-expanded={open}
            role="combobox"
            aria-activedescendant={results[selectedIndex] ? `cmd-${results[selectedIndex].id}` : undefined}
            className="flex-1 bg-transparent text-kovy-text placeholder:text-kovy-text/40 outline-none text-sm"
          />
          <kbd className="text-xs text-kovy-text/40 px-1.5 py-0.5 rounded bg-kovy-border/20">ESC</kbd>
        </div>
        <div ref={listRef} id="command-list" role="listbox" aria-label="Available commands" className="flex-1 overflow-y-auto py-1">
          {results.length === 0 && (
            <div className="kovy-empty-state" role="status">
              No commands found
            </div>
          )}
          {Array.from(categories.entries()).map(([category, cmds]) => (
            <div key={category} className="first:border-t-0 border-t border-kovy-border/15">
              <div className="px-3 py-1.5 text-xs text-kovy-text/40 font-medium uppercase tracking-wider">
                {category}
              </div>
              {cmds.map((cmd) => {
                const idx = flatIndex++;
                return (
                  <button
                    key={cmd.id}
                    id={`cmd-${cmd.id}`}
                    role="option"
                    aria-selected={idx === selectedIndex}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors kovy-focus-ring",
                      idx === selectedIndex
                        ? "bg-kovy-accent/20 text-kovy-accent"
                        : "text-kovy-text hover:bg-kovy-border/20"
                    )}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => handleSelect(cmd)}
                  >
                    <span className="flex-1">{cmd.label}</span>
                    <ChevronRight size={14} className="opacity-30" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-kovy-border/30 text-xs text-kovy-text/40 flex items-center gap-4">
          <span><kbd className="px-1 bg-kovy-border/20 rounded">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1 bg-kovy-border/20 rounded">↵</kbd> Execute</span>
          <span><kbd className="px-1 bg-kovy-border/20 rounded">ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
