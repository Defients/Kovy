// ============================================================
// Recall Engine — Memory-Palace recall thoughts (v9.0)
//
// Periodically surfaces significant past memories as "recall thoughts"
// — short reflective text bubbles that give Kovy a sense of remembering.
//
// Recall is triggered on a tick (throttled by the caller) and:
// - Queries the Memory DB for recent memories above a significance threshold
// - Filters by max age (don't recall ancient memories)
// - Randomly selects a memory based on `chance`
// - Formats it as a thought string (e.g., "I remember when...")
// - Returns a RecallThought for the caller to spawn in the ThoughtEngine
// ============================================================

import type { RecallConfig, MemoryRecord, MemoryType, SurfaceMood, Vec2 } from "@/store/types";
import { getRecentMemories, isMemoryDbAvailable } from "@/lib/memoryDb";

export interface RecallThought {
  text: string;
  position: Vec2;
  memoryId: number;
  memoryType: MemoryType;
  ageDays: number;
}

const RECALL_TEMPLATES: Record<MemoryType, string[]> = {
  app_session: [
    "I remember spending time in {app}...",
    "That {app} session was nice...",
    "We were in {app} together, weren't we?",
  ],
  interaction: [
    "I remember when you poked me...",
    "That was a nice moment...",
    "I felt close to you then...",
  ],
  mood_episode: [
    "I was feeling {mood} that day...",
    "That {mood} moment stuck with me...",
    "I remember being {mood}...",
  ],
  quiet_period: [
    "It was so peaceful and quiet...",
    "I remember the calm...",
    "Those quiet moments were nice...",
  ],
  high_activity: [
    "So much was happening that day...",
    "What a busy time that was...",
    "Everything was moving so fast...",
  ],
  habitat_use: [
    "I liked resting there...",
    "That spot was cozy...",
    "I remember finding a nice place...",
  ],
  schedule_pattern: [
    "I notice we do this often...",
    "This feels familiar...",
    "We have a rhythm, don't we?",
  ],
  preference: [
    "I think I like this...",
    "This feels right to me...",
    "I've grown to enjoy this...",
  ],
  aversion: [
    "I don't think I like that...",
    "Something about that bothers me...",
    "I'd rather avoid that...",
  ],
  family_event: [
    "I remember the family...",
    "That time with everyone...",
    "We were all together...",
  ],
};

const MOOD_LABELS: Partial<Record<SurfaceMood, string>> = {
  calm: "calm",
  excited: "excited",
  sleepy: "sleepy",
  playful: "playful",
  focused: "focused",
  curious: "curious",
  content: "content",
  overwhelmed: "overwhelmed",
  shy: "shy",
  anxious: "anxious",
  nostalgic: "nostalgic",
  determined: "determined",
};

const RECALL_TICK_INTERVAL = 30; // seconds between recall checks

function formatTemplate(template: string, memory: MemoryRecord): string {
  const app = memory.appProcess ?? "that app";
  const mood = memory.tags ? memory.tags.split(",")[0] : "calm";
  return template
    .replace("{app}", app)
    .replace("{mood}", mood);
}

export class RecallEngine {
  private config: RecallConfig | null = null;
  private tickAccum = 0;
  private lastRecalledId: number | null = null;
  private pendingThought: RecallThought | null = null;
  private dbAvailable = false;

  updateConfig(config: RecallConfig): void {
    this.config = config;
  }

  isEnabled(): boolean {
    return this.config?.enabled ?? false;
  }

  /// Returns a pending recall thought if one was spawned.
  /// The caller is responsible for spawning it in the ThoughtEngine.
  consumeThought(): RecallThought | null {
    const t = this.pendingThought;
    this.pendingThought = null;
    return t;
  }

  /// Main update — called every frame.
  /// Returns true if a recall check was performed this tick.
  async update(
    dt: number,
    entityId: string,
    kovyPos: Vec2,
    surfaceMood: SurfaceMood,
  ): Promise<boolean> {
    if (!this.config?.enabled) {
      this.pendingThought = null;
      return false;
    }

    this.tickAccum += dt;
    if (this.tickAccum < RECALL_TICK_INTERVAL) return false;
    this.tickAccum = 0;

    // Check DB availability (cached)
    if (!this.dbAvailable) {
      this.dbAvailable = await isMemoryDbAvailable();
      if (!this.dbAvailable) return false;
    }

    // Random chance check
    if (Math.random() > this.config.chance) return false;

    // Query memories
    const memories = await getRecentMemories(entityId, 100);
    if (memories.length === 0) return false;

    // Filter by significance and age
    const now = Date.now();
    const maxAgeMs = this.config.maxAgeDays * 24 * 60 * 60 * 1000;
    const candidates = memories.filter((m) => {
      if (m.significance < this.config!.minSignificance) return false;
      const ageMs = now - m.timestamp;
      if (ageMs > maxAgeMs) return false;
      if (m.id === this.lastRecalledId) return false;
      return true;
    });

    if (candidates.length === 0) return false;

    // Pick a random candidate, weighted by significance
    const totalWeight = candidates.reduce((sum, m) => sum + m.significance, 0);
    let r = Math.random() * totalWeight;
    let chosen = candidates[0];
    for (const m of candidates) {
      r -= m.significance;
      if (r <= 0) {
        chosen = m;
        break;
      }
    }

    // Format the recall thought
    const templates = RECALL_TEMPLATES[chosen.type] ?? RECALL_TEMPLATES.interaction;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const text = formatTemplate(template, chosen);

    const ageDays = Math.floor((now - chosen.timestamp) / (24 * 60 * 60 * 1000));

    this.pendingThought = {
      text,
      position: { x: kovyPos.x, y: kovyPos.y - 40 },
      memoryId: chosen.id,
      memoryType: chosen.type,
      ageDays,
    };
    this.lastRecalledId = chosen.id;

    return true;
  }

  destroy(): void {
    this.config = null;
    this.tickAccum = 0;
    this.lastRecalledId = null;
    this.pendingThought = null;
    this.dbAvailable = false;
  }
}
