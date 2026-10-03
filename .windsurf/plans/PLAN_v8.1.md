# Kovy v8.1 — Feature Expansion Plan

## Overview
12 features/fixes organized into 6 phases, ordered by dependency and complexity.

---

## Phase 1: Quick Wins (High Priority)

### 1A. Increase MAX_ENTITIES to 11
**Files:**
- `src/store/entityStore.ts` — change `MAX_ENTITIES = 5` → `11`, add 6 more entity names to `ENTITY_NAMES`
- `src/store/configValidation.ts` — change clamp from `(1, 5)` → `(1, 11)`
- `src/store/defaults.ts` — no change needed (default maxEntities stays 1)
- `src/settings/tabs/FamilyTab.tsx` — update slider max from 5 to 11
- `src/tests/entityStore.test.ts` — update tests referencing MAX_ENTITIES=5
- `src/tests/multiEntity.test.ts` — update tests referencing MAX_ENTITIES=5

### 1B. Fix SQLite "unavailable"
**Root cause:** `@tauri-apps/plugin-sql` IS installed (package.json line 18) and Rust migrations ARE defined (lib.rs lines 158-267). The dynamic import in `memoryDb.ts` may fail due to:
  - Running outside Tauri (dev mode without `tauri dev`)
  - The `Database.load()` connection string format
  - Missing error details in the catch block

**Fix:**
- `src/lib/memoryDb.ts` — improve error logging in `getDb()`, add retry logic, ensure `Database.load("sqlite:kovy-memory.db")` matches migration DB name
- Add a health-check query after connection to verify tables exist
- `src/engine/memoryEngine.ts` — surface detailed error to MemoryTab
- `src/settings/tabs/MemoryTab.tsx` — show actual error message instead of generic "unavailable"

### 1C. Remove Simple/Advanced toggle for Pro Mode
**Files:**
- `src/settings/SettingsApp.tsx` — remove the view mode toggle UI (lines 271-289), always show all tabs
- `src/settings/settingsViewMode.ts` — `getVisibleSections` always returns all sections (ignore simpleMode flag)
- Remove `viewMode` state and related logic from SettingsApp
- Keep `LiteSettingsApp.tsx` as-is (Lite mode is separate from Pro mode)

### 1D. Green/Red Tab Overlay for Pro Mode
**Concept:** Each tab in the Pro Mode sidebar shows a small green/red dot indicating whether that feature's main toggle is enabled.
**Files:**
- `src/settings/SettingsApp.tsx` — add enablement indicator dot next to each tab label
- Create a helper function `getTabEnabledStatus(sectionId, config)` that returns boolean for each section:
  - `vision` → `config.vision.enabled`
  - `behavior` → `config.behavior.enabled` (or always true)
  - `mood` → `config.mood.enabled`
  - `gaming` → `config.gaming.enabled`
  - `bond` → `config.bond.enabled`
  - `ai` → `config.ai.enabled`
  - `memory` → `config.memory.enabled`
  - `journal` → `config.journal.enabled`
  - `family` → `config.family.enabled`
  - `skinPack` → `config.skinPack.activePackId !== "default"`
  - etc.
- Green dot = enabled, Red/dim dot = disabled

---

## Phase 2: Bug Fixes (High Priority)

### 2A. Fix Hotkeys
**Investigation findings:**
- Capabilities include `global-shortcut:default` ✓
- Plugin registered in lib.rs ✓
- `@tauri-apps/plugin-global-shortcut` installed ✓
- `convertToTauriShortcut` handles all key formats ✓
- Default hotkeys use valid formats ✓
- Callback handles both Pressed/Released states ✓

**Potential issues to fix:**
1. **Double registration race:** Config sync effect (line 75) AND dedicated hotkey effect (line 469) both call `registerHotkeys`. The config sync effect should NOT register hotkeys — only the dedicated effect should.
2. **Handler reference timing:** The config sync effect at line 75 references handlers defined later in the component. While this works in practice (effects run after render), it's fragile.
3. **Add debug logging:** Log each registration attempt and failure to diagnose issues.
4. **Verify Tauri v2 callback API:** The `register` callback may receive `{ id, state, shortcuts }` where `state` is `"Pressed"` — verify this matches.

**Fix:**
- `src/overlay/OverlayApp.tsx` — remove `registerHotkeys` call from config sync effect (lines 75-90), keep only in dedicated hotkey effect
- `src/lib/tauriBridge.ts` — add verbose logging on register success/failure, log when handler fires
- Test each hotkey individually

### 2B. Fix Skin Packs for ALL entities
**Root cause:** `KovyRenderer.tsx` applies skin pack overrides to founder only (lines 1605-1645). Sibling render state (lines 1897-1946) doesn't use skin pack data.

