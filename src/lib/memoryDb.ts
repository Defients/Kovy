// ============================================================
// Memory DB — SQLite wrapper for Kovy's local memory store
// Uses @tauri-apps/plugin-sql with sqlite:kovy-memory.db
// All data stays local. No network. No cloud.
// ============================================================

import type { MemoryRecord, MemoryType, MemoryConfig } from "@/store/types";

type Database = {
  execute: (query: string, bindValues?: unknown[]) => Promise<{ rowsAffected: number; lastInsertId: number }>;
  select: <T>(query: string, bindValues?: unknown[]) => Promise<T[]>;
  close: () => Promise<boolean>;
};

let db: Database | null = null;
let dbInitPromise: Promise<Database | null> | null = null;
let dbInitError: string | null = null;

async function getDb(): Promise<Database | null> {
  if (db) return db;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    try {
      const { default: Database } = await import("@tauri-apps/plugin-sql");
      db = await Database.load("sqlite:kovy-memory.db") as unknown as Database;

      // Health check: verify tables exist
      try {
        const rows = await db.select<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='memories'"
        );
        if (!rows || rows.length === 0) {
          console.warn("Kovy MemoryDB: memories table not found — migrations may not have run yet");
          dbInitError = "Database connected but 'memories' table missing. Migrations may not have run.";
        } else {
          dbInitError = null;
        }
      } catch (healthErr) {
        console.warn("Kovy MemoryDB: health check failed", healthErr);
        dbInitError = `Health check failed: ${healthErr}`;
      }

      return db;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Kovy MemoryDB: SQLite initialization failed:", msg, e);
      dbInitError = msg;
      return null;
    }
  })();

  return dbInitPromise;
}

export function getDbInitError(): string | null {
  return dbInitError;
}

export async function isMemoryDbAvailable(): Promise<boolean> {
  const conn = await getDb();
  return conn !== null;
}

// --- Write ---

