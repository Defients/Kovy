// ============================================================
// Tray icon setup — system tray with menu items that emit
// typed events to the frontend
// ============================================================

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

pub fn create_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let toggle_visibility = MenuItem::with_id(
        app,
        "toggle_visibility",
        "Show / Hide Kovy",
        true,
        None::<&str>,
    )?;
    let toggle_pause =
        MenuItem::with_id(app, "toggle_pause", "Pause / Resume", true, None::<&str>)?;
    let toggle_sleep = MenuItem::with_id(app, "toggle_sleep", "Sleep / Wake", true, None::<&str>)?;
    let privacy_pause =
        MenuItem::with_id(app, "privacy_pause", "Privacy Pause", true, None::<&str>)?;
    let reset_pos = MenuItem::with_id(app, "reset_position", "Reset Position", true, None::<&str>)?;
    let edit_habitat = MenuItem::with_id(app, "edit_habitat", "Edit Habitat", true, None::<&str>)?;
    let show_settings = MenuItem::with_id(app, "show_settings", "Settings", true, None::<&str>)?;
    let toggle_experience = MenuItem::with_id(
        app,
        "toggle_experience",
        "Switch Lite / Pro Mode",
        true,
        None::<&str>,
    )?;
    let ask_kovy = MenuItem::with_id(app, "ask_kovy", "Ask Kovy", true, None::<&str>)?;
    let command_palette = MenuItem::with_id(
        app,
        "command_palette",
        "Command Palette",
        true,
        None::<&str>,
    )?;
    let show_digest = MenuItem::with_id(
        app,
        "show_digest",
        "Show Companion Digest",
        true,
        None::<&str>,
    )?;
    let show_chronicle = MenuItem::with_id(
        app,
        "show_chronicle",
        "Show Companion Chronicle",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Quit Kovy", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &toggle_visibility,
            &toggle_pause,
            &toggle_sleep,
            &privacy_pause,
            &reset_pos,
            &edit_habitat,
            &show_settings,
            &toggle_experience,
            &ask_kovy,
            &show_digest,
            &show_chronicle,
            &command_palette,
            &quit,
        ],
    )?;

    let mut tray_builder = TrayIconBuilder::new()
        .tooltip("Kovy")
        .menu(&menu)
        .on_menu_event(move |app, event| {
            let id = event.id().as_ref();
            match id {
                "toggle_visibility" => {
                    let _ = app.emit("toggle-visibility", ());
                }
                "toggle_pause" => {
                    let _ = app.emit("toggle-pause", ());
                }
                "toggle_sleep" => {
                    let _ = app.emit("toggle-sleep", ());
                }
                "privacy_pause" => {
                    let _ = app.emit("privacy-pause", ());
                }
                "reset_position" => {
                    let _ = app.emit("reset-position", ());
                }
                "edit_habitat" => {
                    let _ = app.emit("toggle-habitat-edit", ());
                }
                "show_settings" => {
                    if let Some(w) = app.get_webview_window("settings") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
                "toggle_experience" => {
                    let _ = app.emit("toggle-experience-mode", ());
                }
                "ask_kovy" => {
                    let _ = app.emit("ask-kovy", ());
                }
                "show_digest" => {
                    let _ = app.emit("show-digest", ());
                }
                "show_chronicle" => {
                    let _ = app.emit("show-chronicle", ());
                }
                "command_palette" => {
                    let _ = app.emit("command-palette", ());
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        tray_builder = tray_builder.icon(icon);
    }

    let _tray = tray_builder.build(app)?;

    Ok(())
}
