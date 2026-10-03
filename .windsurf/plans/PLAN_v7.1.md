# Kovy v7.1 — "Inner World + Foundation + Power" Update Plan

## Overview

A comprehensive update across three pillars: **Inner World** (making Kovy feel more alive), **Foundation & Quality** (engineering rigor), and **Power User Features** (user control). This plan sequences work so foundational changes come first, enabling cleaner implementation of features on top.

---

## Phase 1: Foundation & Quality

### 1.1 Test Suite for Core Engines
**Files:** `tests/*.test.ts`, `vitest.config.ts` (update)

Unit tests for the most logic-heavy engines:
- `moodEngine.test.ts` — `deriveSurfaceMood()` edge cases, `updateMoodState()` drift directions, personality application
- `behaviorEngine.test.ts` — state transitions, hyper mode, habitat awareness, startle triggers
- `bondEngine.test.ts` — point accumulation, level thresholds, decay, streak bonuses
- `circadianEngine.test.ts` — phase computation, 24-slot histogram, dream/startle timing
- `focusEngine.test.ts` — focus accumulation/decay, state thresholds, session tracking
- `idleEngine.test.ts` — idle detection, behavior cycling
- `configValidation.test.ts` — migration ladder v1→v13, deepMerge, clampConfig
- `utils.test.ts` — clamp, lerp, dampedSpring, distance

Each test file: 5-15 focused test cases covering happy paths and edge cases.

### 1.2 KovyRenderer Refactor
**Current:** `KovyRenderer.tsx` is 2300 lines — a single `animate` callback doing everything.
**Target:** Extract logical sections into focused modules while keeping the main component as orchestrator.

Extract into:
- `renderer/frameLoop.ts` — RAF loop, FPS tracking, dt computation
- `renderer/engineUpdater.ts` — All throttled engine update logic (focus, idle, seasonal, growth, stats, personality, celebration, thought, whisper, ambient, relations, profiles, audio reactivity)
- `renderer/founderRenderer.ts` — Founder entity render state assembly + rendering
- `renderer/siblingRenderer.ts` — Sibling entity update + render loop
- `renderer/overlayRenderer.ts` — Atmosphere, weather, habitat objects, debug overlays, thought bubbles, whispers, audio visualizer
- `renderer/engineInit.ts` — Engine initialization and config-driven re-init logic
- `renderer/types.ts` — Shared types for the renderer layer (FrameState, EngineMap, etc.)

`KovyRenderer.tsx` becomes ~200 lines: canvas setup, engine init call, frame loop call, cleanup.

### 1.3 Error Recovery Framework
**Files:** `src/engine/errorBoundary.ts`, updates to `diagnosticsEngine.ts`

- Wrap each engine update in a try/catch with structured error reporting
- Failed engines get a cooldown (skip updates for N seconds) instead of spamming errors
- `EngineHealth` tracker in diagnostics: per-engine failure count, last error, cooldown status
- Expose health summary for diagnostic dashboard (Phase 3)
- Auto-disable an engine after 10 consecutive failures (with re-enable on config change)

### 1.4 Config Validation Tests
**Files:** `tests/configValidation.test.ts`

- Test migration from each version (v1→v2, v2→v3, ... v12→v13)
- Test deepMerge with partial configs, missing sections, extra keys
- Test clampConfig bounds enforcement
- Test safeImportConfig with malformed JSON, null values, wrong types
- Test CONFIG_VERSION consistency between types.ts and defaults.ts

---

## Phase 2: Inner World

### 2.1 Dream Engine
**Files:** `src/engine/dreamEngine.ts` (new), config additions in `types.ts`/`defaults.ts`

When Kovy enters `dream` or `nap` behavior state with high `dreamIntensity`:
- **Dream particles**: Floating, semi-transparent icons (stars, moons, clouds, tiny fish) that drift upward from Kovy's position
- **Dream thoughts**: Special thought bubbles with dream-specific content ("flying over mountains...", "chasing a giant butterfly...", "floating in space...")
- **Dream color wash**: Subtle hue shift on Kovy's glow during deep dreams
- **Dream journal**: Record memorable dreams to the journal system

Config (`DreamConfig`):
- `enabled: boolean`
- `particleDensity: number` (0-1)
- `thoughtFrequency: number` (0-1, how often dream thoughts appear)
- `colorWash: boolean` (subtle glow hue shift during dreams)
- `maxDreamParticles: number` (5-20)

Integration points:
- `KovyRenderer` — check `dreamIntensity > 0.3` and `behaviorState === "dream" | "nap"`, spawn dream particles
- `thoughtEngine` — add dream-specific thought category
- `journalEngine` — `recordDream()` method
- `KovyCharacter` — apply `dreamColorWash` to glow color

### 2.2 Expanded Context-Aware Content Pools
**Files:** `src/engine/thoughtEngine.ts`, `src/engine/whisperEngine.ts` (major expansion)