export async function writeMemory(record: Omit<MemoryRecord, "id">): Promise<number | null> {
  const conn = await getDb();
  if (!conn) return null;

  try {
    const result = await conn.execute(
      `INSERT INTO memories (entity_id, type, significance, timestamp, duration, valence, stimulation, tags, app_process, app_title, summary, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        record.entityId,
        record.type,
        record.significance,
        record.timestamp,
        record.duration,
        record.valence,
        record.stimulation,
        record.tags,
        record.appProcess,
        record.appTitle,
        record.summary,
        record.data,
      ]
    );
    return result.lastInsertId;
  } catch (e) {
    console.warn("Kovy MemoryDB: Failed to write memory", e);
    return null;
  }
}

// --- Read ---

interface DbMemoryRow {
  id: number;
  entity_id: string;
  type: string;
  significance: number;
  timestamp: number;
  duration: number;
  valence: number;
  stimulation: number;
  tags: string;
  app_process: string | null;
  app_title: string | null;
  summary: string;
  data: string | null;
}

function rowToRecord(row: DbMemoryRow): MemoryRecord {
  return {
    id: row.id,
    entityId: row.entity_id,
    type: row.type as MemoryType,
    significance: row.significance,
    timestamp: row.timestamp,
    duration: row.duration,
    valence: row.valence,
    stimulation: row.stimulation,
    tags: row.tags,
    appProcess: row.app_process,
    appTitle: row.app_title,
    summary: row.summary,
    data: row.data,
  };
}

export async function getRecentMemories(
  entityId: string,
  limit: number = 50
): Promise<MemoryRecord[]> {
  const conn = await getDb();
  if (!conn) return [];

  try {
    const rows = await conn.select<DbMemoryRow>(
      `SELECT * FROM memories WHERE entity_id = $1 ORDER BY timestamp DESC LIMIT $2`,
      [entityId, limit]
    );
    return rows.map(rowToRecord);
  } catch (e) {
    console.warn("Kovy MemoryDB: Failed to read memories", e);
    return [];
  }
}

export async function getMemoriesByType(
  entityId: string,
  type: MemoryType,
  limit: number = 20
): Promise<MemoryRecord[]> {
  const conn = await getDb();
  if (!conn) return [];

  try {
    const rows = await conn.select<DbMemoryRow>(
      `SELECT * FROM memories WHERE entity_id = $1 AND type = $2 ORDER BY timestamp DESC LIMIT $3`,
      [entityId, type, limit]
    );
    return rows.map(rowToRecord);
  } catch (e) {
    console.warn("Kovy MemoryDB: Failed to read memories by type", e);
    return [];
  }
}

export async function getMemoryCount(entityId: string): Promise<number> {
  const conn = await getDb();
  if (!conn) return 0;

  try {
    const rows = await conn.select<{ count: number }>(
      `SELECT COUNT(*) as count FROM memories WHERE entity_id = $1`,
      [entityId]
    );
    return rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function getTotalMemoryCount(): Promise<number> {
  const conn = await getDb();
  if (!conn) return 0;

  try {
    const rows = await conn.select<{ count: number }>(
      `SELECT COUNT(*) as count FROM memories`
    );
    return rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function getAppAffinityData(
  entityId: string
): Promise<Array<{ app_process: string; total_duration: number; avg_valence: number; count: number }>> {
  const conn = await getDb();
  if (!conn) return [];

  try {
    return await conn.select(
      `SELECT app_process, SUM(duration) as total_duration, AVG(valence) as avg_valence, COUNT(*) as count
       FROM memories
       WHERE entity_id = $1 AND app_process IS NOT NULL AND type = 'app_session'
       GROUP BY app_process
       ORDER BY total_duration DESC
       LIMIT 50`,
      [entityId]
    );
  } catch {
    return [];
  }
}

export async function getScheduleData(
  entityId: string
): Promise<Array<{ hour: number; dow: number; avg_stimulation: number; count: number }>> {
  const conn = await getDb();
  if (!conn) return [];

  try {
    // SQLite: extract hour and day-of-week from unix ms timestamp
    return await conn.select(
      `SELECT
         CAST(((timestamp / 1000) % 86400) / 3600 AS INTEGER) as hour,
         CAST(((timestamp / 1000) / 86400 + 4) % 7 AS INTEGER) as dow,
         AVG(stimulation) as avg_stimulation,
         COUNT(*) as count
       FROM memories
       WHERE entity_id = $1
       GROUP BY hour, dow
       HAVING count > 1
       ORDER BY hour`,
      [entityId]
    );
  } catch {
    return [];
  }
}

export async function getMemorySummariesByType(
  entityId: string
): Promise<Array<{ type: string; count: number; avg_significance: number; avg_valence: number; all_tags: string }>> {
  const conn = await getDb();
  if (!conn) return [];

  try {
    return await conn.select(
      `SELECT type, COUNT(*) as count, AVG(significance) as avg_significance, AVG(valence) as avg_valence, GROUP_CONCAT(tags) as all_tags
       FROM memories
       WHERE entity_id = $1
       GROUP BY type`,
      [entityId]
    );
  } catch {
    return [];
  }
}

// --- Prune ---

export async function pruneMemories(config: MemoryConfig): Promise<number> {
  const conn = await getDb();
  if (!conn) return 0;

  let totalPruned = 0;

  try {
    // Step 1: delete records older than retentionDays
    const cutoffMs = Date.now() - config.retentionDays * 24 * 60 * 60 * 1000;
    const ageResult = await conn.execute(
      `DELETE FROM memories WHERE timestamp < $1`,
      [cutoffMs]
    );
    totalPruned += ageResult.rowsAffected;

    // Step 2: if still over maxMemories, delete lowest-significance records
    const countRows = await conn.select<{ count: number }>(
      `SELECT COUNT(*) as count FROM memories`
    );
    const currentCount = countRows[0]?.count ?? 0;

    if (currentCount > config.maxMemories) {
      const toDelete = currentCount - config.maxMemories;
      const overflowResult = await conn.execute(
        `DELETE FROM memories WHERE id IN (
           SELECT id FROM memories ORDER BY significance ASC, timestamp ASC LIMIT $1
         )`,
        [toDelete]
      );
      totalPruned += overflowResult.rowsAffected;
    }
  } catch (e) {
    console.warn("Kovy MemoryDB: Failed to prune memories", e);
  }

  return totalPruned;
}

// --- Clear ---

export async function clearAllMemories(): Promise<void> {
  const conn = await getDb();
  if (!conn) return;

  try {
    await conn.execute(`DELETE FROM memories`);
  } catch (e) {
    console.warn("Kovy MemoryDB: Failed to clear memories", e);
  }
}

export async function clearEntityMemories(entityId: string): Promise<void> {
  const conn = await getDb();
  if (!conn) return;

  try {
    await conn.execute(`DELETE FROM memories WHERE entity_id = $1`, [entityId]);
  } catch (e) {
    console.warn("Kovy MemoryDB: Failed to clear entity memories", e);
  }
}

// --- All memories export (for Soul) ---

export async function getAllMemoriesForExport(entityId: string): Promise<MemoryRecord[]> {
  const conn = await getDb();
  if (!conn) return [];

  try {
    const rows = await conn.select<DbMemoryRow>(
      `SELECT * FROM memories WHERE entity_id = $1 ORDER BY timestamp DESC`,
      [entityId]
    );
    return rows.map(rowToRecord);
  } catch {
    return [];
  }
}
