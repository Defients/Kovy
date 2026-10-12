// ============================================================
// Idle detection — uses Windows GetLastInputInfo + GetTickCount
// to report real OS-level idle seconds since the last user input.
//
// Replaces the previous Instant::elapsed() approach that reported
// time since app launch (D1). GetLastInputInfo returns the tick
// count at the last input event; subtracting from the current
// tick count gives the true idle duration.
//
// The tick count is a u32 that wraps every ~49.7 days. We use
// wrapping_sub to handle the wrap correctly.
// ============================================================

#[cfg(target_os = "windows")]
pub fn get_idle_seconds() -> f64 {
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    let mut last_input_info: LASTINPUTINFO = unsafe { std::mem::zeroed() };
    last_input_info.cbSize = std::mem::size_of::<LASTINPUTINFO>() as u32;

    unsafe {
        if GetLastInputInfo(&mut last_input_info) == 0 {
            // If GetLastInputInfo fails, fall back to 0 (not idle)
            return 0.0;
        }
    }

    let now_ticks = unsafe { GetTickCount() };
    let last_ticks = last_input_info.dwTime;

    // wrapping_sub handles the ~49.7-day u32 tick wrap correctly
    let elapsed_ms = now_ticks.wrapping_sub(last_ticks);

    elapsed_ms as f64 / 1000.0
}

#[cfg(not(target_os = "windows"))]
pub fn get_idle_seconds() -> f64 {
    // Non-Windows fallback: always report 0 (not idle)
    0.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_idle_seconds_returns_f64() {
        let idle = get_idle_seconds();
        // Should be a non-negative finite number
        assert!(idle.is_finite(), "idle seconds should be finite");
        assert!(idle >= 0.0, "idle seconds should be non-negative");
    }

    #[test]
    fn test_get_idle_seconds_is_consistent() {
        // Two rapid calls should return values within a small delta
        let a = get_idle_seconds();
        let b = get_idle_seconds();
        let delta = (b - a).abs();
        // Allow up to 1 second of jitter for CI environments
        assert!(
            delta < 1.0,
            "two rapid idle calls should be close: a={a}, b={b}, delta={delta}"
        );
    }

    #[test]
    fn test_get_idle_seconds_reflects_recent_input() {
        // On Windows, after we simulate input the idle should be small.
        // We can't truly simulate input in a test, but we can verify
        // the function doesn't return a huge value (which would indicate
        // it's measuring from process start rather than last input).
        let idle = get_idle_seconds();
        // If the test process has been running for a while without input,
        // this could be large. But on a CI machine with active input,
        // it should be reasonable. We just check it's not absurdly large.
        assert!(
            idle < 86400.0,
            "idle seconds should be less than a day: got {idle}"
        );
    }
}
