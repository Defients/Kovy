fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "get_monitors",
            "get_foreground_app",
            "get_idle_seconds",
            "set_hide_from_capture",
            "capture_visibility_status",
            "ai_has_api_key",
            "native_policy_revision",
            "ai_request",
            "cancel_ai_request",
            "apply_native_policy",
            "ai_store_api_key",
            "ai_delete_api_key",
            "update_capture_config",
            "pause_capture",
            "resume_capture",
            "set_monitor_index",
            "set_overlay_masks",
            "detect_capture_apps",
            "fetch_weather",
            "ai_chat",
            "experimental_interact",
        ]),
    ))
    .expect("Tauri application manifest");
}
