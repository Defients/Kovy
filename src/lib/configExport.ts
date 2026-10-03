// ============================================================
// Config Export/Import — full config JSON export with metadata,
// validation, diff view, and partial import support.
// ============================================================

import type { KovyConfig } from "@/store/types";
import { CONFIG_VERSION } from "@/store/types";
import { safeImportConfig, deepMerge } from "@/store/configValidation";
import { DEFAULT_CONFIG } from "@/store/defaults";
import { KOVY_VERSION } from "@/lib/version";

export interface ConfigExportBundle {
  metadata: {
    exportedAt: string;
    kovyVersion: string;
    configVersion: number;
    label?: string;
  };
  config: KovyConfig;
}

export interface ConfigImportResult {
  success: boolean;
  config: KovyConfig | null;
  errors: string[];
  warnings: string[];
  diff: ConfigDiff | null;
}

export interface ConfigDiff {
  addedSections: string[];
  modifiedSections: string[];
  removedSections: string[];
  changes: SectionChange[];
}

interface SectionChange {
  section: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/** Export a full config as a JSON string with metadata */
export function exportConfig(config: KovyConfig, label?: string): string {
  const bundle: ConfigExportBundle = {
    metadata: {
      exportedAt: new Date().toISOString(),
      kovyVersion: KOVY_VERSION,
      configVersion: CONFIG_VERSION,
      label,
    },
    config,
  };
  return JSON.stringify(bundle, null, 2);
}

/** Trigger a browser download of the config JSON */
export function downloadConfig(config: KovyConfig, label?: string): void {
  const json = exportConfig(config, label);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `kovy-config-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Import and validate a config from a JSON string */
export function importConfig(json: string, currentConfig: KovyConfig): ConfigImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { success: false, config: null, errors: ["Invalid JSON format"], warnings, diff: null };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { success: false, config: null, errors: ["Not a valid config object"], warnings, diff: null };
  }

  const obj = parsed as Record<string, unknown>;
  let configObj: Record<string, unknown>;

  if (obj.metadata && obj.config && typeof obj.config === "object") {
    configObj = obj.config as Record<string, unknown>;
  } else {
    configObj = obj;
  }

  if (typeof configObj.version !== "number") {
    errors.push("Missing or invalid version field");
    return { success: false, config: null, errors, warnings, diff: null };
  }

  if (configObj.version > CONFIG_VERSION) {
    errors.push(`Config version ${configObj.version} is newer than supported ${CONFIG_VERSION}`);
    return { success: false, config: null, errors, warnings, diff: null };
  }

  const importResult = safeImportConfig(configObj);
  if (!importResult.config) {
    errors.push(...importResult.errors);
    if (errors.length === 0) errors.push("Config validation failed during import");
    return { success: false, config: null, errors, warnings, diff: null };
  }
  warnings.push(...importResult.errors.filter(e => !e.includes("not an object") && !e.includes("newer than")));

  const diff = computeDiff(currentConfig, importResult.config);
  return { success: true, config: importResult.config, errors, warnings, diff };
}

/** Import only specific sections from a config */
export function importPartialConfig(
  json: string,
  currentConfig: KovyConfig,
  sections: string[],
): ConfigImportResult {
  const fullResult = importConfig(json, currentConfig);
  if (!fullResult.success || !fullResult.config) {
    return fullResult;
  }

  const partial: Record<string, unknown> = { version: CONFIG_VERSION };
  for (const section of sections) {
    const key = section as keyof KovyConfig;
    if ((fullResult.config as unknown as Record<string, unknown>)[section] !== undefined) {
      partial[section] = (fullResult.config as unknown as Record<string, unknown>)[section];
    }
  }

  const merged = deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, partial) as unknown as KovyConfig;
  return {
    ...fullResult,
    config: merged,
    diff: computeDiff(currentConfig, merged),
  };
}

/** Compute a diff between two configs */
function computeDiff(oldConfig: KovyConfig, newConfig: KovyConfig): ConfigDiff {
  const addedSections: string[] = [];
  const modifiedSections: string[] = [];
  const removedSections: string[] = [];
  const changes: SectionChange[] = [];

  const allSections = new Set([
    ...Object.keys(oldConfig),
    ...Object.keys(newConfig),
  ]);

  for (const section of allSections) {
    const oldVal = (oldConfig as unknown as Record<string, unknown>)[section];
    const newVal = (newConfig as unknown as Record<string, unknown>)[section];

    if (oldVal === undefined && newVal !== undefined) {
      addedSections.push(section);
    } else if (oldVal !== undefined && newVal === undefined) {
      removedSections.push(section);
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      modifiedSections.push(section);
      if (typeof oldVal === "object" && typeof newVal === "object" && oldVal && newVal) {
        const oldObj = oldVal as Record<string, unknown>;
        const newObj = newVal as Record<string, unknown>;
        const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
        for (const key of allKeys) {
          if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
            changes.push({ section, field: key, oldValue: oldObj[key], newValue: newObj[key] });
          }
        }
      } else {
        changes.push({ section, field: "", oldValue: oldVal, newValue: newVal });
      }
    }
  }

  return { addedSections, modifiedSections, removedSections, changes };
}

/** Read a file from a File input element */
export function readConfigFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