**Fix:**
- `src/overlay/KovyRenderer.tsx` — apply skin pack overrides to sibling render states:
  - Add `activeSkinPack` lookup for siblings (same as founder)
  - Apply `eyeStyle`, `bodyStyle`, `primaryColor`, `secondaryColor`, `toneMode`, `rimLightIntensity` from skin pack when sibling doesn't have custom colors enabled
  - ~line 1897-1946: add skin pack fields to `sibRenderState`

### 2C. Fix "Send all entities to" screen understanding
**Root cause:** `GeneralTab.tsx` uses `m.name ?? \`monitor_${i}\`` for the monitor identifier. But `resolveDisplayMonitor` in `monitorUtils.ts` uses `getMonitorByName` which matches against `monitor.name`. The Tauri `availableMonitors()` API may return `name: null` on some systems, causing mismatches.

**Fix:**
- `src/settings/tabs/GeneralTab.tsx` — use a consistent monitor identifier (e.g., `monitor_${i}` index-based) that matches what `resolveDisplayMonitor` expects
- `src/lib/monitorUtils.ts` — update `resolveDisplayMonitor` to handle index-based monitor IDs like `monitor_0`, `monitor_1`
- `src/overlay/KovyRenderer.tsx` — ensure `getEntityBounds` and `resolveDisplayMonitor` use the same monitor identification scheme

### 2D. Improve Journal Log
**Issues:**
- `JournalTab.tsx` only shows 7 of 13 entry types in `TYPE_ICONS` and `TYPE_LABELS`
- Entry body text is not displayed in the UI
- No timestamp formatting beyond `toLocaleString()`

**Fix:**
- `src/settings/tabs/JournalTab.tsx`:
  - Add all 13 entry types to `TYPE_ICONS` and `TYPE_LABELS` (add: `focus_session`, `seasonal_event`, `growth_event`, `celebration`, `whisper`, `behavior_first`)
  - Display entry body text below the title in each journal entry card
  - Add mood indicator (color dot) for each entry
  - Add search/filter by text content
  - Improve date formatting (relative time like "2h ago")

---

## Phase 3: Medium Features

### 3A. Add "All Screens" Motion Analysis Source
**Files:**
- `src/settings/tabs/GeneralTab.tsx` — add `{ value: "all", label: "All monitors (stitched)" }` option to the Motion analysis source select
- `src/store/types.ts` — `MonitorMode` type already accepts `string`, so "all" is valid
- `src/lib/tauriBridge.ts` — in `syncConfigToBackend`, handle `monitorMode === "all"` by NOT setting a single monitor index; instead capture from all monitors
- `src-tauri/src/capture.rs` — add support for capturing all monitors (stitch frames or capture per-monitor and merge motion regions)
- `src-tauri/src/lib.rs` — may need a new command or modification to `set_monitor_index` to accept a special "all" value

### 3B. Ask Kovy Visibility + AI Log
**Issues:**
- Ask Kovy is only accessible via command palette or hotkey — needs a persistent UI element
- No log of AI responses or screenshot captures

**Fix:**
- `src/settings/tabs/AITab.tsx`:
  - Add an "Ask Kovy Now" button at the top of the AI settings tab
  - Add an "AI Activity Log" section showing:
    - Timestamp of each AI request (auto and manual)
    - Source (auto/ask-kovy)
    - What was captured (monitor names, resolution, quality)
    - AI response summary (thought text, whisper text)
    - Token usage estimate (if available from API response)
    - Error messages
  - Log entries stored in localStorage (like journal) with max 100 entries
- Create `src/engine/aiLogEngine.ts` — lightweight log engine for AI activity
- `src/overlay/OverlayApp.tsx` — feed AI insights and screenshot events to the log engine
- `src/engine/aiCoordinator.ts` — add callback for raw AI response data (for logging)

### 3C. Custom Reticles
**Files:**
- `src/store/types.ts` — add `reticleStyle` to `AdvancedConfig` (e.g., `"crosshair" | "dot" | "circle" | "square" | "custom"`)
- `src/store/defaults.ts` — add default `reticleStyle: "crosshair"`
- `src/settings/tabs/AdvancedTab.tsx` — add reticle style selector with preview, and file upload for custom reticle
- `src/overlay/debugOverlays.ts` — update the reticle drawing code to support different styles
- Custom reticle: user uploads an image, stored as base64 in localStorage, rendered as the reticle

---

## Phase 4: Toys Feature

