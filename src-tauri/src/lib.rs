// ============================================================
// Kovy 9.0 — Tauri native backend
// Screen capture, motion analysis, tray, overlay management, AI
// ============================================================

mod ai;
mod policy;
mod capture;
mod capture_apps;
mod experimental;
mod foreground;
mod idle;
mod motion;
mod tray_setup;

use capture::CaptureManager;
use parking_lot::Mutex;
use std::sync::Arc;

pub struct AppState {
    pub capture: Arc<Mutex<CaptureManager>>,
    pub authority: Arc<policy::Authority>,
    pub actions: Mutex<experimental::ActionGate>,
    pub capture_visibility: Mutex<String>,
}

#[tauri::command]
fn get_monitors() -> Vec<capture::MonitorInfo> {
    capture::list_monitors()
}

#[tauri::command]
fn update_capture_config(
    state: tauri::State<'_, AppState>,
    enabled: bool,
    analysis_fps: u32,
    analysis_scale: f64,
    motion_threshold: u32,
) {
    let mut cap = state.capture.lock();
    cap.set_config(enabled, analysis_fps, analysis_scale, motion_threshold);
}

#[tauri::command]
fn pause_capture(state: tauri::State<'_, AppState>) {
    state.authority.pause(true);
    state.capture.lock().set_paused(true);
}

#[tauri::command]
fn resume_capture(state: tauri::State<'_, AppState>) {
    state.authority.pause(false);
    state.capture.lock().set_paused(false);
}

#[tauri::command]
fn set_monitor_index(state: tauri::State<'_, AppState>, index: usize) {
    state.capture.lock().set_monitor(index);
}

/// Update the overlay masks used to suppress self-detection of Kovy's own
/// rendered entities (founder + siblings). Each entry is a rectangle in canvas
/// (virtual-desktop physical) pixels. Pass an empty array to clear all masks
/// (e.g. when the overlay is hidden from capture via WDA_EXCLUDEFROMCAPTURE).
#[tauri::command]
fn set_overlay_masks(
    state: tauri::State<'_, AppState>,
    rects: Vec<capture::OverlayMaskRect>,
) {
    // Filter out zero-area rects so callers can't accidentally leave no-op masks.
    let masks: Vec<capture::OverlayMaskRect> = rects
        .into_iter()
        .filter(|r| r.w > 0.0 && r.h > 0.0)
        .collect();
    state.capture.lock().set_overlay_masks(masks);
}