**Thought Engine expansion:**
- Add `TimeOfDayThoughts`: morning (waking up, fresh start), midday (energy peak), afternoon (post-lunch drowsy), evening (winding down), late_night (philosophical, sleepy)
- Add `BondLevelThoughts`: stranger (cautious, observing), acquaintance (warming up), companion (comfortable), friend (close, loyal), best_friend (deep bond, gratitude)
- Add `GrowthStageThoughts`: sprout (curious about everything), young (energetic), mature (reflective), elder (wise, nostalgic)
- Add `SeasonalThoughts`: spring (renewal), summer (adventure), autumn (cozy), winter (hibernate)
- Add `AppContextThoughts`: coding (impressed by code), writing (inspired by words), gaming (excited spectator), browsing (curious about content), music (grooving)
- Expand base mood/behavior/personality pools from ~3-5 entries to 8-12 each
- Total: ~200+ unique thought strings, contextually selected

**Whisper Engine expansion:**
- Add `TimeOfDayWhispers`: morning motivation, afternoon energy, evening comfort, late_night deep thoughts
- Add `BondLevelWhispers`: messages that reference the relationship depth
- Add `WeatherWhispers`: comments about current weather
- Add `SeasonalWhispers`: seasonal references
- Add `FocusStateWhispers`: encouragement during deep focus, gentle break reminders
- Expand base categories from 5 to 15+ per category
- Add `contextualPrefix` system: occasionally prefix whispers with context ("On this rainy day...", "While you're coding...", "It's been a while...")
- Total: ~300+ unique whisper strings

**Selection algorithm upgrade:**
- Weighted selection that considers: current context tags (time, weather, season, bond, app, growth, focus, mood, behavior), personality preset, recent history (avoid repeats within 20 messages)
- `selectWeighted(pool, contextWeights, recentHistory)` utility

### 2.3 Growth Stage Visual Differentiation
**Files:** `src/overlay/KovyCharacter.ts`, `src/overlay/character/bodyRenderer.ts`, `src/overlay/character/particleRenderer.ts`

Each growth stage gets distinct visual characteristics:

- **Sprout** (0-3 days):
  - Size multiplier: 0.75x
  - Brighter, more saturated colors (+10% saturation)
  - More particles (1.5x spawn rate)
  - Bouncier idle animation (higher breath depth)
  - Smaller eyes (proportionally)

- **Young** (3-14 days):
  - Size multiplier: 0.9x
  - Standard colors
  - Standard particle rate
  - Energetic idle (slightly faster breath rate)

- **Mature** (14-60 days):
  - Size multiplier: 1.0x
  - Richer, deeper colors (+5% lightness on dark tones, -5% on light)
  - Rim light slightly stronger (0.35 vs 0.3)
  - Standard particle rate
  - Calm, steady idle

- **Elder** (60+ days):
  - Size multiplier: 1.1x
  - Softer, slightly desaturated colors (-5% saturation)
  - Wispy particles (smaller, slower, more transparent)
  - Gentler glow (pulsing slower)
  - Slower breath rate (0.4 vs 0.6)
  - Slightly droopier posture (+0.03 droop)
  - Occasional "wisdom sparkles" (rare golden particles)

Implementation: Add `growthStage` to `KovyRenderState`, apply stage-specific modifiers in `KovyCharacter.renderEntity()`.

### 2.4 Right-Click Context Menu
**Files:** `src/overlay/ContextMenu.tsx` (new), `src/overlay/OverlayApp.tsx` (integration)

When `bond.rightClickMenu` is enabled, right-clicking on Kovy (within `grabRadius`) shows a radial/popup menu:

**Menu items:**
- **Pet** — triggers celebrate behavior + bond points
- **Feed** — triggers a "snack" behavior (custom: Kovy does a happy wiggle)
- **Nap** — forces nap behavior
- **Play** — forces dance/playful behavior
- **Settings** — opens settings window
- **Hide** — hides overlay (tray icon remains)
- **Mood** → submenu: Force mood (calm, excited, sleepy, etc.)
- **Profile** → submenu: Switch saved profile

**Implementation:**
- React component positioned at cursor on right-click
- Click-through temporarily disabled while menu is open
- Menu auto-dismisses on click-outside or ESC
- Styled with TailwindCSS, kovy-glass aesthetic
- Keyboard navigable (arrow keys, enter, esc)

---

## Phase 3: Power User Features

### 3.1 Command Palette
**Files:** `src/settings/CommandPalette.tsx` (new), `src/overlay/CommandPalette.tsx` (new for overlay)

A Ctrl+Shift+P (or configurable hotkey) command palette available in both settings and overlay windows:

