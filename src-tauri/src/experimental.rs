// ============================================================
// Experimental Mode — screen interaction via Windows APIs
//
// When experimental mode is enabled, Kovy can trigger clicks
// and keyboard inputs on screen elements.
//
// Safety:
// - All functions are no-ops on non-Windows platforms
// - Rate limiting is enforced by the frontend engine
// - Privacy pause disables all interactions
// ============================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementInfo {
    pub name: String,
    pub element_type: String,
    pub bounds: (i32, i32, i32, i32), // x, y, width, height
    pub is_clickable: bool,
}

#[cfg(target_os = "windows")]
mod windows_impl {
    use super::*;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SetCursorPos,
        GetWindowTextW, WindowFromPoint,
        WINDOWINFO, GetWindowInfo,
    };
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        keybd_event, mouse_event, KEYEVENTF_KEYUP,
        VK_RETURN, VK_ESCAPE, VK_SPACE, VK_TAB,
        MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEEVENTF_RIGHTDOWN,
        MOUSEEVENTF_RIGHTUP, MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP,
    };

    pub fn simulate_click_impl(x: i32, y: i32, button: &str) -> Result<(), String> {
        unsafe {
            // Move cursor to position
            if SetCursorPos(x, y) == 0 {
                return Err("Failed to set cursor position".to_string());
            }

            // Small delay to ensure cursor has moved
            std::thread::sleep(std::time::Duration::from_millis(10));

            let (down, up) = match button {
                "right" => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
                "middle" => (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
                _ => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
            };

            mouse_event(down, 0, 0, 0, 0);
            std::thread::sleep(std::time::Duration::from_millis(20));
            mouse_event(up, 0, 0, 0, 0);
        }
        Ok(())
    }

    pub fn simulate_key_impl(key: &str) -> Result<(), String> {
        let vk = match key {
            "enter" | "return" => VK_RETURN,
            "escape" | "esc" => VK_ESCAPE,
            "space" => VK_SPACE,
            "tab" => VK_TAB,
            _ => return Err(format!("Unsupported key: {}", key)),
        };

        unsafe {
            keybd_event(vk as u8, 0, 0, 0);
            std::thread::sleep(std::time::Duration::from_millis(20));
            keybd_event(vk as u8, 0, KEYEVENTF_KEYUP, 0);
        }
        Ok(())
    }

    /// Move the cursor to (x, y) without clicking.
    /// This is a real hover — SetCursorPos triggers mouse-move events
    /// that UI frameworks (Win32, web, etc.) respond to.
    pub fn simulate_hover_impl(x: i32, y: i32) -> Result<(), String> {
        unsafe {
            if SetCursorPos(x, y) == 0 {
                return Err("Failed to set cursor position".to_string());
            }
        }
        Ok(())
    }

    pub fn get_window_at_position_impl(x: i32, y: i32) -> Option<ElementInfo> {
        unsafe {
            // Use WindowFromPoint via point structure
            let point = POINT { x, y };
            let hwnd = WindowFromPoint(point);
            if hwnd.is_null() {
                return None;
            }

            let mut title_buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), 512);
            let name = if len > 0 {
                String::from_utf16_lossy(&title_buf[..len as usize])
            } else {
                String::new()
            };

            let mut rect = std::mem::zeroed::<WINDOWINFO>();
            rect.cbSize = std::mem::size_of::<WINDOWINFO>() as u32;
            let _ = GetWindowInfo(hwnd, &mut rect);

            let bounds = (
                rect.rcWindow.left,
                rect.rcWindow.top,
                rect.rcWindow.right - rect.rcWindow.left,
                rect.rcWindow.bottom - rect.rcWindow.top,
            );

            Some(ElementInfo {
                name,
                element_type: "window".to_string(),
                bounds,
                is_clickable: true,
            })
        }
    }

    pub fn get_element_info_impl(x: i32, y: i32) -> Option<ElementInfo> {
        get_window_at_position_impl(x, y)
    }
}

#[cfg(not(target_os = "windows"))]
mod stub_impl {
    use super::*;

    pub fn simulate_click_impl(_x: i32, _y: i32, _button: &str) -> Result<(), String> {
        Err("Experimental mode is only supported on Windows".to_string())
    }

    pub fn simulate_key_impl(_key: &str) -> Result<(), String> {
        Err("Experimental mode is only supported on Windows".to_string())
    }

    pub fn simulate_hover_impl(_x: i32, _y: i32) -> Result<(), String> {
        Err("Experimental mode is only supported on Windows".to_string())
    }

    pub fn get_window_at_position_impl(_x: i32, _y: i32) -> Option<ElementInfo> {
        None
    }

    pub fn get_element_info_impl(_x: i32, _y: i32) -> Option<ElementInfo> {
        None
    }
}

#[tauri::command]
pub fn simulate_click(x: i32, y: i32, button: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    { windows_impl::simulate_click_impl(x, y, &button) }
    #[cfg(not(target_os = "windows"))]
    { stub_impl::simulate_click_impl(x, y, &button) }
}

#[tauri::command]
pub fn simulate_key(key: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    { windows_impl::simulate_key_impl(&key) }
    #[cfg(not(target_os = "windows"))]
    { stub_impl::simulate_key_impl(&key) }
}

#[tauri::command]
pub fn simulate_hover(x: i32, y: i32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    { windows_impl::simulate_hover_impl(x, y) }
    #[cfg(not(target_os = "windows"))]
    { stub_impl::simulate_hover_impl(x, y) }
}

#[tauri::command]
pub fn get_window_at_position(x: i32, y: i32) -> Option<ElementInfo> {
    #[cfg(target_os = "windows")]
    { windows_impl::get_window_at_position_impl(x, y) }
    #[cfg(not(target_os = "windows"))]
    { stub_impl::get_window_at_position_impl(x, y) }
}

#[tauri::command]
pub fn get_element_info(x: i32, y: i32) -> Option<ElementInfo> {
    #[cfg(target_os = "windows")]
    { windows_impl::get_element_info_impl(x, y) }
    #[cfg(not(target_os = "windows"))]
    { stub_impl::get_element_info_impl(x, y) }
}
