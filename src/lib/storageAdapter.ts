// ============================================================
// Kovy Storage Adapter — unified persistence interface
// Auto-detects Tauri store vs localStorage and provides
// a consistent async API for all engines.
// ============================================================

export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

// --- localStorage adapter ---

class LocalStorageAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = typeof localStorage !== "undefined"
        ? localStorage.getItem(key)
        : null;
      if (raw) return JSON.parse(raw) as T;
    } catch { /* ignore */ }
    return null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch { /* ignore */ }
  }

  async delete(key: string): Promise<void> {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
    } catch { /* ignore */ }
  }
}

// --- Tauri store adapter ---

class TauriStoreAdapter implements StorageAdapter {
  private store: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    save: () => Promise<void>;
    delete: (key: string) => Promise<boolean>;
  } | null = null;
  private initPromise: Promise<void> | null = null;

  private async init(): Promise<void> {
    if (this.store) return;
    if (this.initPromise) { await this.initPromise; return; }
    this.initPromise = (async () => {
      try {
        const { load } = await import("@tauri-apps/plugin-store");
        this.store = await load("kovy-engine-state.json");
      } catch {
        // Fall back to localStorage
      }
    })();
    await this.initPromise;
  }

  async get<T>(key: string): Promise<T | null> {
    await this.init();
    if (!this.store) return localStorageAdapter.get<T>(key);
    try {
      const raw = await this.store.get(key);
      if (raw && typeof raw === "object") return raw as T;
      if (typeof raw === "string") {
        try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
      }
      return null;
    } catch {
      return localStorageAdapter.get<T>(key);
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.init();
    if (!this.store) { localStorageAdapter.set(key, value); return; }
    try {
      await this.store.set(key, value);
      await this.store.save();
    } catch {
      localStorageAdapter.set(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    await this.init();
    if (!this.store) { localStorageAdapter.delete(key); return; }
    try {
      await this.store.delete(key);
      await this.store.save();
    } catch {
      localStorageAdapter.delete(key);
    }
  }
}

// --- Synchronous localStorage wrapper (for engines that need sync access) ---

export class SyncStorageWrapper {
  private cache: Map<string, unknown> = new Map();
  private adapter: StorageAdapter;

  constructor(adapter: StorageAdapter) {
    this.adapter = adapter;
  }

  /** Load a value synchronously from cache, or return null. Call load() first. */
  getCached<T>(key: string): T | null {
    return (this.cache.get(key) as T) ?? null;
  }

  /** Async load a value into cache. */
  async load<T>(key: string): Promise<T | null> {
    const value = await this.adapter.get<T>(key);
    if (value !== null) this.cache.set(key, value);
    return value;
  }

  /** Save a value (async) and update cache. */
  async save<T>(key: string, value: T): Promise<void> {
    this.cache.set(key, value);
    await this.adapter.set(key, value);
  }

  /** Save synchronously to cache only — call flush() later to persist. */
  saveCached<T>(key: string, value: T): void {
    this.cache.set(key, value);
  }

  /** Flush a specific key to the adapter. */
  async flush(key: string): Promise<void> {
    const value = this.cache.get(key);
    if (value !== undefined) {
      await this.adapter.set(key, value);
    }
  }

  /** Flush all cached keys. */
  async flushAll(): Promise<void> {
    for (const [key, value] of this.cache) {
      await this.adapter.set(key, value);
    }
  }

  /** Delete a key from cache and adapter. */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    await this.adapter.delete(key);
  }
}

// --- Singleton instances ---

const localStorageAdapter = new LocalStorageAdapter();
let tauriAdapter: TauriStoreAdapter | null = null;
let detectedAdapter: StorageAdapter | null = null;
let detectionPromise: Promise<void> | null = null;

async function detectAdapter(): Promise<void> {
  if (detectedAdapter) return;
  if (detectionPromise) { await detectionPromise; return; }
  detectionPromise = (async () => {
    try {
      // Check if we're in a Tauri environment
      const { isTauri } = await import("@tauri-apps/api/core");
      if (await isTauri()) {
        tauriAdapter = new TauriStoreAdapter();
        detectedAdapter = tauriAdapter;
      } else {
        detectedAdapter = localStorageAdapter;
      }
    } catch {
      detectedAdapter = localStorageAdapter;
    }
  })();
  await detectionPromise;
}

/** Get the best available storage adapter for the current environment. */
export async function getStorageAdapter(): Promise<StorageAdapter> {
  await detectAdapter();
  return detectedAdapter ?? localStorageAdapter;
}

/** Get the localStorage adapter directly (for engines that need sync access). */
export function getLocalStorageAdapter(): StorageAdapter {
  return localStorageAdapter;
}
