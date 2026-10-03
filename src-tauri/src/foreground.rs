// ============================================================
// Foreground window detection — returns the active window's
// process name and title for memory app-session tagging.
// Windows-only implementation using Win32 API.
// No keylogging. No content inspection. Just process + title.
// ============================================================

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct ForegroundAppInfo {
    #[serde(rename = "processName")]
    pub process_name: Option<String>,
    #[serde(rename = "windowTitle")]
    pub window_title: Option<String>,
    #[serde(rename = "windowBounds")]
    pub window_bounds: Option<WindowBounds>,
}

#[cfg(target_os = "windows")]
pub fn get_foreground_app_info() -> ForegroundAppInfo {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    unsafe {
        let hwnd = windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow();
        if hwnd == std::ptr::null_mut() {
            return ForegroundAppInfo {
                process_name: None,
                window_title: None,
                window_bounds: None,
            };
        }

        // Get window bounds via GetWindowRect
        let mut rect = windows_sys::Win32::Foundation::RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        let rect_ok = windows_sys::Win32::UI::WindowsAndMessaging::GetWindowRect(hwnd, &mut rect);
        let window_bounds = if rect_ok != 0 {
            Some(WindowBounds {
                x: rect.left,
                y: rect.top,
                width: (rect.right - rect.left).max(0) as u32,
                height: (rect.bottom - rect.top).max(0) as u32,
            })
        } else {
            None
        };

        // Get window title
        let mut title_buf = [0u16; 256];
        let title_len = windows_sys::Win32::UI::WindowsAndMessaging::GetWindowTextW(
            hwnd,
            title_buf.as_mut_ptr(),
            title_buf.len() as i32,
        );
        let window_title = if title_len > 0 {
            Some(
                OsString::from_wide(&title_buf[..title_len as usize])
                    .to_string_lossy()
                    .into_owned(),
            )
        } else {
            None
        };

        // Get process ID from window handle
        let mut pid: u32 = 0;
        windows_sys::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return ForegroundAppInfo {
                process_name: None,
                window_title,
                window_bounds,
            };
        }

        // Open process to query its executable name
        let handle = windows_sys::Win32::System::Threading::OpenProcess(
            windows_sys::Win32::System::Threading::PROCESS_QUERY_LIMITED_INFORMATION,
            0, // FALSE
            pid,
        );
        if handle == std::ptr::null_mut() {
            return ForegroundAppInfo {
                process_name: None,
                window_title,
                window_bounds,
            };
        }

        let mut exe_buf = [0u16; 260];
        let mut exe_len = exe_buf.len() as u32;
        let ok = windows_sys::Win32::System::Threading::QueryFullProcessImageNameW(
            handle,
            0,
            exe_buf.as_mut_ptr(),
            &mut exe_len,
        );
        windows_sys::Win32::Foundation::CloseHandle(handle);

        let process_name = if ok != 0 && exe_len > 0 {
            let full_path = OsString::from_wide(&exe_buf[..exe_len as usize])
                .to_string_lossy()
                .into_owned();
            // Extract just the filename from the full path
            full_path.rsplit('\\').next().map(|s| s.to_string())
        } else {
            None
        };

        ForegroundAppInfo {
            process_name,
            window_title,
            window_bounds,
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn get_foreground_app_info() -> ForegroundAppInfo {
    // Stub for non-Windows — returns None gracefully
    ForegroundAppInfo {
        process_name: None,
        window_title: None,
        window_bounds: None,
    }
}