### 4A. Toy System Architecture
**New files:**
- `src/engine/toyEngine.ts` — manages toy state, physics, and behavioral influence
- `src/store/types.ts` — add `ToyConfig` interface:
  ```typescript
  interface ToyConfig {
    enabled: boolean;
    placedToys: PlacedToy[];
  }
  interface PlacedToy {
    id: string;
    type: ToyType;
    position: Vec2;
    rotation: number;
    velocity?: Vec2; // for physics toys
  }
  ```
- `src/store/defaults.ts` — add default toy config

### 4B. Toy Definitions
**Types of toys:**
- **Physics toys:** Ball (bounces, Kovy kicks it), Balloon (floats up, Kovy bats it), Block (Kovy pushes it)
- **Behavior toys:** Bed (Kovy sleeps nearby), Laser Pointer (Kovy chases the dot), Treat (Kovy eats it, gets happy), Toy Mouse (Kovy hunts it), Music Box (Kovy dances nearby), Mirror (Kovy interacts with reflection)

**Files:**
- `src/engine/toyEngine.ts` — define toy types, physics update loop, behavioral influence mapping
- `src/overlay/ToyRenderer.ts` (new) — render toys on the overlay canvas

### 4C. Toy UI
- `src/settings/tabs/ToysTab.tsx` (new) — toy selection palette, enable/disable, clear all toys
- `src/settings/settingsViewMode.ts` — add "toys" section
- `src/settings/SettingsApp.tsx` — add Toys tab
- Click on overlay to place selected toy (when in toy placement mode)

### 4D. Integration
- `src/overlay/KovyRenderer.tsx` — integrate toy rendering and behavioral influence
- `src/engine/behaviorEngine.ts` — add toy-aware behavior states (hunt, play, sleep_near_toy)
- `src/engine/moodEngine.ts` — toys can influence mood (treat = +comfort, laser = +stimulation)

---

## Phase 5: Experimental Mode (Full Screen Interaction)

### 5A. Architecture
**Concept:** When experimental mode is enabled, Kovy can actually trigger clicks/inputs on screen elements using Windows accessibility APIs.

**New files:**
- `src-tauri/src/experimental.rs` — Rust backend for screen interaction:
  - `get_window_at_position(x, y)` — returns window handle and element info
  - `simulate_click(x, y, button)` — triggers a real mouse click at screen coordinates
  - `get_element_info(x, y)` — UI Automation API to get element name, type, bounds
  - `simulate_key(key)` — simulate keyboard input
- `src-tauri/src/lib.rs` — register new commands and module

### 5B. Frontend
- `src/store/types.ts` — add `ExperimentalConfig`:
  ```typescript
  interface ExperimentalConfig {
    enabled: boolean;
    interactionRadius: number; // how far Kovy can reach
    autoInteract: boolean; // Kovy automatically interacts
    allowedInteractions: ('click' | 'hover' | 'type')[];
  }
  ```
- `src/engine/experimentalEngine.ts` (new) — manages experimental mode state and interaction logic
- `src/overlay/KovyRenderer.tsx` — render interaction indicators when experimental mode is active
- `src/settings/tabs/ExperimentalTab.tsx` (new) — settings for experimental mode with safety warnings

### 5C. Safety
- Require explicit user opt-in with warning dialog
- Log all interactions to journal
- Privacy pause disables experimental mode
- Rate limit interactions (max 1 per 5 seconds)
- Only interact when Kovy is in specific behavior states (curious, playful)

---

## Phase 6: Multi-Screen Entity Placement Fix

### 6A. Root Cause
The overlay window spans the virtual desktop, but entity positions and monitor bounds may not correctly account for monitor offsets within the virtual desktop.

**Files:**
- `src/overlay/monitorBounds.ts` — verify `toOverlayLocalBounds` and `toOverlayLocalPosition` correctly transform between virtual desktop coordinates and overlay-local coordinates
- `src/overlay/KovyRenderer.tsx` — verify entity confinement bounds use correct transformations
- `src/lib/monitorUtils.ts` — ensure `getEntityBounds` returns correct bounds for all monitor configurations
- Test with multi-monitor setups (different resolutions, arrangements)

---

## Implementation Order
1. Phase 1 (1A-1D) — Quick wins, no dependencies
2. Phase 2 (2A-2D) — Bug fixes, no dependencies on Phase 1
3. Phase 3 (3A-3C) — Medium features, some depend on Phase 2 fixes
4. Phase 6 — Multi-screen fix, independent
5. Phase 4 — Toys, depends on stable engine integration
6. Phase 5 — Experimental mode, most complex, depends on all prior phases

## Testing
- Update existing tests for MAX_ENTITIES change
- Add tests for toy engine
- Add tests for experimental mode safety limits
- Manual testing required for hotkeys, multi-monitor, and screen interaction