**Commands:**
- Toggle features: "Toggle gaming mode", "Toggle focus mode", "Toggle atmosphere", etc.
- Navigation: "Go to settings tab: [name]", "Open onboarding"
- Profiles: "Save profile", "Load profile: [name]", "Delete profile"
- Actions: "Force behavior: [state]", "Force mood: [mood]", "Reset Kovy position"
- Export/Import: "Export config", "Import config", "Export soul", "Import soul"
- Diagnostics: "Show FPS", "Show debug overlay", "Export diagnostics"
- Appearance: "Set visual preset: [name]", "Set behavior preset: [name]"
- Entity: "Add family member", "Remove family member", "Reset all entities"

**Implementation:**
- Fuzzy search over command names
- Keyboard-first: type to search, arrow keys to navigate, Enter to execute, Esc to close
- Recent commands shown first
- Commands registered via a `CommandRegistry` that both windows can use
- Overlay version renders on canvas overlay (needs click-through toggle)

### 3.2 Full Config Export/Import
**Files:** `src/lib/configExport.ts` (new), settings tab integration

- **Export**: Download full `KovyConfig` as JSON file with metadata (version, export date, kovy version)
- **Import**: Upload JSON, validate against schema, run migration if needed, apply
- **Diff view**: Show what changed between current config and imported config
- **Partial import**: Option to import only specific sections
- Integration in Settings → Advanced tab

### 3.3 Diagnostic Dashboard
**Files:** `src/settings/tabs/DiagnosticsTab.tsx` (new), `src/engine/diagnosticsEngine.ts` (expand)

A new settings tab showing:
- **Engine Health**: Per-engine status (healthy/degraded/disabled), failure count, last error
- **Performance**: Current FPS, frame time, engine update times, memory usage estimate
- **Runtime State**: Current behavior, mood, position, active targets, entity count
- **Config Info**: Config version, migration history, storage backend (Tauri/localStorage)
- **Error Log**: Recent errors with timestamps and stack traces
- **Export Diagnostics**: Download diagnostic report as JSON

### 3.4 Profile Auto-Switching Rules
**Files:** `src/engine/profilesEngine.ts` (expand), `src/store/types.ts` (config additions)

Add rule-based profile switching:
- **Time-based**: Switch profile at specific times (e.g., "Work profile at 9am, Gaming profile at 6pm")
- **App-based**: Switch profile when specific app is foregrounded (e.g., "Gaming profile when Steam is focused")
- **Idle-based**: Switch to "Calm" profile after N minutes idle

Config additions to `ProfilesConfig`:
- `autoSwitchRules: Array<{ id, type: "time" | "app" | "idle", condition, profileId, enabled }>`

### 3.5 Advanced Habitat Presets
**Files:** `src/engine/habitatObjectsEngine.ts` (expand), `src/store/types.ts` (additions)

Pre-built habitat layouts:
- **Cozy Room**: Bed, lamp, plant, rug — arranged in a warm corner
- **Gaming Setup**: Monitor, keyboard, headset, energy drink — tech corner
- **Zen Garden**: Stones, bamboo, lantern, bonsai — peaceful arrangement
- **Workspace**: Desk, chair, coffee, notebook — productive corner
- **Party Zone**: Speakers, lights, confetti, cake — celebration space

Config additions:
- `habitatPresets: Array<{ id, name, icon, objects: HabitatObject[] }>`
- "Apply preset" button in habitat settings that places all objects at once

---

## Implementation Sequence

1. **1.1** Test suite (independent, immediate value)
2. **1.4** Config validation tests (pairs with 1.1)
3. **1.3** Error recovery framework (needed before large refactors)
4. **1.2** KovyRenderer refactor (enables cleaner Phase 2/3 integration)
5. **2.1** Dream engine (new engine, clean addition)
6. **2.2** Expanded content pools (standalone, high user impact)
7. **2.3** Growth stage visuals (touches character renderer)
8. **2.4** Right-click context menu (overlay integration)
9. **3.1** Command palette (both windows)
10. **3.2** Config export/import (settings integration)
11. **3.3** Diagnostic dashboard (settings + diagnostics engine)
12. **3.4** Profile auto-switching (profiles engine expansion)
13. **3.5** Habitat presets (habitat engine expansion)

---

## Config Version Bump

`CONFIG_VERSION` 13 → 14 with migration:
- Add `dream` section to config
- Add `autoSwitchRules` to `profiles` section
- Add `habitatPresets` to `habitatObjects` section
- Add `growthStage` to runtime state (not persisted, but needed in render state)

---

## Patch Notes Format

Final patch notes will be structured as:
- **Major Features** (new capabilities)
- **Enhancements** (improvements to existing features)
- **Refactoring** (internal improvements)
- **Tests** (new test coverage)
- **Bug Fixes** (if any discovered during implementation)
- **Config Changes** (new config sections, version bump)
- **Breaking Changes** (if any)

Each entry: bullet point with file references and brief description.
