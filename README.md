# Kovy 9.0.0 — Living Companion

A privacy-first, Windows-first desktop companion that lives above your desktop, reads your screen locally, reacts to interesting motion, has moods and memories, supports multiple entities, generates creative overlays based on app-class heuristics, and now — with explicit opt-in consent — can leverage AI to generate contextual thoughts and whispers by observing your screen. Everything runs locally by default; AI requests are opt-in only, with screenshots sent only when you explicitly enable them.

## What's New in 9.0.0 (Living Companion)

### Three-Pillar Major Release

v9.0.0 is the largest release in Kovy's history, organized around three pillars: **Foundation & Hardening**, **Living World**, and **Companion Story + Conversational Kovy**.

---

### Pillar 1 — Foundation & Hardening

#### Renderer Decomposition
- **KovyRenderer reduced from ~2,656 to ~1,636 lines** (38% reduction) via behavior-preserving extraction into focused modules:
  - `engineManager.ts` — engine container, initialization, and disposal.
  - `renderer/frameState.ts` — frame timing accumulators, cached engine outputs, per-frame state.
  - `renderer/eventHandlers.ts` — custom event listeners and cleanup.
  - `renderer/backgroundRenderers.ts` — aurora, atmosphere, weather particles, habitat objects, dream particles.
  - `renderer/v7EngineUpdates.ts` — throttled v7 engine updates (focus, idle, seasonal, growth, stats, personality, celebration, thought, whisper, ambient sound, entity relations, profiles, audio reactivity).
  - `toastHandlers.ts` — toast module re-exports.
- No rendering or update semantics were changed. All event listener function identities preserved for correct cleanup.

#### Real OS Idle Detection (D1 fix)
- Replaced the launch-time `Instant`-based idle timer with Windows OS-level input tracking via `GetLastInputInfo` + `GetTickCount`.
- New `src-tauri/src/idle.rs` with Windows implementation and non-Windows fallback.
- Removed the broken `reset_idle_timer` / `resetIdleTimer` from Rust, the Tauri invoke handler, and the frontend bridge.
- Idle duration now reflects actual user inactivity, not time since app launch.

#### Experimental Mode Hardening (D2 fix)
- **Coordinate conversion**: Added `toScreenPosition()` and `updateVirtualDesktop()` to convert overlay-local canvas coordinates to physical screen coordinates before calling native Windows APIs. Prevents clicks/hovers from being sent to wrong screen locations, especially with multi-monitor layouts or negative monitor origins.
- **Target validation**: Experimental interactions now query `getWindowAtPosition()` at the converted screen coordinate and reject the interaction when no target window exists — no more blindly clicking empty desktop space.
- **Real hover**: Added `simulate_hover` Rust command that calls `SetCursorPos` without generating mouse button events. Hover interactions now perform a real cursor move instead of being a no-op.
- **Type interactions**: Now hover first to focus the target window, then send the key.
- All existing safety gates preserved: experimental mode enabled, explicit opt-in acknowledged, not privacy-paused, allowed behavior state, rate limiting.

#### Dead Code Removal
- Retired `src/settings/settingsViewMode.ts` — a deprecated module not imported by any production code. Lite/Pro mode is handled by `liteMode.ts`.
- Migrated `settingsReachability.test.ts` to test against `liteMode.ts` instead.
- Removed the old Settings View Mode tests from `phaseC.test.ts`.

#### Context Menu Integration
- Wired `ContextMenu.tsx` into the overlay — right-clicking near Kovy now shows a context menu with: Pet, Feed, Set Behavior (Nap/Play), Set Mood (6 options), Settings, Hide Kovy.
- The menu prevents the default browser context menu when near Kovy and handles all actions through the existing store and engine APIs.

---

### Pillar 2 — Living World

#### Toys v2 (D3, D4, D5 fixes)
- **D3 — Physics state ownership**: Physics positions are now maintained in a separate `physicsPositions` map, not by mutating the persisted/applied Zustand config toys in place. `getToys()` returns toys with physics-applied positions without corrupting the config.
- **D4 — Behavior wiring**: `getDominantBehaviorState()` maps toy behaviors to `BehaviorState` values and is wired into the renderer to call `BehaviorEngine.forceState()`. `getConsumedToys()` exposes the consumed set so the renderer can hide eaten treats. Hunt, eat, dance, sleep-near-toy, and push behaviors now actually affect Kovy.
- **D5 — Drag support**: Added `hitTest()` and `dragToy()` methods to the toy engine, plus window-level mouse event listeners in the renderer. Toys can now be dragged to reposition them — fulfilling the claim in ToysTab that was previously unbacked.

#### Intent Engine
- A goal-driven behavior layer that sits above the BehaviorEngine and provides higher-level goals ("intents") that bias Kovy's behavior.
- **6 intent kinds**: rest, play, explore, socialize, observe, nest — each with a target position, progress value, and behavior state bias.
- Intents shift based on: circadian phase (night → rest, day → explore/play), bond level (high bond → socialize), idle time (long idle → rest/nest), surface mood (excited → play, calm → observe/rest), nearby toys (toys → play), and nest availability.
- `changeRate` config controls inertia (lower = more likely to keep current intent).
- Spawns intent thoughts via the ThoughtEngine when intents change.
- `forceIntent()` allows external triggers.
- Debug overlay draws intent target line and label when `showInDebug` is enabled.

---

### Pillar 3 — Companion Story + Conversational Kovy

#### Memory Recall
- Periodically surfaces significant past memories as "recall thoughts" — short reflective text bubbles that give Kovy a sense of remembering.
- Queries the Memory DB for memories above a `minSignificance` threshold, filtered by `maxAgeDays`.
- Randomly selects a memory weighted by significance, formats it as a reflective thought (e.g., "I remember spending time in vscode...").
- Avoids recalling the same memory twice in a row.
- Records recalls in the journal.

