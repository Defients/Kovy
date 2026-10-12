# Kovy resurrection — M0 baseline and M1 status

2026-10-12 · applies to checkout at `main` after the M0/M1 implementation commit
(`16fe5f6`) plus the review-completion changes described below.

## Environment

| Tool | Version |
| --- | --- |
| Node | 24.21.0 |
| npm | 11.19.0 |
| Rust | 1.99.0 stable (x86_64-pc-windows-msvc, installed via rustup during this pass) |
| Platform | Windows, Visual Studio 18 build tools |

The audit archive (`kovy-current.zip`, SHA-256
`528e7987…f5e`) predates this checkout; findings were re-verified against current
source. `src-tauri/target/` is generated output and was recreated by `cargo`
during this pass; the stale binaries previously present (2026-09-03) were not
used as evidence.

## Executed checks

| Check | Result |
| --- | --- |
| `npm test` (Vitest 4.1.10) | **1,424 tests / 73 files — all pass** |
| `npm run build` (`tsc` + Vite 5.4.21) | Passes; pre-existing warnings only (stale Browserslist data; `storyToast`/`storyEngine` static+dynamic import) |
| `cargo fmt -- --check` | Clean (crate was not fmt-clean before; mechanical reformat applied) |
| `cargo check --locked` | Clean |
| `cargo test --locked` | **24 tests — all pass** (12 ai, 4 policy, 3 idle, 3 capture_apps, 2 experimental) |
| `cargo clippy --locked --all-targets -- -D warnings` | Clean after fixing 11 lint errors (4 in new policy/AI code, 7 pre-existing) |

## Audit findings status after M1

- **F01 memory writes** — Fixed. `sql:allow-execute` granted via
  `capabilities/memory-writer.json`, scoped to `settings` + `overlay`. `memoryDb.ts`
  tracks readable/writable separately, probes writes with a zero-row statement,
  and surfaces failure instead of swallowing it. Memory tab shows
  "Memory degraded: writes unavailable".
- **F02 experimental restrictions/race** — Fixed at both layers. Frontend
  reserves the in-flight slot and cooldown before the first await, re-checks
  live authorization and generation after every await, and only accepts
  registered `toy:`/`habitat:` targets within bounds/radius. Rust `ActionGate`
  re-validates revision, pause, opt-in, target mode (`toys` only — allowlist is
  denied), allowed action, and cooldown. Physical OS input is stubbed
  (`UnavailableInput`) — no Win32 input is sent in this build.
- **F03 raw-key IPC** — Fixed. `ai_load_api_key` command and `aiLoadApiKey()`
  wrapper removed; vault access remains private to Rust (store/delete/presence).
  Dead wrappers for removed commands (`simulate_click`, `simulate_hover`,
  `simulate_key`, `get_window_at_position`, `get_element_info`) were also removed.
- **F04 native AI policy/cancellation** — Fixed. `policy.rs` `Authority`
  (deny-by-default, settings-window-only apply, revision + pause + single
  active slot) gates `ai_request`/`ai_chat` through a `Lease` checked before
  capture, before transport, and before publication. `cancel_ai_request` +
  `watch` channel drops in-flight transport futures. Frontend `invokeOwnedAI`
  waits for queued policy updates, stamps the live revision, and forwards
  `AbortSignal` to native cancellation. Untrusted inputs bounded in
  `validate_insight`/`validate_chat` (model, timeout, screenshot size/quality,
  monitor count, foreground field lengths, message count/length, 256 KiB
  response cap). Provider bodies and keys are never logged (typed error codes
  only). Monitor consent is bound to the live display topology.
- **F05 privacy copy** — Fixed across onboarding, Privacy tab, AI tab, memory
  tab, experimental tab, and README. Claims now describe: local motion analysis
  with a transient previous grayscale frame, opt-in OpenRouter traffic,
  best-effort (not guaranteed) recording exclusion with live applied/failed/
  unsupported status, screenshot opt-in semantics, and honest "cannot recall
  sent data" wording. The misleading "always on" retention switch was replaced
  by a status row; `retainZeroFrames` remains a compatibility no-op.
