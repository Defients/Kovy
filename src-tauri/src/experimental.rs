//! Physical OS input is deliberately unavailable in M1. No Win32 input functions
//! are linked here. Kept config values do not grant a validated app/focus target.
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use crate::{policy::AppliedPolicy, AppState};

#[derive(Clone, Default, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Target { pub id: String, pub x: f64, pub y: f64 }
impl Target {
    pub fn valid(&self) -> bool {
        (self.id.starts_with("toy:") || self.id.starts_with("habitat:")) && self.id.len() <= 128
            && self.x.is_finite() && self.y.is_finite()
            && (0.0..=65536.0).contains(&self.x) && (0.0..=65536.0).contains(&self.y)
    }
}

pub trait InputAdapter { fn dispatch(&mut self, target: &Target, action: &str) -> Result<(), String>; }
struct UnavailableInput;
impl InputAdapter for UnavailableInput {
    fn dispatch(&mut self, _: &Target, _: &str) -> Result<(), String> {
        Err("Physical desktop input is unavailable pending native target validation".into())
    }
}
#[derive(Default)]
pub struct ActionGate { last: Option<Instant> }
impl ActionGate {
    pub fn dispatch(&mut self, policy: &AppliedPolicy, paused: bool, target: &Target, action: &str,
                    now: Instant, input: &mut impl InputAdapter) -> Result<(), String> {
        if paused || !policy.experimental_enabled || !policy.experimental_opt_in
            || policy.target_mode != "toys" || !target.valid()
            || !policy.targets.contains(target) || !matches!(action, "click" | "hover")
            || !policy.actions.iter().any(|a| a == action) {
            return Err("Experimental action denied by policy".into());
        }
        if self.last.is_some_and(|last| now.saturating_duration_since(last) < Duration::from_secs(policy.cooldown_secs.max(1))) {
            return Err("Experimental cooldown active".into());
        }
        self.last = Some(now); // Reservation includes failures; protected by native mutex.
        input.dispatch(target, action)
    }
}
#[tauri::command]
pub fn experimental_interact(state: tauri::State<'_, AppState>, revision: u64, target: Target, action: String) -> Result<(), String> {
    let mut gate = state.actions.lock();
    if revision != state.authority.revision() { return Err("Stale experimental policy".into()); }
    let (policy, paused) = state.authority.action_policy();
    gate.dispatch(&policy, paused, &target, &action, Instant::now(), &mut UnavailableInput)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[derive(Default)] struct FakeInput(usize);
    impl InputAdapter for FakeInput {
        fn dispatch(&mut self, _: &Target, _: &str) -> Result<(), String> { self.0 += 1; Ok(()) }
    }
    #[test]
    fn fake_input_enforces_consent_target_action_pause_and_cooldown() {
        let target = Target { id: "toy:ball".into(), x: 10.0, y: 20.0 };
        let mut p = AppliedPolicy { experimental_enabled: true, experimental_opt_in: true,
            target_mode: "toys".into(), actions: vec!["click".into(), "type".into()], targets: vec![target.clone()],
            cooldown_secs: 5, ..Default::default() };
        let mut gate = ActionGate::default(); let mut fake = FakeInput::default(); let now = Instant::now();
        assert!(gate.dispatch(&p, true, &target, "click", now, &mut fake).is_err());
        assert!(gate.dispatch(&p, false, &target, "type", now, &mut fake).is_err());
        let bad = Target { x: f64::NAN, ..target.clone() };
        assert!(gate.dispatch(&p, false, &bad, "click", now, &mut fake).is_err());
        p.target_mode = "allowlist".into();
        assert!(gate.dispatch(&p, false, &target, "click", now, &mut fake).is_err());
        p.target_mode = "toys".into(); p.experimental_opt_in = false;
        assert!(gate.dispatch(&p, false, &target, "click", now, &mut fake).is_err());
        p.experimental_opt_in = true;
        assert!(gate.dispatch(&p, false, &target, "click", now, &mut fake).is_ok());
        assert!(gate.dispatch(&p, false, &target, "click", now, &mut fake).is_err());
        assert!(gate.dispatch(&p, false, &target, "click", now + Duration::from_secs(5), &mut fake).is_ok());
        assert_eq!(fake.0, 2);
    }
    #[test]
    fn production_adapter_never_sends_os_input() {
        assert!(UnavailableInput.dispatch(&Target::default(), "click").is_err());
    }
}
