// ============================================================
// Command Registry — shared command definitions for both
// settings and overlay command palettes.
// ============================================================

export interface Command {
  id: string;
  label: string;
  category: string;
  keywords?: string;
  action: () => void;
}

export class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private recentIds: string[] = [];
  private readonly MAX_RECENT = 8;

  register(cmd: Command): void {
    this.commands.set(cmd.id, cmd);
  }

  unregister(id: string): void {
    this.commands.delete(id);
  }

  clear(): void {
    this.commands.clear();
    this.recentIds = [];
  }

  search(query: string): Command[] {
    const q = query.toLowerCase().trim();
    if (!q) {
      return this.getRecent();
    }
    const results: { cmd: Command; score: number }[] = [];
    for (const cmd of this.commands.values()) {
      const label = cmd.label.toLowerCase();
      const cat = cmd.category.toLowerCase();
      const kw = (cmd.keywords ?? "").toLowerCase();
      let score = 0;
      if (label.startsWith(q)) score += 100;
      else if (label.includes(q)) score += 50;
      if (cat.includes(q)) score += 20;
      if (kw.includes(q)) score += 30;
      const words = q.split(/\s+/);
      for (const w of words) {
        if (label.includes(w)) score += 10;
        if (kw.includes(w)) score += 5;
      }
      if (score > 0) results.push({ cmd, score });
    }
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aRecent = this.recentIds.includes(a.cmd.id) ? 1 : 0;
      const bRecent = this.recentIds.includes(b.cmd.id) ? 1 : 0;
      return bRecent - aRecent;
    });
    return results.map(r => r.cmd);
  }

  execute(id: string): void {
    const cmd = this.commands.get(id);
    if (cmd) {
      cmd.action();
      this.recentIds = this.recentIds.filter(r => r !== id);
      this.recentIds.unshift(id);
      if (this.recentIds.length > this.MAX_RECENT) {
        this.recentIds = this.recentIds.slice(0, this.MAX_RECENT);
      }
    }
  }

  getRecent(): Command[] {
    return this.recentIds
      .map(id => this.commands.get(id))
      .filter((c): c is Command => c !== undefined);
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }
}

export const commandRegistry = new CommandRegistry();