/// Best-effort Windows recording exclusion, not a guarantee against capture.
#[tauri::command]
fn set_hide_from_capture(app: tauri::AppHandle, state: tauri::State<'_, AppState>, hide: bool) -> String {
    let status;
    #[cfg(target_os = "windows")]
    {
        use tauri::Manager;
        use windows_sys::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_NONE};
        let applied = app.get_webview_window("overlay").and_then(|w| w.hwnd().ok()).is_some_and(|hwnd| unsafe {
            SetWindowDisplayAffinity(hwnd.0 as *mut _, if hide { WDA_EXCLUDEFROMCAPTURE } else { WDA_NONE }) != 0
        });
        status = if !applied { "failed" } else if hide { "applied-hidden" } else { "applied-visible" };
    }
    #[cfg(not(target_os = "windows"))]
    { let _ = (app, hide); status = "unsupported"; }
    *state.capture_visibility.lock() = status.into();
    status.into()
}
#[tauri::command]
fn capture_visibility_status(state: tauri::State<'_, AppState>) -> String { state.capture_visibility.lock().clone() }

/// Detect whether a known screen-capture / streaming application (OBS,
/// Streamlabs, vMix, ShareX, etc.) is currently running. Used by the
/// frontend to auto-enable `hideFromCapture` so Kovy doesn't appear in
/// the captured feed. Only process image names are inspected — no window
/// content is read.
#[tauri::command]
fn detect_capture_apps() -> capture_apps::CaptureAppStatus {
    capture_apps::detect_capture_apps()
}

#[tauri::command]
fn get_foreground_app() -> foreground::ForegroundAppInfo {
    foreground::get_foreground_app_info()
}

/// Returns the number of seconds since the last OS-level user input
/// (mouse movement, keyboard, touch). Uses Windows GetLastInputInfo
/// for real idle detection rather than measuring from app launch.
#[tauri::command]
fn get_idle_seconds() -> f64 {
    idle::get_idle_seconds()
}

#[tauri::command]
async fn fetch_weather(location: String) -> Result<String, String> {
    if location.is_empty() {
        return Err("Location is empty".to_string());
    }
    let encoded = urlencoding::encode(&location);
    let url = format!("https://wttr.in/{}?format=j1", encoded);
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Weather fetch failed: {}", e))?;
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    Ok(body)
}

// ============================================================
// AI commands — credential vault + OpenRouter transport
// ============================================================

#[tauri::command]
fn ai_store_api_key(key: String) -> Result<(), String> {
    if key.is_empty() || key.len() > 4096 { return Err("Invalid API key length".into()); }
    ai::store_api_key(&key)
}

#[tauri::command]
fn ai_delete_api_key() -> Result<(), String> {
    ai::delete_api_key()
}

#[tauri::command]
fn ai_has_api_key() -> bool {
    ai::load_api_key().is_ok()
}

#[tauri::command]
async fn ai_request(
    state: tauri::State<'_, AppState>,
    revision: u64,
    model: String,
    send_screenshot: bool,
    screenshot_max_width: u32,
    screenshot_jpeg_quality: u8,
    screenshot_monitor_indices: Vec<usize>,
    screenshot_monitor_qualities: std::collections::HashMap<usize, u8>,
    include_foreground_app: bool,
    foreground_app: Option<String>,
    foreground_title: Option<String>,
    max_thought_chars: usize,
    max_whisper_chars: usize,
    timeout_secs: u64,
    request_id: String,
    source: String,
) -> Result<ai::AiInsight, ai::AiError> {
    let owner = state.authority.begin(request_id.clone(), revision, false,
        send_screenshot, include_foreground_app, &screenshot_monitor_indices)?;
    owner.check()?;
    let api_key = ai::load_api_key().map_err(|_| ai::AiError::CredentialUnavailable)?;

    let params = ai::AiRequestParams {
        api_key,
        model,
        send_screenshot,
        screenshot_max_width,
        screenshot_jpeg_quality,
        screenshot_monitor_indices,
        screenshot_monitor_qualities,
        include_foreground_app,
        foreground_app,
        foreground_title,
        max_thought_chars,
        max_whisper_chars,
        timeout_secs,
        request_id,
        source,
    };

    ai::validate_insight(&params)?;
    owner.run(ai::execute_ai_request(params, &owner)).await
}

#[tauri::command]
async fn ai_chat(
    state: tauri::State<'_, AppState>,
    request_id: String,
    revision: u64,
    model: String,
    messages: Vec<ai::ChatMessage>,
    timeout_secs: u64,
) -> Result<ai::ChatResponse, ai::AiError> {
    let owner = state.authority.begin(request_id, revision, true, false, false, &[])?;
    let params = ai::ChatRequestParams {
        model,
        messages,
        timeout_secs,
    };
    ai::validate_chat(&params)?;
    owner.run(ai::execute_chat_request(params, &owner)).await
}

#[tauri::command]
fn apply_native_policy(window: tauri::WebviewWindow, state: tauri::State<'_, AppState>, mut policy: policy::AppliedPolicy) -> Result<u64, ai::AiError> {
    policy.topology = ai::monitor_topology().unwrap_or_default();
    state.authority.apply(window.label(), policy)
}

#[tauri::command]
fn native_policy_revision(state: tauri::State<'_, AppState>) -> u64 { state.authority.revision() }

#[tauri::command]
fn cancel_ai_request(state: tauri::State<'_, AppState>, request_id: String) { state.authority.cancel(&request_id); }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // --- Make the process per-monitor DPI aware (Windows) ---
    // This ensures xcap::Monitor reports physical pixel dimensions that
    // match the actual capture resolution, preventing the "part of the
    // monitor isn't being captured" issue on high-DPI multi-monitor setups.
    // Tauri v2 may set DPI awareness for its own windows, but we set it
    // early here so the capture thread sees physical pixels from xcap.
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::UI::HiDpi::{
            SetProcessDpiAwarenessContext,
            DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
        };
        unsafe {
            // Best-effort — ignore failure (process may already be DPI-aware)
            let _ = SetProcessDpiAwarenessContext(
                DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 as *mut _,
            );
        }
    }

    let capture_manager = Arc::new(Mutex::new(CaptureManager::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin({
            use tauri_plugin_sql::{Migration, MigrationKind};
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:kovy-memory.db", vec![
                    Migration {
                        version: 1,
                        description: "create_memory_tables",
                        sql: "
                            CREATE TABLE IF NOT EXISTS memories (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                entity_id TEXT NOT NULL DEFAULT 'kovy-prime',
                                type TEXT NOT NULL,
                                significance REAL NOT NULL DEFAULT 0.0,
                                timestamp INTEGER NOT NULL,
                                duration REAL NOT NULL DEFAULT 0.0,
                                valence REAL NOT NULL DEFAULT 0.0,
                                stimulation REAL NOT NULL DEFAULT 0.0,
                                tags TEXT NOT NULL DEFAULT '',
                                app_process TEXT,
                                app_title TEXT,
                                summary TEXT NOT NULL DEFAULT '',
                                data TEXT
                            );
                            CREATE INDEX IF NOT EXISTS idx_memories_entity ON memories(entity_id);
                            CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
                            CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp);
                            CREATE INDEX IF NOT EXISTS idx_memories_significance ON memories(significance);
                            CREATE TABLE IF NOT EXISTS soul_meta (
                                key TEXT PRIMARY KEY,
                                value TEXT NOT NULL
                            );
                        ",
                        kind: MigrationKind::Up,
                    },
                    Migration {
                        version: 2,
                        description: "create_v7_tables",
                        sql: "
                            CREATE TABLE IF NOT EXISTS stats (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                entity_id TEXT NOT NULL DEFAULT 'kovy-prime',
                                key TEXT NOT NULL,
                                value REAL NOT NULL DEFAULT 0.0,
                                timestamp INTEGER NOT NULL,
                                UNIQUE(entity_id, key, timestamp)
                            );
                            CREATE INDEX IF NOT EXISTS idx_stats_entity ON stats(entity_id);
                            CREATE INDEX IF NOT EXISTS idx_stats_key ON stats(key);
                            CREATE TABLE IF NOT EXISTS growth_state (
                                entity_id TEXT PRIMARY KEY DEFAULT 'kovy-prime',
                                stage TEXT NOT NULL DEFAULT 'sprout',
                                age_days REAL NOT NULL DEFAULT 0.0,
                                last_updated INTEGER NOT NULL
                            );
                            CREATE TABLE IF NOT EXISTS entity_relations (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                entity_a TEXT NOT NULL,
                                entity_b TEXT NOT NULL,
                                relation_type TEXT NOT NULL,
                                strength REAL NOT NULL DEFAULT 0.5,
                                UNIQUE(entity_a, entity_b)
                            );
                            CREATE TABLE IF NOT EXISTS thought_log (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                entity_id TEXT NOT NULL DEFAULT 'kovy-prime',
                                text TEXT NOT NULL,
                                timestamp INTEGER NOT NULL
                            );
                            CREATE TABLE IF NOT EXISTS whisper_log (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                entity_id TEXT NOT NULL DEFAULT 'kovy-prime',
                                text TEXT NOT NULL,
                                category TEXT NOT NULL,
                                timestamp INTEGER NOT NULL
                            );
                            CREATE TABLE IF NOT EXISTS idle_events (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                entity_id TEXT NOT NULL DEFAULT 'kovy-prime',
                                start_time INTEGER NOT NULL,
                                end_time INTEGER,
                                idle_type TEXT
                            );
                            CREATE TABLE IF NOT EXISTS focus_sessions (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                entity_id TEXT NOT NULL DEFAULT 'kovy-prime',
                                start_time INTEGER NOT NULL,
                                end_time INTEGER,
                                focus_level TEXT NOT NULL DEFAULT 'light_focus'
                            );
                            CREATE TABLE IF NOT EXISTS drag_spots (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                entity_id TEXT NOT NULL DEFAULT 'kovy-prime',
                                x REAL NOT NULL,
                                y REAL NOT NULL,
                                visit_count INTEGER NOT NULL DEFAULT 1,
                                last_visited INTEGER NOT NULL
                            );
                            CREATE TABLE IF NOT EXISTS saved_profiles (
                                id TEXT PRIMARY KEY,
                                name TEXT NOT NULL,
                                icon TEXT NOT NULL DEFAULT 'star',
                                timestamp INTEGER NOT NULL,
                                config_json TEXT NOT NULL
                            );
                        ",
                        kind: MigrationKind::Up,
                    },
                ])
                .build()
        })
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .manage(AppState {
            capture: capture_manager.clone(),
            authority: Arc::new(policy::Authority::default()),
            actions: Mutex::new(experimental::ActionGate::default()),
            capture_visibility: Mutex::new("not-applied".into()),
        })
        .invoke_handler(tauri::generate_handler![
            get_monitors,
            update_capture_config,
            pause_capture,
            resume_capture,
            set_monitor_index,
            set_overlay_masks,
            set_hide_from_capture,
            capture_visibility_status,
            detect_capture_apps,
            get_foreground_app,
            get_idle_seconds,
            fetch_weather,
            apply_native_policy,
            native_policy_revision,
            cancel_ai_request,
            ai_store_api_key,
            ai_delete_api_key,
            ai_has_api_key,
            ai_request,
            ai_chat,
            experimental::experimental_interact,
        ])
        .setup(move |app| {
            // --- Compute virtual desktop bounds spanning all monitors ---
            // This allows the overlay to cover all monitors for true
            // cross-monitor entity placement (architecture decision: single
            // overlay window over virtual desktop, not per-monitor windows).
            let monitors = app.available_monitors()?;
            let (vx, vy, vw, vh) = if monitors.is_empty() {
                (0i32, 0i32, 1920u32, 1080u32)
            } else {
                let mut min_x = i32::MAX;
                let mut min_y = i32::MAX;
                let mut max_x = i32::MIN;
                let mut max_y = i32::MIN;
                for m in &monitors {
                    let pos = m.position();
                    let size = m.size();
                    min_x = min_x.min(pos.x);
                    min_y = min_y.min(pos.y);
                    max_x = max_x.max(pos.x + size.width as i32);
                    max_y = max_y.max(pos.y + size.height as i32);
                }
                (min_x, min_y, (max_x - min_x) as u32, (max_y - min_y) as u32)
            };

            // --- Create overlay window spanning full virtual desktop ---
            let overlay_url = tauri::WebviewUrl::App("overlay.html".into());
            let _overlay = tauri::WebviewWindowBuilder::new(
                app,
                "overlay",
                overlay_url,
            )
            .title("Kovy")
            .transparent(true)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .visible(true)
            .resizable(false)
            .inner_size(vw as f64, vh as f64)
            .position(vx as f64, vy as f64)
            .build()?;

            // Default the overlay to VISIBLE to screen capture (WDA_NONE) so OBS
            // display capture and other recorders can see Kovy. The frontend will
            // call `set_hide_from_capture` after loading config to apply the user's
            // saved preference, and `set_overlay_mask` to suppress self-detection
            // of Kovy's own body when visible.
            #[cfg(target_os = "windows")]
            {
                use windows_sys::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WDA_NONE};
                if let Ok(hwnd) = _overlay.hwnd() {
                    unsafe {
                        let _ = SetWindowDisplayAffinity(hwnd.0 as *mut _, WDA_NONE);
                    }
                }
            }

            // Settings window starts hidden (visible:false in tauri.conf.json).
            // The frontend will call window.show() after loading config,
            // unless startMinimized is true.

            // --- Setup tray ---
            tray_setup::create_tray(app)?;

            // --- Start capture loop ---
            let app_handle = app.handle().clone();
            let cap = capture_manager.clone();
            std::thread::spawn(move || {
                capture::run_capture_loop(app_handle, cap);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Kovy");
}