- **F06 diagnostic sanitization** — Fixed. Export uses an allowlist projection:
  numeric `fps`/`count`/`topScore`, enum-gated `from`/`to`/`mood`/`museMode`,
  numeric milestone summary, and a fixed boolean config snapshot. No app rules,
  locations, profiles, shadow config, entity ids, or arbitrary strings are
  emitted; `recordError` retains no message text.
- **F07–F15** — Out of M1 scope (M2 time/lifecycle/coords, M3
  arbitration/discovery/story/Lite, M4 design, M5 release evidence). README
  now disclaims historical test/release claims and stale command lists were
  corrected where they contradicted M1 behavior.

## What changed in this review pass (after `16fe5f6`)

- `tauriBridge.ts`: removed dead IPC wrappers for five deleted commands.
- `build.rs`: removed the same five names from the app manifest allowlist.
- `diagnosticsEngine.ts` + `phase5Integration.test.ts`: restored enum-gated
  `from`/`to`/`mood`, `museMode`, and `milestoneSummary` in the export
  projection (fixed vocabularies/numbers cannot carry user data); updated two
  stale tests to the new contract. Sentinel test still passes.
- `README.md`: corrected the AI command list and experimental section to
  reflect M1 reality; removed a stale test-count comment.
- `src-tauri`: `cargo fmt` applied crate-wide (was not fmt-clean; ~100 lines of
  mechanical reformat including 4 files otherwise untouched by M1:
  `capture.rs`, `capture_apps.rs`, `idle.rs`, `tray_setup.rs`); fixed 11 clippy
  errors (`or_else` → `unwrap_or`, `&mut` → `&` for `CredWriteW`, helpers moved
  before the test module, `div_ceil`, `sort_by_key(Reverse)`, `.is_null()` ×2,
  `#[allow(clippy::too_many_arguments)]` on `ai_request`).
- `gen/schemas/*`: regenerated by the build; now contains the `__app-acl__`
  manifest with per-command `allow-*`/`deny-*` permissions for all 21
  registered commands, and window-scoped capability sets.

## Evidence highlights

- `experimentalEngine.test.ts` (15 tests): in-flight reservation before lookup,
  no dispatch after pause/disable/destroy/target-removal mid-lookup, cooldown
  after failures, invalid/out-of-radius/window-substituted targets rejected,
  legacy "type" action and allowlist mode unavailable, journal sanitization.
- `nativePolicy.test.ts` (4 tests): policy projection contains no secrets;
  pause ordering blocks dispatch; abort before/at/after policy lookup cancels
  the native request id.
- `aiCoordinator.test.ts`/`chatEngine.test.ts` regressions: stale completions
  cannot clobber replacements; disabled/blocked requests never publish;
  cleared history is not resurrected by an outstanding reply.
- `memoryDb.test.ts`: denied execute → readable-but-degraded health; insert
  returns id; clear failure is thrown, not reported as success.
- `policy.rs` tests: wrong-window apply denied, caller consent flags denied,
  revision/pause/monitor/chat gates, single-slot ownership, pause drops a
  pending mock transport.
- `experimental.rs` tests: `ActionGate` enforces pause/opt-in/mode/target/
  action/cooldown; `UnavailableInput` never dispatches.
- Screenshot evidence: `docs/evidence/m1-onboarding.png`.

## Open native validation blockers (M1 acceptance gates not fully closed)

- **Real Tauri runtime round-trip**: `cargo test` covers the policy/gate seams
  as units, but the packaged app was not launched. Still unverified: SQL
  insert/read/delete across an app restart inside the real WebView2 session;
  `apply_native_policy` rejection from the overlay window under real IPC;
  `SetWindowDisplayAffinity` status reporting; monitor-topology consent
  binding on real hardware.
- **`npm run tauri build`**: not run in this pass (requires the full bundle
  pipeline; scheduled for M5).
- **WebView2 runtime**: present on this machine is assumed but unverified.
- Physical OS input remains intentionally unavailable; no disposable-desktop
  input verification was performed or needed.

Commands to close the remaining gates once the app can run:

```text
npm run tauri dev          # exercise memory round-trip, policy denial, pause
npm run tauri build        # packaged artifact for M5 install checks
```
