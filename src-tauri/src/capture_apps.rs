// ============================================================
// Capture-app detection — checks whether a known screen-capture
// / streaming / recording application is currently running, so
// Kovy can auto-hide itself from OBS Display Capture and similar.
// Windows-only implementation using Toolhelp32 process snapshot.
// No content inspection — only process image names.
// ============================================================

use serde::Serialize;

/// Names (lowercased, without extension) of processes that perform
/// display capture. When any of these are running, Kovy's overlay
/// would otherwise appear in the captured feed.
const CAPTURE_APP_NAMES: &[&str] = &[
    "obs64",            // OBS Studio (64-bit)
    "obs32",            // OBS Studio (32-bit)
    "obs",              // OBS Studio (generic)
    "streamlabsobs",    // Streamlabs Desktop
    "streamlabs",       // Streamlabs (legacy)
    "prism-live-studio",// PRISM Live Studio
    "xsplit broadcaster",// XSplit Broadcaster
    "xsplit core",      // XSplit Core
    "vmix64",           // vMix (64-bit)
    "vmix",             // vMix
    "bandicam",         // Bandicam
    "fraps",            // Fraps
    "action",           // Action! recorder
    "sharex",           // ShareX
    "obsproject",       // OBS Project (alt binary)
    "dxtory",           // Dxtory
    "ms-mp4",           // Game DVR (legacy)
];

#[derive(Debug, Clone, Serialize)]
pub struct CaptureAppStatus {
    /// True if at least one known capture app process is running.
    pub running: bool,
    /// Lowercased process image names that matched (without `.exe`).
    pub matched: Vec<String>,
}

/// Returns the lowercased process image name (without directory and
/// without extension) for a Toolhelp32 process entry's full exe path.
#[cfg(target_os = "windows")]
fn basename_lower(full: &str) -> String {
    let trimmed = full.rsplit(['\\', '/']).next().unwrap_or(full);
    let without_ext = trimmed.rsplit_once('.').map(|(stem, _)| stem).unwrap_or(trimmed);
    without_ext.to_lowercase()
}

/// Enumerate running processes and return whether any known capture
/// application is currently running, plus the matched process names.
#[cfg(target_os = "windows")]
pub fn detect_capture_apps() -> CaptureAppStatus {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use std::mem::MaybeUninit;

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot.is_null() || snapshot == INVALID_HANDLE_VALUE {
            return CaptureAppStatus { running: false, matched: Vec::new() };
        }

        let mut entry: PROCESSENTRY32W = MaybeUninit::zeroed().assume_init();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        let mut matched: Vec<String> = Vec::new();

        if Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                // szExeFile is a UTF-16 wide string; decode to a Rust String.
                let len = entry
                    .szExeFile
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(entry.szExeFile.len());
                let exe = String::from_utf16_lossy(&entry.szExeFile[..len]);
                let name = basename_lower(&exe);
                if CAPTURE_APP_NAMES.contains(&name.as_str()) && !matched.contains(&name) {
                    matched.push(name);
                }
                if Process32NextW(snapshot, &mut entry) == 0 {
                    break;
                }
            }
        }

        CloseHandle(snapshot);

        CaptureAppStatus {
            running: !matched.is_empty(),
            matched,
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn detect_capture_apps() -> CaptureAppStatus {
    // Non-Windows: no Toolhelp32 equivalent wired here; report nothing.
    CaptureAppStatus { running: false, matched: Vec::new() }
}

/// Unit tests — exercise the matcher logic without touching the OS.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn basename_strips_path_and_extension() {
        assert_eq!(basename_lower("C:\\Program Files\\OBS\\obs64.exe"), "obs64");
        assert_eq!(basename_lower("obs32.exe"), "obs32");
        assert_eq!(basename_lower("/usr/bin/obs"), "obs");
        assert_eq!(basename_lower("StreamLabsOBS"), "streamlabsobs");
    }

    #[test]
    fn known_capture_app_names_match() {
        assert!(CAPTURE_APP_NAMES.contains(&"obs64"));
        assert!(CAPTURE_APP_NAMES.contains(&"streamlabsobs"));
        assert!(CAPTURE_APP_NAMES.contains(&"sharex"));
    }

    #[test]
    fn non_capture_app_does_not_match() {
        assert!(!CAPTURE_APP_NAMES.contains(&"chrome"));
        assert!(!CAPTURE_APP_NAMES.contains(&"notepad"));
    }
}
