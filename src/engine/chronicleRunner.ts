// ============================================================
// Kovy Chronicle Runner — daily snapshot scheduler (v8.3)
//
// Polls on a light interval (default 60s) and, once per local day,
// when the current hour has reached `chronicleHour` AND no snapshot
// exists yet for today, builds and persists a ChronicleSnapshot.
//
// Design:
//   - Idempotent per day: the dateStr key guarantees at most one
//     snapshot per day, even across restarts or sleep/wake cycles.
//   - The runner never blocks the render loop: snapshot building is
//     pure and storage I/O is synchronous-but-tiny (~150 bytes).
//   - Fully cancellable via destroy().
//   - The pure decision function `shouldPersistToday` is exported for
//     unit testing without timers or storage.
//
// The runner pulls live engine state through injected getters so it
// has no direct dependency on the engine container or stores.
// ============================================================

import {
  buildChronicleSnapshot,
  localDateStr,
  type ChronicleSnapshot,
  type ChronicleSnapshotInputs,
} from "./chronicleEngine";
import { loadSnapshots, persistSnapshot } from "./chronicleStorage";

export interface ChronicleRunnerOptions {
  /** Polling interval in milliseconds (default 60000). */
  intervalMs?: number;
  /** Returns the current chronicle config fields. */
  getEnabled: () => boolean;
  getSnapshotHour: () => number;
  getRetentionDays: () => number;
  /** Builds the snapshot inputs from live engine state. */
  buildInputs: () => ChronicleSnapshotInputs;
  /** Optional override for the clock (testing). */
  now?: () => Date;
  /** Optional override for the storage layer (testing). */
  loader?: () => ChronicleSnapshot[];
  persister?: (snapshot: ChronicleSnapshot, retentionDays: number) => ChronicleSnapshot[];
}

/**
 * Pure decision: should we persist a snapshot for today right now?
 * Returns true only when the feature is enabled, the current local
 * hour has reached the configured snapshot hour, and no snapshot
 * already exists for today's date string.
 */
export function shouldPersistToday(
  enabled: boolean,
  snapshotHour: number,
  now: Date,
  existing: ChronicleSnapshot[],
): boolean {
  if (!enabled) return false;
  if (now.getHours() < snapshotHour) return false;
  const todayStr = localDateStr(now);
  return !existing.some(s => s.dateStr === todayStr);
}

export class ChronicleRunner {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly opts: Required<Omit<ChronicleRunnerOptions, "loader" | "persister" | "now">> & Pick<ChronicleRunnerOptions, "loader" | "persister" | "now">;
  private destroyed = false;
  /** Count of snapshots persisted by this runner instance (diagnostics). */
  private persistedCount = 0;

  constructor(opts: ChronicleRunnerOptions) {
    this.opts = {
      intervalMs: opts.intervalMs ?? 60000,
      getEnabled: opts.getEnabled,
      getSnapshotHour: opts.getSnapshotHour,
      getRetentionDays: opts.getRetentionDays,
      buildInputs: opts.buildInputs,
      loader: opts.loader,
      persister: opts.persister,
      now: opts.now,
    };
  }

  start(): void {
    if (this.timer || this.destroyed) return;
    // Check immediately, then on the interval.
    this.tick();
    this.timer = setInterval(() => this.tick(), this.opts.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  destroy(): void {
    this.stop();
    this.destroyed = true;
  }

  /** Returns the number of snapshots persisted by this runner. */
  getPersistedCount(): number {
    return this.persistedCount;
  }

  private tick(): void {
    if (this.destroyed) return;
    const now = this.opts.now ? this.opts.now() : new Date();
    const enabled = this.opts.getEnabled();
    const snapshotHour = this.opts.getSnapshotHour();
    const existing = this.opts.loader ? this.opts.loader() : loadSnapshots();

    if (!shouldPersistToday(enabled, snapshotHour, now, existing)) return;

    const inputs = this.opts.buildInputs();
    const snapshot = buildChronicleSnapshot(inputs);
    const retentionDays = this.opts.getRetentionDays();
    if (this.opts.persister) {
      this.opts.persister(snapshot, retentionDays);
    } else {
      persistSnapshot(snapshot, retentionDays);
    }
    this.persistedCount++;

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("kovy-chronicle-snapshot", {
        detail: { dateStr: snapshot.dateStr },
      }));
    }
  }
}