#### Story Engine — Weekly Narrative Chapters
- Generates a short narrative chapter each week summarizing Kovy's experiences, growth, and relationship with the user.
- **5 sections per chapter**: The Week (opening), Highlights (notable events), Our Bond (relationship progress), Inner Weather (emotional journey), Looking Forward (closing).
- Built from chronicle snapshots, bond level, mood, and stats.
- Schedules chapter generation on a configurable weekday/hour (default: Sunday 8 PM).
- Persists chapters to localStorage with configurable retention (4-52 weeks).
- Story toast card renders on canvas with a warm amber accent (distinct from chronicle's teal, digest's violet, and profile-switch's blue).
- `Alt+Shift+K` hotkey shows the latest chapter.
- `kovy-show-story` event and command palette entry for on-demand viewing.
- Optional AI polishing (placeholder for future OpenRouter integration).

#### Conversational Kovy — Chat Panel
- An opt-in chat panel that lets the user talk directly with Kovy via the existing Rust OpenRouter transport.
- **Rust backend**: New `ai_chat` Tauri command that calls OpenRouter with plain text (no JSON schema), returning a `ChatResponse` with reply text.
- **ChatEngine**: Manages conversation history ring buffer (configurable 4-30 turns), builds personality-aware system prompts with mood/bond/behavior context, handles errors and typing state, optional localStorage persistence.
- **ChatPanel**: React component with message bubbles, typing indicator, input field, and configurable position (near-kovy or bottom-right).
- `Alt+Shift+C` hotkey toggles the chat panel.
- Command palette entry: "Open Chat".

---

### New Hotkeys
- `Alt+Shift+K` — Show Companion Story (weekly chapter card)
- `Alt+Shift+C` — Talk to Kovy (open/close chat panel)
- `Alt+Shift+Y` — Show Companion Chronicle (existing, unchanged)

---

### Config & Migration
- **CONFIG_VERSION** bumped from 23 to 24 with seamless migration.
- New config sections: `intent`, `story`, `recall`, `chat` — each with typed fields, defaults, validation, and clamping.
- New hotkeys in `HotkeysConfig`: `showStory` and `openChat`.

### Version & Tests
- Version bumped to **9.0.0** across `package.json`, `Cargo.toml`, `tauri.conf.json`, and `version.ts`.
- **1,386 tests across 69 test files**, all passing.
- **16 Rust tests**, all passing.
- New test files:
  - `experimentalEngine.test.ts` (11 tests) — hardened Experimental mode behavior
  - `toyEngine.test.ts` (24 tests) — Toys v2 (D3/D4/D5 fixes)
  - `intentEngine.test.ts` (22 tests) — Intent Engine
  - `recallEngine.test.ts` (19 tests) — Memory Recall
  - `storyEngine.test.ts` (22 tests) — Story Engine
  - `chatEngine.test.ts` (18 tests) — Conversational Kovy
  - `celebrationEngine.test.ts` (29 tests) — coverage
  - `focusEngine.test.ts` (26 tests) — coverage
  - `growthEngine.test.ts` (28 tests) — coverage
  - `whisperEngine.test.ts` (24 tests) — coverage
  - `seasonalEngine.test.ts` (28 tests) — coverage
  - `dreamEngine.test.ts` (29 tests) — coverage
  - `personalityEvolutionEngine.test.ts` (32 tests) — coverage

### Privacy
- All new features are local-first. No new data is transmitted unless the user explicitly enables AI features.
- The Intent Engine reads existing engine state (circadian phase, bond level, mood, idle time) — no new data collection.
- Memory Recall queries the existing local Memory DB — no new data stored.
- Story chapters are built from existing chronicle snapshots and stored in localStorage — no cloud calls.
- Chat uses the existing OpenRouter transport with the same opt-in consent model. Chat history is optionally persisted to localStorage (off by default).

---

## What's New in 8.3.0 (Companion Chronicle)

### Companion Chronicle — Longitudinal Relationship Trends
- **The temporal companion to the Digest**: Where the Digest (v8.2) summarizes your companion relationship *right now*, the Chronicle persists one lightweight snapshot per day and derives week-over-week trends, streaks, and human-readable insights from the accumulated history. It's the first feature that gives Kovy a memory of *how your relationship changes over time* — not just what it is today.
- **`buildChronicleSnapshot()` pure aggregation** (`chronicleEngine.ts`): A side-effect-free function that captures a daily snapshot from the same engine outputs the Digest uses — bond points (with level re-derived from points, not trusted from a stale stored value), surface mood, growth stage, cumulative focus/gaming/emote/thought/whisper totals, milestone count, active seconds, and a one-line highlight title. Each snapshot is ~12 numbers + 2 short strings (~150 bytes/day, ~54 KB for a full year).
- **`buildTrends()` pure trend engine**: Derives a `ChronicleTrends` object from the snapshot history — snapshot count, days span, current streak (consecutive days ending today or yesterday), bond points now vs. ~7 days ago, weekly bond delta, today's focus-minute delta, average daily focus, best focus day, today's gaming sessions, dominant mood this week, and a 7-point bond sparkline. Deduplicates by dateStr (keeps latest timestamp) and sorts ascending internally.
- **`generateInsights()` pure insight surfacing**: Produces 0–6 human-readable insights in priority order: bond growth/decline (positive/encouraging), focus trend (above/below/average), streak (≥3 days), best focus day, consistency (perfect 7-day streak), and dominant mood pattern. Each insight has a `kind`, `text`, and `tone` (positive/neutral/encouraging). The engine returns all relevant insights; the presentation layer caps the visible count.
- **`summarizeChronicle()` one-liner**: For tray tooltips / accessibility — e.g. "Kovy chronicle — 12 days recorded, 7-day streak, +70 bond/wk."

### Daily Snapshot Persistence
- **`chronicleStorage.ts` localStorage store**: A defensive, self-healing wrapper around localStorage. Snapshots are stored under a fixed key (`kovy.chronicle.v1`) so they survive config migrations. Corrupt or malformed payloads are discarded rather than crashing the render loop. All mutation paths go through the pure `mergeSnapshot()` helper so the on-disk array is always sorted and deduplicated by dateStr.
- **`pruneSnapshots()` retention pruning**: Drops snapshots older than the configurable retention window (30–365 days, default 90). Always preserves at least the most recent snapshot so the chronicle is never entirely blanked while the feature is on.
- **`persistSnapshot()` idempotent writes**: Insert-or-replace by dateStr, prune to retention, and persist in one call. Same-day writes replace (keeping the newer timestamp), never append — so restarts, sleep/wake cycles, and multiple triggers per day all collapse to a single daily snapshot.

### Chronicle Runner
- **`ChronicleRunner` daily scheduler** (`chronicleRunner.ts`): Polls every 60 seconds; when the current local hour has reached the configured snapshot hour (default 21:00 / 9 PM) AND no snapshot exists yet for today, builds and persists a ChronicleSnapshot. Idempotent per day via the dateStr key. Dispatches a `kovy-chronicle-snapshot` custom event on persist.
- **Pure `shouldPersistToday()` decision function**: Exported for unit testing — handles enabled/disabled, hour gating (0–23), and same-day idempotency without timers or storage.
- **Engine state via injected getters**: The runner pulls live engine state through a `buildInputs()` callback (wired in `KovyRenderer` where the engine container lives), so it has no direct dependency on stores or the engine container itself.
- **Graceful teardown**: `destroy()` clears the interval; the runner is tied to the `KovyRenderer` component lifecycle.

### Chronicle Overlay Card
- **Teal-accented canvas card** (`chronicleToast.ts`): A multi-section card with a distinct teal accent (vs. the Digest's violet, the capture-app amber, and the profile-switch blue) so the three on-demand overlay cards are visually distinguishable at a glance. Positioned below the Digest card in the right-side toast band.
- **Sections** (rendered only when enabled and present):
  - **📈 Overview** — snapshot count, days span, current streak, and weekly bond delta.
  - **🤝 Bond — last 7 days** — a 7-point sparkline with a gradient fill, end-dot marker, and min/max labels. Falls back to a single bond-points line when fewer than 2 snapshots exist.
  - **✨ Insights** — up to 2 generated insight lines, each with a colored leading dot keyed to its tone (green=positive, amber=encouraging, grey=neutral) and word-wrapped text.
  - **Empty state** — a friendly two-line message when no snapshots exist yet: "The chronicle begins tomorrow. Keep Kovy around and check back to see your bond, focus, and mood trends unfold over time."

### Three Trigger Paths
- **Global hotkey** (`Alt+Shift+Y` by default): Summon the chronicle instantly from anywhere.
- **Tray menu item**: "Show Companion Chronicle" in the system tray menu, positioned between "Show Companion Digest" and "Command Palette".
- **Command palette**: "Show Companion Chronicle" command (category: General, keywords: chronicle, trends, history, streak, insights, weekly) for discoverability via the searchable palette.

### Config System
- **CONFIG_VERSION** bumped from 22 to 23 with seamless migration.
- New `ChronicleConfig` section (6 typed fields): `enabled`, `snapshotHour` (0–23, default 21), `retentionDays` (30–365, default 90), `autoDismissSec` (4–30, default 12), `showTrend`, `showInsights`.
- New `showChronicle` hotkey in `HotkeysConfig` (default: `Alt+Shift+Y`).
- Migration v22 → v23 adds the `chronicle` section and the `showChronicle` hotkey to existing configs.
- All new fields have defaults, validation, and clamping in `clampConfig`.

### Settings UI
- **Companion Chronicle section in the Stats tab**: A full settings panel with an explanatory intro, master enable toggle, snapshot-hour slider (0–23), retention-days slider (30–365), auto-dismiss slider (4–30s), per-section toggles (trend sparkline, insights), and a live **Chronicle status** widget showing the current summary, snapshot count, and a "Clear history" button. Placed in the Stats tab alongside the Digest (rather than a new tab) to keep the settings sidebar count stable and because the chronicle is fundamentally a stats-aggregation feature.
- **Hotkeys tab**: "Show Companion Chronicle" hotkey label and description added.

### Privacy
- The chronicle is computed and stored entirely locally. Snapshots live in localStorage only (~150 bytes/day) — no new data is transmitted. Each snapshot captures bond points, mood, growth stage, cumulative stats totals, milestone count, active seconds, and a one-line highlight title — all of which already exist in local engine state. The "Clear history" button wipes the store immediately. No cloud calls, no telemetry, no keystroke/clipboard access.

### Version & Tests
- Version bumped to **8.3.0** across `package.json`, `Cargo.toml`, `tauri.conf.json`, and `version.ts`.
- **74 new unit tests** across 3 new test files:
  - `chronicleEngine.test.ts` (47 tests): snapshot building, trend computation (streaks, weekly delta, daily deltas, averages, best day, dominant mood, sparkline, deduplication, days span), insight generation (all 6 kinds, tone, determinism, priority order), summarize, prune (retention, keep-latest), merge (replace, sort, idempotency), date formatting.
  - `chronicleStorage.test.ts` (19 tests): round-trip, corrupt-payload handling, malformed-element dropping, deduplication, sorting, field coercion, idempotent persist, retention pruning, clear, SSR safety.
  - `chronicleRunner.test.ts` (8 tests): `shouldPersistToday` decision function (disabled, hour gating, idempotency, edge hours 0 and 23).
- **1 test updated** (phase5Integration config field count: 51 → 52, plus `chronicle` containment check).
- **1079 tests across 56 test files**, all passing.
- **13 Rust tests**, all passing, zero warnings.

---

## What's New in 8.2.0 (Companion Digest)

### Companion Digest — On-Demand Relationship Summary
- **One-card recap of your companion relationship**: A new canvas-rendered overlay card aggregates the state of five existing engines — bond, stats, mood, growth, and journal — into a single, elegant summary you can summon at any time. It's the first feature that ties Kovy's many subsystems together into one user-facing glance.
- **`buildDigest()` pure aggregation engine** (`digestEngine.ts`): A side-effect-free, deterministic function that takes engine outputs and produces a structured `Digest` object. Bond level is re-derived from points (not trusted from a potentially-stale stored level) so the digest is always internally consistent. Includes a `summarizeDigest()` one-liner for tray tooltips / accessibility descriptions.
- **Rich canvas card** (`digestToast.ts`): A multi-section card with a soft violet accent (distinct from the amber capture-app and blue profile-switch toasts). Sections render only when enabled and present:
  - **🤝 Bond** — level, gradient progress bar toward the next level, days together, and streak count.
  - **🎨 Mood** — current surface mood with a per-mood glyph.
  - **📊 Activity** — a 2-column grid of focus minutes, gaming sessions, thoughts, whispers, emotes, and best focus session, plus a footer with milestone count and total active hours.
  - **🌱 Growth** — growth stage and age in days.
  - **✨ Recent highlight** — the most recent qualifying journal entry (prefers today, skips `daily_summary` and `whisper` types), with word-wrapped title and body.
- **Deterministic highlight selection**: The highlight picks the most recent non-summary, non-whisper entry from today, falling back to any non-summary entry, then `null`. No randomness — the same inputs always yield the same highlight.

### Three Trigger Paths
- **Global hotkey** (`Alt+Shift+I` by default): Summon the digest instantly from anywhere.
- **Tray menu item**: "Show Companion Digest" in the system tray menu for mouse-only access, positioned between "Ask Kovy" and "Command Palette".
- **Command palette**: "Show Companion Digest" command (category: General, keywords: digest, summary, stats, bond, recap) for discoverability via the searchable palette.

### Config System
- **CONFIG_VERSION** bumped from 21 to 22 with seamless migration.
- New `DigestConfig` section (7 typed fields): `enabled`, `autoDismissSec` (4–30s, default 9), and five per-section toggles (`showBond`, `showStats`, `showMood`, `showGrowth`, `showHighlight`).
- New `showDigest` hotkey in `HotkeysConfig` (default: `Alt+Shift+I`).
- Migration v21 → v22 adds the `digest` section and the `showDigest` hotkey to existing configs.
- All new fields have defaults, validation, and clamping in `clampConfig`.

### Settings UI
- **Companion Digest section in the Stats tab**: A full settings panel with an explanatory intro, master enable toggle, auto-dismiss slider (4–30s), and five per-section switches. Includes a per-section reset-to-defaults. Placed in the Stats tab (rather than a new tab) to keep the settings sidebar count stable and because the digest is fundamentally a stats-aggregation feature.
- **Hotkeys tab**: "Show Companion Digest" hotkey label and description added.

### Reliability
- **Flaky test fixed**: `BehaviorEngine — forceState transitions state and resets timer` was non-deterministic — `engine.update(5, ...)` exceeded `idle_float`'s 2.0s min duration, and `evaluateTransition` has a `Math.random()`-gated wander transition that fired ~25% of the time, resetting the timer to 0 and failing the assertion. Changed to `engine.update(1, ...)` (below the min duration) so no transition can fire, making the test deterministic while preserving its intent.
- **Digest render moved outside the milestone `if` block**: The digest card renders every frame while active, regardless of whether the milestone engine is enabled — unlike the screenshot/profile/capture toasts which (as a pre-existing quirk) only render when milestones are enabled.

### Privacy
- The digest is computed entirely locally from existing in-memory engine state and localStorage. No new data is collected, stored, or transmitted. It reads bond points, stats counters, surface mood, growth stage, milestone count, and recent journal entries — all of which already exist and are local-only.

### Version & Tests
- Version bumped to **8.2.0** across `package.json`, `Cargo.toml`, `tauri.conf.json`, and `version.ts`.
- **22 new unit tests** for `digestEngine` (aggregation, per-section toggles, highlight selection, purity, summary composition).
- **1 test fixed** (flaky behaviorEngine forceState).
- **1 test updated** (phase5Integration config field count: 50 → 51, plus `digest` containment check).
- **1005 tests across 53 test files**, all passing.
- **13 Rust tests**, all passing, zero warnings.

---

## What's New in 8.1.0 (Streamer-Safe Capture)

### Multi-Entity Overlay Masking (Bug Fix)
- **All entities now masked from self-detection**: Previously, only the founder entity's bounding box was sent to the Rust motion analyzer as a "do not detect" mask. Family siblings (up to 10 additional entities) were rendered on the overlay but their pixels were not masked — meaning Kovy's own motion analyzer would detect siblings as motion targets, creating a self-detection feedback loop where entities chased each other's rendered bodies.
- **`setOverlayMasks` (plural)**: The backend command `set_overlay_mask` (single rect) has been replaced with `set_overlay_masks` (array of rects). The `CaptureManager` now stores `Vec<OverlayMaskRect>` and zeroes out diff inside every entity's bounding box each frame.
- **`computeEntityMaskRects` pure helper**: The mask rect computation has been extracted from `KovyRenderer` into a testable pure function in `overlayMaskUtils.ts`. It iterates all visible entities (founder + siblings), applies size-scaled padding, and returns one rect per entity.
- **Throttled IPC with stable key**: A `maskRectsKey()` function produces a deterministic string from the rect set, so IPC is skipped entirely when no entity has moved meaningfully — unchanged from the single-entity version but now covers all entities.
- **PrivacyTab text corrected**: The UI previously warned that "family siblings are not masked, so minor self-detection can still occur." This is no longer true — all entities are masked.

### OBS / Capture-App Auto-Hide
- **Automatic detection**: New `capture_apps.rs` Rust module enumerates running processes via the Windows Toolhelp32 snapshot API and checks for known screen-capture / streaming applications: OBS Studio (`obs64`, `obs32`), Streamlabs Desktop, PRISM Live Studio, XSplit Broadcaster/Core, vMix, Bandicam, Fraps, Action!, ShareX, Dxtory, and more. Only process image names are inspected — no window content is read.
- **`detect_capture_apps` Tauri command**: Returns `{ running: boolean, matched: string[] }` to the frontend.
- **`CaptureAppAutoHideRunner`**: A new runner (modeled after `ProfileAutoSwitchRunner`) polls the detector every 5 seconds. When `privacy.autoHideOnCaptureApp` is enabled and a capture app appears, it saves the user's current `hideFromCapture` preference, forces it to `true` (WDA_EXCLUDEFROMCAPTURE), and dispatches a `kovy-capture-app-detected` toast event. When all capture apps exit, it restores the saved preference and dispatches `kovy-capture-app-cleared`.
- **Pure `shouldHide` decision function**: The override state machine is extracted as a pure function for unit testing — handles begin-override, stay-hidden, end-override, and re-assert cases.
- **Re-assertion guard**: If the user (or another code path) turns hiding back off while a capture app is still running and the runner is overriding, the next tick re-asserts `hideFromCapture = true`.
- **Graceful teardown**: `destroy()` restores the saved preference if the runner is still overriding at shutdown, so the user's config isn't left in a forced-hidden state.
- **`setHideFromCaptureRuntime` store method**: A new `configStore` method updates `appliedConfig.privacy.hideFromCapture`, persists the config, emits an apply event, and syncs the backend — without requiring the user to click "Apply" in settings.

### Capture-App Toast
- **Amber-accented toast**: New `captureAppToast.ts` renders a canvas toast (below the profile-switch toast) when a capture app is detected or cleared. Shows "🔴 Capture App Detected — Hiding from obs64" or "🟢 Capture Cleared — Restored" with a 4.5-second fade.
- **Event-wired**: `KovyRenderer` listens for `kovy-capture-app-detected` and `kovy-capture-app-cleared` custom events and draws the toast in the render loop.

### Config System
- **CONFIG_VERSION** bumped from 20 to 21 with seamless migration.
- New `privacy.autoHideOnCaptureApp` boolean field (default `false`).
- Migration v20 → v21 adds the field to existing configs.

### Privacy UI
- **New toggle**: "Auto-hide when OBS / streaming apps detected" in the Privacy tab, with a description explaining the process-name-only inspection.
- **Updated info card**: The "Visible to OBS" explanation now correctly states that all entities (founder + siblings) are masked, removing the outdated self-detection warning.

### Version & Tests
- Version bumped to **8.1.0** across `package.json`, `Cargo.toml`, `tauri.conf.json`, and `version.ts`.
- **26 new unit tests** (10 multi-entity mask computation + 16 capture-app auto-hide runner).
- **3 new Rust tests** for capture-app process name matching.
- **983 tests across 52 test files**, all passing.
- **16 Rust tests**, all passing.

---

## What's New in 8.0.1 (Adaptive Muse Marks)

### Muse Adaptive Mark Selection
- **Intelligent mark picking**: Muse no longer picks overlay marks uniformly at random. When `adaptiveSelection` is enabled, it chooses marks using a weighted model that considers:
  - **Recency penalty**: recently used mark types are deprioritized to avoid visual repetition.
  - **Mood bias**: the current Kovy surface mood gently favors marks that visually match it (e.g., `ring_burst` and `wave` for playful, `dot` and `mood_wash` for calm).
  - **Confidence shaping**: high app-classifier confidence leans into emblematic mode marks (e.g., `bracket` / `circuit` for code, `stroke` / `note_anchor` for writing); low confidence flattens the distribution for more variety.
- **Recent mark history**: `MuseEngine` tracks the last 8 spawned mark types and feeds them into each new selection, producing more coherent and less repetitive overlay sequences.
- **New `getRecentMarkTypes()` API**: exposes the internal recency ring for diagnostics and testing.

### Muse Settings UI
- **New toggle**: `Adaptive Mark Selection` switch in the Muse tab, surfacing the existing `muse.adaptiveSelection` config field.
- On-by-default: existing users already have `adaptiveSelection: true` in their config; the engine now actually honors it.

### Version & Tests
- Version bumped to **8.0.1** across `package.json`, `Cargo.toml`, `tauri.conf.json`, and `version.ts`.
- **3 new unit tests** for adaptive mark selection and recent-mark tracking.
- **904 tests across 47 test files**, all passing (target).

---

## What's New in 8.0.0 (Ask Kovy AI)

### Ask Kovy — AI-Powered Insights
- **Global hotkey** (`Alt+Shift+A` by default): Trigger an immediate AI observation of your current screen context. Kovy thinks about what it sees and responds with a contextual thought bubble and whisper.
- **Tray menu item**: "Ask Kovy" in the system tray menu for mouse-only access.
- **Immediate "thinking..." feedback**: A thought bubble appears instantly when an AI request is triggered, so Kovy never feels unresponsive.
- **Force-spawned thoughts and whispers**: AI-generated content bypasses normal spawning logic via `ThoughtEngine.spawnCustom()` and `WhisperEngine.spawnCustom()`, appearing immediately at Kovy's current position.
- **Structured JSON responses**: The AI returns a thought (first-person, curious), a whisper (encouraging/humorous/factual/comforting message to the user), a category, and a confidence score — all validated against a JSON schema.

### OpenRouter Integration (Rust Backend)
- **`ai.rs` module**: Full OpenRouter chat completions transport with structured `json_schema` response format, system prompt engineering (Kovy personality, privacy rules, character constraints), and configurable model selection (default: `openrouter/auto`).
- **Screenshot capture**: When consented, captures the primary monitor via `xcap`, resizes to configurable max width (320–1920px), JPEG-compresses at configurable quality (40–90%), and sends as base64 data URL. Screenshots are never stored locally or logged.
- **Error handling**: 10 typed error codes (`capture-failed`, `credential-unavailable`, `network`, `timeout`, `unauthorized`, `rate-limited`, `provider-error`, `invalid-response`, `unsupported-model`, `cancelled`) mapped to frontend `AIErrorCode` type.
- **5 Tauri commands**: `ai_store_api_key`, `ai_load_api_key`, `ai_delete_api_key`, `ai_has_api_key`, `ai_request`.
- **10 Rust unit tests**: System prompt validation, user prompt construction, response schema validation, insight JSON deserialization, error display formatting.

### Secure Credential Vault
- **Windows Credential Manager**: API keys stored in the OS credential vault (`KovyAIKey` target name), never in config files, localStorage, or plaintext.
- **Defense-in-depth privacy**: The `include_foreground_app` flag is enforced in both the TypeScript frontend (gates `getForegroundApp()` call) and the Rust backend (strips foreground info before prompt construction), ensuring foreground app data is never sent even if the flag is bypassed.
- **Settings UI**: API key management with show/hide toggle, save confirmation, stored status indicator, and one-click removal.

### AI Request Coordinator (TypeScript)
- **Concurrency control**: Only one AI request in flight at a time; concurrent triggers return `busy` rejection.
- **Cooldown enforcement**: Configurable cooldown (1–60s, default 5s) for Ask Kovy triggers to prevent spam.
- **Periodic scheduling**: Optional automatic AI insights at configurable intervals (30s–3600s), with priority weighting over procedural thoughts.
- **Cancellation support**: In-flight requests can be cancelled via `AbortController`; coordinator cleans up state and fires `onThinking(false)`.
- **Callback-based architecture**: `onInsight`, `onThinking`, and `onError` callbacks drive UI updates through custom DOM events.
- **14 unit tests**: Concurrency, cooldown, busy rejection, disabled rejection, missing-key rejection, isBusy, cancelPending, callback firing (onThinking, onInsight, onError), periodic timer behavior.

### AI Settings Tab
- **Privacy-first UX**: Full settings tab in Settings app (advanced mode only) with:
  - API key management (show/hide, save, delete, stored status)
  - Model identifier input (default: `openrouter/auto`)
  - Screenshot consent toggle with privacy info card
  - Screenshot max width and JPEG quality sliders (only visible when screenshots enabled)
  - Foreground app info toggle
  - Insta-send cooldown, request timeout, max thought/whisper length sliders
  - Periodic insights toggle with interval and priority sliders
  - Privacy guarantees info card (5 guarantees listed)
- **Hotkeys tab**: "Ask Kovy" hotkey label and description added.

### Config System
- **CONFIG_VERSION** bumped from 15 to 16 with seamless migration.
- New `AIConfig` section: 14 typed fields with defaults, validation, and clamping.
- New `askKovy` hotkey in `HotkeysConfig` (default: `Alt+Shift+A`).

### Version & Tests
- Version bumped to 8.0.0 across `package.json`, `Cargo.toml`, and `version.ts`.
- **903 tests across 47 test files**, all passing.
- **10 Rust tests**, all passing, zero warnings.

---

## What's New in 7.2 (Focus & Lite Mode)

### Focus Target Engine
- **Window/cursor attraction**: Kovy is gently drawn toward the active window center and cursor position, with configurable attraction strengths (0–1).
- **Gaming mode boost**: Separate boost values for window and cursor attraction when gaming mode is active.
- **Habitat softening**: Reduces habitat zone influence during gaming mode so Kovy prioritizes window/cursor targets.
- **Blend factor**: Controls how much focus attraction blends with the normal target position.
- **Integrated into behavior engine**: Focus attraction applied as a post-processing step on target positions in `BehaviorEngine`.

### Lite Settings App
- **Simplified settings**: 5-tab Lite settings UI (Personality, Look, Sound, Presets, Companion) for users who want quick control without the full 29-tab Pro settings.
- **Lite/Pro mode toggle**: Hotkey `Alt+Shift+L` or tray menu item to switch between Lite and Pro settings.
- **Shadow config**: Pre-Lite settings stored in `shadowConfig` for seamless restoration when switching back to Pro.
- **Lite presets**: Curated bundles (companion, work_buddy, sleepy_pet) for one-click personality setup.
- **Lite mode filtering**: 21 advanced sections hidden in Lite mode via `settingsViewMode.ts`.

### Command Palette Framework
- **Command registry**: Shared command registry with fuzzy search, recent commands, and category grouping.
- **Overlay command palette**: Searchable command palette UI in the overlay window (framework ready for command registration).

### Engine Error Boundary
- **`engineErrorBoundary.ts`**: Wraps engine initialization and update calls to catch and report errors without crashing the render loop.

### Config System
- **CONFIG_VERSION** bumped from 14 to 15 with seamless migration.
- New `FocusTargetConfig` section: 7 typed fields with defaults, validation, and clamping.

---

## What's New in 7.1 (Inner World)

### Dream Engine
- **Dream particles**: When Kovy enters dream or nap states, floating dream particles (stars, moons, clouds, fish, butterflies, and more) drift upward from Kovy's position.
- **Color wash**: A subtle color wash shifts Kovy's glow hue during dreams.
- **Dream thoughts**: Dream-specific thought bubbles appear with whimsical content like "flying over mountains..." or "chasing a giant butterfly..."
- **Configurable**: Particle density (0–1), thought frequency (0–1), color wash toggle, max particles (5–20).

### Expanded Thought Bubbles
- **200+ unique thoughts**: Thought pools expanded from ~40 to 200+ across 8 new context categories:
  - Time of day (morning, midday, afternoon, evening, late night)
  - Bond level (stranger → best friend)
  - Growth stage (sprout → elder)
  - Seasonal (spring, summer, autumn, winter)
  - App context (coding, writing, gaming, browsing, music, design, video)
  - Focus state (light focus, deep focus)
  - Expanded weather thoughts
  - Recent history tracking prevents repeats

### Profile Auto-Switch Rules
- **Rule-based profile switching**: Automatically switch between saved config profiles based on:
  - Time of day (e.g., switch to Focus profile at 9:00 AM)
  - Active app (e.g., switch to Gaming profile when a game launches)
  - Idle duration (e.g., switch to Cozy profile after 10 minutes idle)
- **`profileAutoSwitchEngine.ts`**: Pure-function rule evaluation engine with `evaluateAutoSwitchRules()` and `createAutoSwitchRule()`.
- **`profileAutoSwitchRunner.ts`** (v8.1): Live runner that polls system context (time, foreground app, idle seconds) every 10 seconds, evaluates rules, and triggers profile switches via `configStore.importConfig()`. Dispatches `kovy-profile-auto-switch` custom events for toast notifications and stats recording.
- **Configurable**: Rules array in `ProfilesConfig`, each with id, type, condition, profileId, and enabled flag.
- **UI**: Full rule editor in ProfilesTab (Pro settings) — create, edit, delete, toggle rules with type-specific condition editors (time picker, app name field, idle seconds input).
- **Toast notifications**: Canvas-rendered toast appears on auto-switch with profile name, icon, and reason.

### Habitat Presets
- **Saveable habitat layouts**: Store and restore habitat object configurations as named presets.
- **`habitatPresets` array** in `HabitatObjectsConfig` for preset management.

### Config System
- **CONFIG_VERSION** bumped from 12 to 13 with seamless migration.
- New `DreamConfig` section: 5 typed fields with defaults, validation, and clamping.
- New `autoSwitchRules` array in `ProfilesConfig`.
- New `habitatPresets` array in `HabitatObjectsConfig`.

---

## What's New in 7.0.3 (Enhancement Pass)

### Reliability
- `BehaviorEngine.forceState()` now calls `onStateExit`/`onStateEnter` lifecycle hooks, preventing silent state initialization bugs. Accepts optional `BehaviorContext` for context-aware enter logic (e.g., startle recoil direction).
- Async callbacks in the render loop (idle engine, memory init, app profile detection, monitor geometry loading) now guard against component unmount via `mountedRef`, preventing post-unmount state writes.
- Added `getState()` and `getStateTimer()` getters to `BehaviorEngine` for testability.

### Performance
- Canvas `resize` handler now throttled via `requestAnimationFrame` coalescing, eliminating excessive canvas reallocations during rapid window resizing.

### Code Health
- Removed dead `"scattered"` scene type variant from `FamilyScenesEngine` (was in union but never used).
- Eliminated 10 `as any` casts in `KovyRenderer.tsx` by properly typing `frameState` fields (`prevBehaviorState: BehaviorState`, `prevSurfaceMood: SurfaceMood`, `prevBondLevel: BondLevel | ""`, `prevGrowthStage: GrowthStage | ""`) and sibling `prevState: BehaviorState`.
- Typed `burstType` as union literal instead of `string` to match `BurstType` signature.

### Engine Interconnects (Phase 2)
- All 41 engine outputs now wired into rendering and behavior logic.
- `relationsOutput.relations` modulates family scene selection (rivals prefer chase/play_fight, friends prefer cuddle/grooming).
- Family engine relation lookups optimized from O(n) `.find()` to O(1) `Map.get()` via pre-built `relMap`.
- Drag handling extracted into pure `resolveDragAction()` function for testability.
- Personality evolution, focus mood, social energy, predicted points, combo count, and seasonal mood all wired into respective engines.

### Version & Tests
- **890 tests across 46 test files**, all passing.
- CONFIG_VERSION 12.

---

## What's New in 7.0.2 (Integrity Pass)

### StatsEngine Wiring Complete
- All record methods (`recordPoke`, `recordHover`, `recordSwipe`, `recordGamingSession`, `recordEmote`, `recordRitual`, `recordWeatherChange`, `recordProfileSwitch`) now properly increment counters and persist. Previously several were no-ops.
- All stat increments gated by `config.stats.enabled`.
- Profile switch stats tracked via custom `kovy-profile-switch` event.

### Audio Reactivity Fixes
- Comments clarified: input is **microphone only** via Web Audio API AnalyserNode (no system audio capture).
- `feedMood` config flag now gates whether audio energy influences mood stimuli.
- `feedGaming` config flag now gates whether beat detection boosts gaming excitement.
- `feedVisualizer` + `visualizerStyle !== "none"` now gate visualizer bar rendering.
- MediaStream tracks are now properly stopped on dispose.

### Sound Category Toggles Wired
- `emoteSounds`, `celebrationSounds`, `focusSounds`, `familySounds` now gate `onBehaviorChange` calls in the renderer.
- Founder behavior sounds gated by emote/celebration/focus toggles based on behavior state context.
- Sibling behavior sounds gated by `familySounds`.

### Idle Bridge Fix
- `getIdleSeconds` now returns `null` on failure instead of `0`, enabling the motion-based fallback in `IdleEngine` to actually activate when Tauri is unavailable.

### Profile Source of Truth
- `ProfilesEngine.update()` no longer overwrites engine profiles with empty config every 5s, fixing split-brain where seeded defaults were wiped.

### Settings Integrity
- `emote` and `memory` tabs added to `SETTINGS_SECTIONS` (were missing, causing them to be invisible in simple mode).
- 27 settings tabs, all reachable in advanced mode.

### Version & Tests
- Version bumped to 7.0.2 across all files.
- **803 tests across 42 test files**, all passing.

---

## What's New in 7.0.1 (Polish Pass)

### Personality Coherence
- **Personality-tinted thoughts**: each behavior preset (chill, curious, goblin, hyper, focus) has dedicated thought pools that influence what Kovy thinks about.
- **Personality-weighted whispers**: whisper category selection (encouragement, humor, facts, comfort) is biased by personality — goblin leans humor, curious leans facts, chill leans comfort.
- **Personality-flavored celebrations**: focus milestones, return celebrations, and weekend events use personality-specific message variants.

### Creature Physicality
- **Mood-based posture**: Kovy's body droops when sad/shy/overwhelmed, perks up when excited/playful. Applied as Y-offset and vertical scale modifier. Works in both normal and reduced-motion render paths.
- **Attention-seeking wiggle**: after 30+ seconds of idle, Kovy starts a subtle horizontal wiggle that ramps up to full intensity at 60 seconds, then resets on any behavior change.
- **Sibling posture**: family entities also get mood-based posture changes.

### Weather-Influenced Thoughts
- **Weather thought pool**: 8 weather types (rain, storm, snow, fog, aurora, clear, cloudy, wind) each have themed thoughts that mix into the thought selection pool.

### Default Profiles
- **6 built-in profiles**: Default, Focus, Streaming, Gaming, Low Power, Cozy — each with tuned config overrides for their use case. Seeded automatically on first launch.
- **Profile seeding**: ProfilesEngine seeds defaults when empty, in both renderer and settings UI.

### Stream-Safe Mode
- **General setting**: stream-safe toggle suppresses emotes, sounds, and particle bursts for streaming/screen-sharing scenarios.

### Per-Category Sound Toggles
- **5 new audio toggles**: emote, whisper, celebration, focus, and family sounds can be individually enabled/disabled in the Audio tab.

### Settings & Onboarding
- **Simple/Advanced mode toggle**: filter settings tabs by complexity. Simple mode shows 15 essential sections; Advanced shows all 27.
- **Onboarding rewrite**: v7 features (thoughts, whispers, focus, growth, drag, profiles), updated privacy info (opt-in weather), new hotkeys.

### Performance
- **Verified**: listener cleanup, timer disposal, FPS capping with frame skipping, low-power idle mode (halved FPS when idle/perched/napping), no per-frame waste.

---

## What's New in 7.0 (Universal Expansion)

### 14 New Engines
- **Audio Reactivity Engine**: Web Audio API beat detection and energy analysis with configurable sensitivity and visualizer styles (bars, wave, pulse, none).
- **Thought Bubbles Engine**: spawns contextual thought bubbles above entities based on mood, behavior, time of day, and active app class.
- **Seasonal Events Engine**: calendar-aware detection of holidays (Halloween, Christmas, New Year, Valentine's, etc.) with atmosphere particle sync and behavior biases.
- **Growth/Aging Engine**: tracks Kovy's age based on active time with growth stages (sprout, young, mature, elder) and gradual visual changes.
- **Stats Tracking Engine**: tracks interactions, focus minutes, gaming sessions, emotes, thoughts, and more. Exportable as JSON. Settings UI: Stats tab.
- **Focus Mode Engine**: detects sustained user focus (low motion + consistent app) and suppresses emotes/sound, dims glow, emits calming particles.
- **Idle Detection Engine**: detects user absence via Tauri idle timer or motion fallback, triggers idle behaviors (explore, play alone, nap, dream).
- **Personality Evolution Engine**: slowly shifts Kovy's personality offsets based on interaction patterns and mood history over time.
- **Celebration Engine**: triggers celebration events for focus milestones, return celebrations, and weekend arrivals.
- **Ambient Sound Engine**: procedurally generated ambient soundscapes (rain, ocean, forest, café) synced with weather, using Web Audio API.
- **Whisper Engine**: occasional text overlays with encouraging, humorous, factual, or comforting messages directed at the user.
- **Entity Relations Engine**: manages relationships between family entities (friend, rival, mentor, playmate) with auto-evolution.
- **Drag Interaction Engine**: grab and drag Kovy with remembered favorite spots and release behaviors (bounce, settle, celebrate).
- **Config Profiles Engine**: save, load, and switch between named configuration presets with hotkey cycling support. Settings UI: Profiles tab.

### 20 Existing Engine Enhancements
- **Mood Engine**: 4 new surface moods (content, anxious, nostalgic, determined) + smooth HSL color interpolation via `MoodColorInterpolator`.
- **Behavior Engine**: 5 new behavior states (dance, hide, play_dead, investigate, meditate).
- **Bond System**: bond level milestone VFX (heart burst, rainbow trail, golden aura, star constellation) on level-up.
- **Gaming Engine**: combo system with consecutive high-motion targets boosting excitement, plus 2 new visual styles (neon, retro).
- **Emote System**: 6 new emote types (music, fire, moon, sun, rainbow, lightning) triggered by audio, circadian, and weather events.
- **Atmosphere Engine**: 3 new particle shapes (geometric, floral, crystalline) + seasonal particle sync.
- **Weather Engine**: 3 new weather types (hail, sleet, wind) + optional real weather sync via wttr.in.
- **Skin Packs**: 4 new built-in packs (neon, pastel, dark, rainbow) + circadian auto-switch.
- **Sound Packs**: 3 new built-in packs (lofi, ambient, retro_arcade).
- **Rituals**: 4 new rituals (coffee_break, sunset_reflection, late_night_snack, first_snow) + configurable ritual times.
- **Journal**: search by text/mood/type/date range, JSON export, mood timeline data generation.
- **Milestones**: 15 new milestones across 9 new categories (audio, thoughts, seasonal, growth, focus, idle, drag, stats, profiles).
- **Family Engine**: inter-entity bonds and group emotes.
- **Habitat**: 3 new zone types (water, garden, sky) + habitat templates.
- **App Profiles**: mood and behavior overrides per app.
- **Circadian Engine**: custom day/night schedule support.
- **Interaction Engine**: double-click and right-click detection.
- **Muse Engine**: 3 new mark types (underline, highlight, margin_note) + adaptive selection.
- **Memory Engine**: `getMemoryTimeline()` for visualization data.
- **Performance**: adaptive quality and CPU budget enforcement.

### UI/UX Additions
- **Stats Dashboard Tab**: visual stats display with tracking level selector and JSON export.
- **Config Profile Manager Tab**: save, load, delete, and switch config presets with icon picker.
- **Enhanced Settings Search**: fuzzy matching for tab search.
- **New hotkeys**: toggleDrag, toggleFocus, switchProfile.

### Rust Backend
- SQLite migration v2 with 9 new tables (stats, growth_state, entity_relations, thought_log, whisper_log, idle_events, focus_sessions, drag_spots, saved_profiles).
- New Tauri commands: `get_idle_seconds`, `reset_idle_timer`, `fetch_weather`.
- Version bumped to 7.0.2.

### Config Version
- CONFIG_VERSION bumped from 11 to 12 with seamless migration.
- All new config sections have types, defaults, validation, and clamping.

---

## Previous Versions

- **v8.3.0**: Companion Chronicle (daily snapshot persistence, trend computation, insight generation, sparkline + insights overlay card, chronicle runner, CONFIG_VERSION 23).
- **v8.2.0**: Companion Digest (on-demand relationship summary card aggregating bond, stats, mood, growth, journal; digest engine, digest toast, three trigger paths, CONFIG_VERSION 22).
- **v8.1.0**: Multi-entity overlay masking (all entities masked from self-detection), OBS/capture-app auto-hide runner with process-name detection, capture-app toast, CONFIG_VERSION 21.
- **v8.0.1**: Muse adaptive mark selection (recency penalty, mood bias, confidence shaping), recent mark history, Muse settings toggle.
- **v8.0.0**: Ask Kovy AI (OpenRouter, secure credential vault, screenshot consent, periodic insights), AI coordinator, AI settings tab, CONFIG_VERSION 16.
- **v7.2**: Focus target engine (window/cursor attraction), Lite settings app (5 tabs), command palette framework, engine error boundary, CONFIG_VERSION 15.
- **v7.1**: Dream engine (particles, color wash, dream thoughts), 200+ expanded thought bubbles across 8 categories, profile auto-switch rules (time/app/idle), habitat presets, CONFIG_VERSION 13.
- **v7.0.1**: Personality-tinted thoughts/whispers/celebrations, mood-based posture, attention-seeking wiggle, weather thought pool, 6 default profiles, stream-safe mode, per-category sound toggles, simple/advanced settings toggle, onboarding rewrite.
- **v7.0**: 14 new engines (audio reactivity, thoughts, seasonal, growth, stats, focus, idle, personality evolution, celebration, ambient sound, whisper, entity relations, drag, profiles). 20 existing engine enhancements. CONFIG_VERSION 12. 27 settings tabs.
- **v6.1**: 8 orphaned engines wired (ritual, journal, weather, skin/sound packs, family scenes, app profiles, habitat objects). Bond warmth aura, return celebration, particle budget fix. CONFIG_VERSION 11.
- **v5.7**: Bond & relationship system (5 levels, poke/hover/swipe detection, daily streaks, decay). Expressive idles (stretch, look_around, yawn). Visual tear drops. CONFIG_VERSION 9.
- **v5.6**: Audio expansion (sound catalog, frequency controls, per-sound toggles). Multi-monitor fix. Scenario presets. Per-entity colors. CONFIG_VERSION 8.
- **v5.5**: Gaming mode (kinetic adaptive layer, prediction, excitement, residue, elastic deformation). CONFIG_VERSION 7.
- **v4.0**: Memory Palace (SQLite), Kovy Family (multi-entity), Muse Mode v1, soul export, config migration v4.
- **v3.6.1**: Monitor coherence, UI sounds, habitat editor upgrade, rail influence, settings honesty cleanup.
- **v3.6**: Motion payload fix, stale clearing, habitat editor, rail wander, startMinimized.
- **v3.5**: Debug overlays, salience graph, audio engine, diagnostics, habitat overlay, current monitor tracking, custom window chrome.

## Architecture

### Stack
- **Desktop shell**: Tauri v2 (Rust backend + webview frontend)
- **Native layer**: Rust — screen capture (`xcap`), stable motion tracking, foreground app detection, system tray, hotkeys, AI service (OpenRouter), credential vault (Windows Credential Manager)
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom CosmoTech design tokens
- **State**: Zustand (config store + runtime store + entity store for multi-Kovy)
- **Database**: SQLite via `tauri-plugin-sql` for Memory Palace (local-only)
- **Rendering**: HTML5 Canvas procedural renderer (no external art assets)
- **AI**: OpenRouter chat completions API (opt-in only, user-supplied API key)
- **Config**: Tauri plugin-store (native JSON persistence) with localStorage fallback, deep merge, and schema validation

### Key Architecture Decisions
- **Two windows**: Overlay (transparent, always-on-top, click-through) + Settings (standard decorated window, with Lite and Pro modes)
- **Motion analysis in Rust**: Screen capture and frame differencing run in a background thread, emitting results to the frontend via Tauri events
- **One shared rAF loop**: All entities share a single `requestAnimationFrame` loop — no separate loops per entity
- **All engines in TypeScript**: 49+ engines run in the overlay's animation loop, managed by `engineManager.ts`
- **AI requests through Rust**: All AI network traffic goes through the Rust backend (`ai.rs`), never from the renderer. API keys stored in OS credential vault, never accessible to frontend JavaScript.
- **Multi-entity via entity store**: `entityStore.ts` manages N entity states. `kovyStore.ts` remains the founder compatibility bridge (one-way sync, one-frame lag — documented technical debt)
- **Heuristic app detection**: Muse uses process name matching against hardcoded app sets — no OCR, no LLM, no screen parsing (AI feature is separate and opt-in)
- **Procedural character**: Kovy is rendered entirely with Canvas 2D — body, eyes, glow, particles, shadow — no sprite sheets
- **Privacy-first**: Zero frames retained, no cloud calls by default, no keystroke/clipboard access. Memory stored in local SQLite only. AI is opt-in only with explicit screenshot consent. Soul export is plaintext JSON (not encrypted)

### Project Structure

```
Kovy/
│   ├── package.json              # Node dependencies + scripts (v8.0.0)
├── vite.config.ts            # Multi-entry Vite config (settings + overlay)
├── tailwind.config.js        # Custom Kovy design tokens
├── tsconfig.json             # TypeScript config
├── index.html                # Settings window entry
├── overlay.html              # Overlay window entry
├── src/
│   ├── main.tsx              # Settings window React entry (routes Lite vs Pro)
│   ├── overlay-main.tsx      # Overlay window React entry
│   ├── index.css             # Tailwind + custom component styles
│   ├── lib/
│   │   ├── utils.ts          # Math utilities (lerp, clamp, spring, distance, kovyLog)
│   │   ├── tauriBridge.ts    # Typed Tauri commands, events, hotkeys, AI bridge
│   │   ├── configSyncBus.ts  # Typed cross-window config sync bus (preview/apply/revert)
│   │   ├── memoryDb.ts       # SQLite wrapper for Memory Palace (v4.0)
│   │   ├── soulExport.ts     # Soul export/import — plaintext JSON, v2 schema
│   │   ├── commandRegistry.ts # Shared command registry for command palette (v7.2)
│   │   ├── storageAdapter.ts # Unified Tauri store / localStorage interface
│   │   ├── colorUtils.ts     # Color space conversions
│   │   ├── monitorUtils.ts   # Monitor geometry helpers
│   │   ├── stateCard.ts      # State display cards
│   │   └── version.ts        # Single source of truth for version string
│   ├── store/
│   │   ├── types.ts              # All TypeScript types + config schema (CONFIG_VERSION=23)
│   │   ├── defaults.ts           # Default values + behavior/visual presets
│   │   ├── configStore.ts        # Zustand persistent config store (Tauri plugin-store)
│   │   ├── configValidation.ts   # Deep merge, validation, schema clamping
│   │   ├── migrationRegistry.ts  # Migration ladder v1→v23
│   │   ├── kovyStore.ts          # Zustand founder runtime state (bridges to entityStore)
│   │   ├── entityStore.ts        # Multi-entity state store (v4.0)
│   │   ├── scenarioPresets.ts    # Multi-section config patches (calm, extreme, low_pc)
│   │   └── litePresets.ts        # Curated bundles for Lite mode
│   ├── engine/                    # 46+ engine files
│   │   ├── moodEngine.ts         # Continuous mood state + surface mood derivation
│   │   ├── behaviorEngine.ts     # Behavior state machine with family + focus target influence
│   │   ├── motionInterest.ts     # Motion region scoring with hysteresis
│   │   ├── movementController.ts # Damped spring movement + squash/stretch + lean + landing
│   │   ├── audioEngine.ts        # Web Audio API chirps with per-entity cooldowns
│   │   ├── diagnosticsEngine.ts  # Local-only diagnostics with entity tracking
│   │   ├── ocrEngine.ts          # Lightweight text-likeness detection heuristic
│   │   ├── railHelper.ts         # Rail interpolation and projection utilities
│   │   ├── memoryEngine.ts       # Memory write/read/prune/influence pipeline (v4.0)
│   │   ├── familyEngine.ts       # Inter-entity dynamics engine (v4.0)
│   │   ├── museEngine.ts         # Heuristic app-class detection + overlay generation (v4.0)
│   │   ├── gamingEngine.ts       # Kinetic adaptive salience, prediction, excitement (v4.5)
│   │   ├── emoteEngine.ts        # Mood/behavior-driven emote particle spawning (v5.5)
│   │   ├── atmosphereEngine.ts   # Circadian-driven ambient particle generation (v5.5)
│   │   ├── bondEngine.ts         # Relationship tracking, level derivation, persistence (v5.7)
│   │   ├── interactionEngine.ts  # Proximity-based poke/hover/swipe detection (v5.7)
│   │   ├── milestoneEngine.ts    # Achievement tracking with 30+ milestones (v6.0)
│   │   ├── ritualEngine.ts       # Daily ritual tracking with time windows and streaks (v6.1)
│   │   ├── journalEngine.ts      # Automatic journal entries (v6.1)
│   │   ├── weatherEngine.ts      # Procedural weather simulation with mood influence (v6.1)
│   │   ├── skinPackEngine.ts     # Visual theme presets (v6.1)
│   │   ├── soundPackEngine.ts    # Audio theme presets (v6.1)
│   │   ├── familyScenesEngine.ts # Coordinated multi-entity group behaviors (v6.1)
│   │   ├── appProfileEngine.ts   # Per-application behavior overrides (v6.1)
│   │   ├── habitatObjectsEngine.ts # Interactive decor objects (v6.1)
│   │   ├── habitatPresets.ts     # Saveable habitat layouts (v7.1)
│   │   ├── audioReactivityEngine.ts # Web Audio API beat detection (v7.0)
│   │   ├── thoughtEngine.ts      # Contextual thought bubble spawning + spawnCustom (v7.0)
│   │   ├── whisperEngine.ts      # Occasional text overlay messages + spawnCustom (v7.0)
│   │   ├── seasonalEngine.ts     # Calendar-aware holiday detection (v7.0)
│   │   ├── growthEngine.ts       # Age-based growth stages (v7.0)
│   │   ├── statsEngine.ts        # Interaction/event tracking (v7.0)
│   │   ├── focusEngine.ts        # Focus mode detection + suppression (v7.0)
│   │   ├── idleEngine.ts         # User absence detection + idle behaviors (v7.0)
│   │   ├── personalityEvolutionEngine.ts # Personality drift (v7.0)
│   │   ├── celebrationEngine.ts  # Celebration event triggers (v7.0)
│   │   ├── ambientSoundEngine.ts # Procedural ambient soundscapes (v7.0)
│   │   ├── entityRelationsEngine.ts # Inter-entity relationships (v7.0)
│   │   ├── dragEngine.ts         # Drag interaction with remembered spots (v7.0)
│   │   ├── profilesEngine.ts     # Config preset management (v7.0)
│   │   ├── profileAutoSwitchEngine.ts # Rule-based profile switching (v7.1)
│   │   ├── profileAutoSwitchRunner.ts # Live auto-switch runner — polls context, fires switches (v8.1)
│   │   ├── dreamEngine.ts        # Dream particles + dream thoughts (v7.1)
│   │   ├── aiCoordinator.ts      # AI request lifecycle manager (v8.0.0)
│   │   ├── digestEngine.ts       # Companion Digest aggregation engine (v8.2.0)
│   │   ├── chronicleEngine.ts    # Companion Chronicle trends + insights (v8.3.0)
│   │   ├── chronicleStorage.ts   # Chronicle localStorage snapshot store (v8.3.0)
│   │   ├── chronicleRunner.ts    # Daily snapshot scheduler (v8.3.0)
│   │   └── engineErrorBoundary.ts # Error boundary for engine init/update (v7.2)
│   ├── overlay/
│   │   ├── OverlayApp.tsx    # Overlay root + hotkeys + tray + AI coordinator (v8.0.0)
│   │   ├── KovyRenderer.tsx  # Animation loop + multi-entity + AI event listeners (v8.0.0)
│   │   ├── KovyCharacter.ts  # Procedural Canvas renderer
│   │   ├── engineManager.ts  # Engine container + initialization (v7.2)
│   │   ├── CommandPalette.tsx # Searchable command palette (v7.2)
│   │   ├── MuseOverlay.ts    # Muse mark renderer (8 mark types)
│   │   ├── GamingResidue.ts  # Fast-fade kinetic residue mark renderer
│   │   ├── EmoteRenderer.ts  # 12-symbol emote particle renderer
│   │   ├── AtmosphereRenderer.ts # 6-shape ambient particle renderer
│   │   ├── digestToast.ts    # Companion Digest canvas card (v8.2.0)
│   │   ├── chronicleToast.ts # Companion Chronicle trends canvas card (v8.3.0)
│   │   └── HabitatEditor.tsx # Overlay drag editor for habitat objects
│   ├── settings/
│   │   ├── SettingsApp.tsx    # Pro settings shell with 29 sidebar tabs (v8.0.0)
│   │   ├── LiteSettingsApp.tsx # Lite settings shell with 5 tabs (v7.2)
│   │   ├── settingsViewMode.ts # Simple/advanced section visibility
│   │   ├── Onboarding.tsx    # First-run onboarding flow
│   │   ├── components/       # Reusable setting controls (7 components)
│   │   └── tabs/             # 29 tab components + 5 lite tabs
│   │       ├── GeneralTab.tsx ... AdvancedTab.tsx  # Original 11 tabs
│   │       ├── MemoryTab.tsx     # Memory Palace settings
│   │       ├── FamilyTab.tsx     # Family management + dynamics
│   │       ├── MuseTab.tsx       # Muse Mode settings
│   │       ├── GamingTab.tsx     # Gaming Mode settings
│   │       ├── CircadianTab.tsx  # Circadian rhythm settings
│   │       ├── EmoteTab.tsx      # Emote particle settings
│   │       ├── AtmosphereTab.tsx # Atmosphere particle settings
│   │       ├── BondTab.tsx       # Bond & relationship settings
│   │       ├── MilestoneTab.tsx  # Milestone achievement settings
│   │       ├── RitualTab.tsx     # Daily ritual settings
│   │       ├── JournalTab.tsx    # Journal viewer with filtering and export
│   │       ├── SkinPackTab.tsx   # Visual theme preset selection
│   │       ├── SoundPackTab.tsx  # Audio theme preset selection
│   │       ├── AppProfileTab.tsx # Per-application behavior overrides
│   │       ├── HotkeysTab.tsx    # Hotkey configuration (incl. Ask Kovy)
│   │       ├── AITab.tsx         # AI settings: API key, model, privacy, periodic (v8.0.0)
│   │       └── lite/            # 5 Lite mode tab components (v7.2)
│   └── tests/                # 53 test files, 1005 tests
└── src-tauri/
    ├── Cargo.toml            # Rust dependencies (v8.0.0)
    ├── tauri.conf.json       # Tauri v2 app config
    ├── build.rs
    ├── capabilities/
    │   └── default.json      # Permission capabilities
    └── src/
        ├── main.rs           # Rust entry point
        ├── lib.rs            # App setup, tray, commands (incl. AI commands)
        ├── ai.rs             # AI service: OpenRouter, screenshots, credential vault (v8.0.0)
        ├── capture.rs        # Screen capture loop (xcap, downscale, tracking)
        ├── foreground.rs     # Windows API foreground app detection
        ├── motion.rs         # Reserved for future motion enhancements
        └── tray_setup.rs     # System tray menu (incl. Ask Kovy item)
```

## Prerequisites

- **Node.js** 18+
- **Rust** (via [rustup](https://rustup.rs/))
- **Tauri v2 CLI**: `npm install -g @tauri-apps/cli` or use `npx tauri`
- **Windows 10/11** with desktop composition enabled (for transparent overlay)
- **Visual Studio Build Tools** with C++ workload (required by Rust on Windows)

## Setup & Run

```bash
# 1. Install Node dependencies
npm install

# 2. Generate Tauri icons (use any 1024x1024 PNG as source)
#    Place a source icon at src-tauri/icons/icon.png
#    Then run: npx tauri icon src-tauri/icons/icon.png
#    Or create placeholder PNGs manually for dev.

# 3. Run in development mode
npm run tauri dev

# This starts both the Vite dev server and the Tauri Rust backend.
# The settings window opens (or stays hidden based on config).
# The overlay window appears as a transparent always-on-top layer.
```

## Build for Production

```bash
npm run tauri build
```

Output will be in `src-tauri/target/release/bundle/`.

## How It Works

### Motion Analysis Pipeline (Rust)
1. Capture primary monitor via `xcap` at configurable FPS (default: 4 fps)
2. Downscale to ~15% resolution (e.g., 1920×1080 → 288×162)
3. Convert to grayscale
4. Compute absolute frame difference vs. previous frame
5. Threshold to binary motion mask (configurable `motion_threshold`)
6. Divide into grid cells (8×8 px), count active motion pixels per cell
7. Connected-component labeling via flood fill on active cells
8. Extract region metrics: centroid, bounding box, area, energy
9. **Stable temporal tracking**: Match new regions to existing tracks using greedy nearest-centroid distance. Persistent track IDs survive across frames with age/missed-frame handling.
10. Emit tracked regions to frontend via Tauri event `motion-analysis` (always emits, even when empty, so frontend can clear stale targets)

### Motion Interest Scoring (TypeScript)
Each region is scored using weighted factors:
- **Motion energy** (0.25) — raw intensity
- **Region size** (0.15) — prefers medium, penalizes full-screen
- **Persistence** (0.20) — seen across multiple frames
- **Novelty** (0.20) — new regions score higher
- **Cursor proximity** (0.10) — boost near cursor
- Penalties for flicker noise and boring full-screen motion

Target locking uses hysteresis: minimum 1.5s hold time, 0.25 margin required to retarget, 0.8s cooldown after abandoning.

### Mood Engine
8 continuous internal variables (curiosity, comfort, stimulation, fatigue, overwhelm, trust, boredom, confidence) are updated each frame based on environmental stimuli. A weighted scoring system derives the surface mood (Calm, Curious, Playful, Focused, Sleepy, Excited, Overwhelmed, Shy). Each mood produces modifiers that affect speed, glow, particles, blink rate, wander radius, and motion sensitivity.

### Behavior Engine
State machine with 17 states: idle_float, wander, perch, inspect, orbit, follow_burst, nap, peek, celebrate, recover, stretch, look_around, yawn (standard), plus dash_inspect, burst_orbit, chain_seek, snap_perch (hyper mode only). Transitions are driven by target availability, mood, and randomized timing. Cursor avoidance pushes Kovy away from the mouse when configured. Hyper states use burst acceleration with cooldown and rate-limited chain targeting.

### Movement Controller
Damped spring physics with configurable stiffness and damping. Produces smooth, slightly physical movement with visible squash/stretch derived from velocity.

### Procedural Character Renderer
7-layer Canvas 2D rendering:
1. Shadow (ellipse with radial gradient)
2. Glow halo (mood-colored, pulsing)
3. Body (radial gradient sphere with mood color)
4. Eyes (white sclera, colored iris, tracking pupil, specular highlight, blink/lid system)
5. Specular highlight
6. Trail particles (velocity-driven, mood-colored, with lifetime decay)
7. Ambient motes (gentle orbiting particles)

## Privacy Statement

Kovy is **local-first by design**:
- **Zero telemetry, zero cloud sync, zero analytics**: no data is ever uploaded by default
- **AI is opt-in only** (v8.0.0): AI features are disabled by default. When enabled, the user must supply their own OpenRouter API key (stored in OS credential vault, never in config files). Screenshots are only sent when explicitly consented. All AI traffic goes through the Rust backend, never from the renderer.
- **Optional real weather sync** (opt-in): fetches weather data from wttr.in. Disabled by default.
- **Zero frame retention**: screen captures are processed and discarded in real-time. AI screenshots are sent directly to OpenRouter and never stored locally or logged.
- **No keystroke logging, no clipboard reading, no password inspection**
- **Memory Palace**: stores structured data (app sessions, mood patterns) in a local SQLite database. Window titles are NOT stored by default. Sensitive apps are excluded.
- **Muse Mode**: detects the foreground app's **process name only** via Windows API. Does not read screen content, OCR, or parse window contents.
- **Soul Export**: plaintext JSON file. **Not encrypted.** Contains personality data and memory summaries. Treat it like any personal data file.
- **Diagnostics**: opt-in only, local-only. Never includes screenshots, OCR text, cursor history, window titles, or app names.
- **Audio Reactivity** (v7.0): uses **microphone input only** via Web Audio API AnalyserNode. Audio data is processed in real-time and never recorded or stored. Disabled by default. No system audio capture (WASAPI).
- **AI screenshot privacy** (v8.0.0): When screenshot consent is enabled, screenshots are resized, JPEG-compressed, and sent directly to OpenRouter as base64. They are never written to disk, logged, or stored in any database. The `include_foreground_app` flag is enforced in both frontend and Rust backend (defense-in-depth).

### Data Storage Locations
- **Config**: Tauri plugin-store (native JSON in app data dir) with localStorage fallback
- **Memory Palace**: SQLite database in app data dir
- **Bond/Milestone/Stats**: localStorage in browser/WebView
- **AI API key**: Windows Credential Manager (OS credential vault, never in config or localStorage)
- **Soul Export**: user-chosen file path (JSON)

## Testing

```bash
npm test            # Run all 1005 tests once
npm run test:watch  # Watch mode
cargo test          # Run 13 Rust tests (from src-tauri/)
```

### Test Files (53)
- **behaviorEngine.test.ts**: Behavior state transitions, hyper mode, habitat integration, multi-entity family influence
- **configValidation.test.ts**: Deep merge, validation, clamping, v3→v4 migration, safe import
- **moodEngine.test.ts**: Surface mood derivation, mood state updates, mood modifiers
- **utils.test.ts**: Math utility tests
- **patchFeatures.test.ts**: Debug overlays, audio, diagnostics, OCR, habitat editing, config defaults
- **motionPayload.test.ts**: Motion payload shape, stale clearing, rail helpers
- **v361.test.ts**: Config version/migration, monitor bounds, rail path, UI sounds
- **memoryEngine.test.ts**: Significance scoring, sanitization, mood-valence mapping
- **soulExport.test.ts**: Soul import validation, schema checks
- **familyEngine.test.ts**: Family dynamics, personality helpers, contagion, territory pull
- **entityStore.test.ts**: Entity CRUD, runtime/meta updates, queries, reset
- **museEngine.test.ts**: App-class heuristics, overlay generation, lifecycle, limits, context refresh
- **phase5Integration.test.ts**: Diagnostics export, founding init, config completeness
- **gamingEngine.test.ts**: Gaming mode prediction, excitement bounding, hyper blending, multi-entity safety
- **emoteEngine.test.ts**: Emote spawning, decay, passive mood-driven generation, per-entity tracking, maxActive limits
- **atmosphereEngine.test.ts**: Particle spawning, circadian phase palettes, mood influence, style overrides, 50-particle cap
- **v560Features.test.ts**: Color utils, audio expansion, sound catalog, monitor utils, scenario presets, config v7→v8 migration
- **vitality.test.ts**: Idle float amplitude (visible, mood-scaled), perch micro-fidgets, nap breathing settle, breath param coverage
- **bondEngine.test.ts**: Bond level derivation, progress tracking, mood modifiers, point awards (poke/hover/swipe), streaks, daily bonus, decay, persistence, reset
- **interactionEngine.test.ts**: Poke/hover/swipe detection, cooldowns, proximity checks, cursor speed tracking, startle chance, visibility gating
- **milestoneEngine.test.ts**: Milestone definitions, category counts, behavior/bond/mood/feature/time milestones, notification queue, stats, reset, persistence
- **statsEngine.test.ts**: All record methods, persistence, reset, disabled config, daysActive increment
- **audioReactivityEngine.test.ts**: Disabled config, null output, init failures, media track disposal, visualizer gating (feedVisualizer, visualizerStyle)
- **soundCategoryToggles.test.ts**: emote/whisper/celebration/focus/family sound toggle gating
- **idleEngine.test.ts**: Disabled config, motion-based fallback, idle detection, behavior assignment, empty behaviors
- **profilesEngine.test.ts**: Save/delete/cycle profiles, seed defaults, split-brain fix, persistence
- **settingsReachability.test.ts**: All 29 tabs in SETTINGS_SECTIONS, emote/memory reachability, simple/advanced mode
- **firstMinuteLife.test.ts**: Default config produces visible life (behavior, mood, emotes, atmosphere, thoughts)
- **aiCoordinator.test.ts**: AI coordinator concurrency, cooldown, busy rejection, disabled rejection, missing-key rejection, isBusy, cancelPending, callback firing (onThinking, onInsight, onError), periodic timer (v8.0.0)
- **digestEngine.test.ts**: Digest aggregation, per-section toggles, bond level re-derivation, highlight selection (today/fallback/null), purity, summary composition (v8.2.0)
- **chronicleEngine.test.ts**: Snapshot building, trend computation (streaks, weekly delta, daily deltas, averages, best day, dominant mood, sparkline, dedup), insight generation (6 kinds, tone, determinism), summarize, prune, merge, date formatting (v8.3.0)
- **chronicleStorage.test.ts**: localStorage round-trip, corrupt-payload handling, malformed-element dropping, dedup, sort, field coercion, idempotent persist, retention pruning, clear, SSR safety (v8.3.0)
- **chronicleRunner.test.ts**: `shouldPersistToday` decision function — disabled, hour gating, idempotency, edge hours (v8.3.0)
- **liteMode.test.ts**: Lite mode section filtering, shadow config save/restore (v7.2)
- **presetWizard.test.ts**: Preset wizard config patching (v7.1)
- **configSync.test.ts**: Cross-window config sync bus (v7.2)
- **animationLoop.test.ts**: Animation loop frame timing and entity updates (v7.2)
- **bondMeter.test.ts**: Bond meter rendering (v7.0)
- **circadianEngine.test.ts**: Circadian rhythm, dream/startle, activity histogram (v7.0)
- **dragEngine.test.ts**: Drag interaction, remembered spots, release behaviors (v7.0)
- **familyScenesEngine.test.ts**: Multi-entity group behaviors (v6.1)
- **habitatWeather.test.ts**: Habitat + weather integration (v6.1)
- **journalEngine.test.ts**: Journal entry generation and filtering (v6.1)
- **multiEntity.test.ts**: Multi-entity state and rendering (v4.0)
- **personalityEngine.test.ts**: Personality evolution drift (v7.0)
- **phaseC.test.ts**: Phase C integration tests (v7.0)
- **ritualEngine.test.ts**: Ritual tracking and streaks (v6.1)
- **sim/**: Simulation-based integration tests (v7.0)
- **skinSoundPacks.test.ts**: Skin/sound pack engines (v6.1)
- **vitality.test.ts**: Idle float, perch fidgets, nap breathing, blink clustering (v7.0)

## Feature Status

### Fully Implemented
- Screen capture + motion analysis (Rust) with stable temporal tracking
- Mood engine (8 internal variables, 12 surface moods) with memory influence
- Behavior state machine (25+ states including dream, startle) with family + focus target influence
- Desktop Habitat: homes, zones, rails, nodes, overlay editor with full CRUD, saveable presets
- **Memory Palace**: SQLite-backed structured memory with significance scoring, pruning, and mood/behavior influence
- **Kovy Family**: up to 5 entities with independent engines, personality offsets, family dynamics (contagion, chase, orbit, territory)
- **Muse Mode v1**: heuristic app-class detection with procedural overlays (18 mark types, mood- and confidence-adaptive selection, lifetime decay, bounded count)
- **Gaming Mode v1**: kinetic adaptive layer with short-horizon prediction, fast-fade residue bursts, and elastic body deformation
- **Emote System**: 12 emote types, mood-driven passive spawning, behavior-triggered bursts, bubble/raw styles
- **Atmosphere Engine**: circadian-phase ambient particles (7 palettes, 6 shapes, 3 styles), mood sync, bounded to 50 particles
- **Movement Feel**: lean angle (spring-based body tilt), landing impact (deceleration squash)
- **Vitality System**: mood-responsive breathing, organic blink clustering, autonomous eye drift, pupil dilation, idle micro-movement
- **Bond System**: 5-level relationship progression with proximity-based interaction detection (poke/hover/swipe), daily streaks, bond decay, mood modifiers, return celebration, and visual warmth aura. All data local-only.
- **Milestone System**: 30+ milestones across 14 categories with visual toast notifications, progress tracking, and localStorage persistence. All data local-only.
- **Expressive Idles**: stretch, look_around, and yawn behaviors with dedicated visuals and mood-influenced triggering
- **Tear Drops**: visual tear particle effect when overwhelmed
- **Soul Export**: plaintext JSON personality + memory summary export/import
- **Dream Engine** (v7.1): Dream particles, color wash, dream-specific thoughts during sleep/nap states
- **Focus Target Engine** (v7.2): Window/cursor attraction with gaming boost and habitat softening
- **Profile Auto-Switch** (v7.1, wired v8.1): Rule-based profile switching by time, app, or idle duration — now fully wired with live runner, UI editor, and toast notifications
- **Lite Settings** (v7.2): 5-tab simplified settings with shadow config restore
- **Command Palette** (v7.2): Searchable command palette with registered overlay commands, fuzzy scoring, and recent-command ordering
- **Ask Kovy AI** (v8.0.0): OpenRouter integration with secure credential vault, screenshot consent, thinking feedback, force-spawned thoughts/whispers, periodic insights, and 14-config-section settings tab
- **Companion Digest** (v8.2.0): On-demand overlay card aggregating bond, stats, mood, growth, and journal into a single relationship summary. Triggerable via hotkey, tray, or command palette. Pure local aggregation, fully configurable per-section.
- Procedural Canvas character renderer with personality-based hue/size offsets and gaming deformation
- Per-entity audio cooldowns, per-entity diagnostics tracking
- Config migration ladder (v1→v23) with deep merge and clamping
- Settings UI with 29 tabs (Pro) + 5 tabs (Lite), live preview, draft/applied architecture
- Global hotkeys including Muse toggle (Alt+Shift+M), Gaming toggle (Alt+Shift+G), Drag toggle (Alt+Shift+D), Focus toggle (Alt+Shift+F), Profile switch (Alt+Shift+Tab), Experience mode toggle (Alt+Shift+L), Ask Kovy (Alt+Shift+A), Show Companion Digest (Alt+Shift+I)
- Diagnostics with entity-aware export and system summary
- Engine error boundary for crash-resistant render loop

### Reduced v1 (functional but limited)
- **Family behavior**: Chase is random-trigger, not intentional pursuit. No dedicated `comfort_cluster`/`synchronized_orbit`/`group_hyper` behavior states — family influence biases existing states only.
- **Muse mark variety**: 18 mark types with adaptive, mood-aware, and confidence-weighted selection. User-customizable marks not yet supported.
- **Memory influence**: gentle mood/behavior biases only — no complex reasoning or pattern recognition.
- **Founder bridge**: `kovyStore` → `entityStore` sync is one-way with one-frame lag. Acceptable for N≤5.
- **Particle budget**: per-entity particle cap (40/entity) is enforced. Total budget with 5 entities: 200 particles.
- **AI model compatibility**: The `json_schema` response format may not work with all OpenRouter models. The system prompt includes fallback instructions for JSON-only responses.

### Limited / Platform-Dependent
- **Battery throttling**: config saved but limited on Windows desktop
- **GPU acceleration**: informational only (WebView/OS controlled)
- **CPU budget**: saved as preference but not actively enforced
- **Overlay window**: spans virtual desktop across all monitors (computed at startup in `lib.rs`)
- **AI credential vault**: Windows Credential Manager only; non-Windows platforms return errors for credential operations
- **AI screenshot capture**: Uses `xcap` for primary monitor capture; behavior may vary on multi-monitor setups
