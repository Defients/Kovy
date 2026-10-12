//! Native authority shared by insight, chat and experimental dispatch.
//! Defaults deny. Only settings may change grants; overlay may change runtime pause.
use crate::ai::AiError;
use parking_lot::Mutex;
use serde::Deserialize;
use std::{future::Future, sync::Arc};
use tokio::sync::watch;

#[derive(Clone, Default, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AppliedPolicy {
    pub ai_enabled: bool,
    pub chat_enabled: bool,
    pub screenshots: bool,
    pub foreground: bool,
    pub monitors: Vec<usize>,
    pub experimental_enabled: bool,
    pub experimental_opt_in: bool,
    pub target_mode: String,
    pub actions: Vec<String>,
    pub cooldown_secs: u64,
    pub targets: Vec<crate::experimental::Target>,
    #[serde(skip)]
    pub topology: Vec<String>,
}

struct Inner {
    policy: AppliedPolicy,
    revision: u64,
    paused: bool,
    active: Option<String>,
    cancelled: std::collections::VecDeque<String>,
}

pub struct Authority {
    inner: Mutex<Inner>,
    changed: watch::Sender<u64>,
}

impl Default for Authority {
    fn default() -> Self {
        Self {
            inner: Mutex::new(Inner {
                policy: AppliedPolicy::default(), revision: 0, paused: true, active: None,
                cancelled: std::collections::VecDeque::new(),
            }),
            changed: watch::channel(0).0,
        }
    }
}

impl Authority {
    pub fn apply(&self, window: &str, policy: AppliedPolicy) -> Result<u64, AiError> {
        if window != "settings" || policy.monitors.len() > 4
            || policy.monitors.iter().any(|i| *i > 31)
            || !matches!(policy.target_mode.as_str(), "toys" | "allowlist")
            || policy.actions.len() > 3
            || policy.actions.iter().any(|a| !matches!(a.as_str(), "click" | "hover" | "type"))
            || !(1..=3600).contains(&policy.cooldown_secs)
            || policy.targets.len() > 80 || policy.targets.iter().any(|t| !t.valid()) {
            return Err(AiError::PolicyDenied);
        }
        let mut inner = self.inner.lock();
        if inner.policy != policy {
            inner.policy = policy;
            inner.revision += 1;
            self.changed.send_replace(inner.revision);
        }
        Ok(inner.revision)
    }

    pub fn pause(&self, paused: bool) {
        let mut inner = self.inner.lock();
        if inner.paused != paused {
            inner.paused = paused;
            inner.revision += 1;
            self.changed.send_replace(inner.revision);
        }
    }

    pub fn revision(&self) -> u64 { self.inner.lock().revision }

    pub fn action_policy(&self) -> (AppliedPolicy, bool) {
        let inner = self.inner.lock();
        (inner.policy.clone(), inner.paused)
    }

    pub fn cancel(&self, id: &str) {
        if id.is_empty() || id.len() > 128 { return; }
        let mut inner = self.inner.lock();
        inner.cancelled.push_back(id.into());
        if inner.cancelled.len() > 64 { inner.cancelled.pop_front(); }
        if inner.active.as_deref() == Some(id) {
            inner.revision += 1;
            self.changed.send_replace(inner.revision);
        }
        // The slot stays occupied until its future and transport are dropped.
    }

    pub fn begin(self: &Arc<Self>, id: String, revision: u64, chat: bool,
                 screenshots: bool, foreground: bool, monitors: &[usize]) -> Result<Lease, AiError> {
        let mut inner = self.inner.lock();
        let p = &inner.policy;
        if id.is_empty() || id.len() > 128 || revision != inner.revision || inner.paused
            || inner.cancelled.contains(&id)
            || !p.ai_enabled || (chat && !p.chat_enabled)
            || (screenshots && (!p.screenshots || monitors.len() > 4 || monitors != p.monitors))
            || (foreground && !p.foreground) {
            return Err(AiError::PolicyDenied);
        }
        if inner.active.is_some() { return Err(AiError::Busy); }
        inner.active = Some(id.clone());
        Ok(Lease { authority: self.clone(), id, revision, changed: self.changed.subscribe(), topology: inner.policy.topology.clone() })
    }
}

pub struct Lease {
    authority: Arc<Authority>,
    id: String,
    revision: u64,
    changed: watch::Receiver<u64>,
    pub topology: Vec<String>,
}

impl Lease {
    /// Called before capture, immediately before transport, and before publication.
    pub fn check(&self) -> Result<(), AiError> {
        let inner = self.authority.inner.lock();
        if inner.revision != self.revision || inner.paused || inner.active.as_deref() != Some(&self.id) {
            return Err(AiError::Cancelled);
        }
        Ok(())
    }

    pub async fn run<T>(&self, work: impl Future<Output = Result<T, AiError>>) -> Result<T, AiError> {
        self.check()?;
        let mut changed = self.changed.clone();
        tokio::select! {
            biased;
            _ = changed.changed() => Err(AiError::Cancelled),
            result = work => { self.check()?; result }
        }
    }
}

impl Drop for Lease {
    fn drop(&mut self) {
        let mut inner = self.authority.inner.lock();
        if inner.active.as_deref() == Some(&self.id) { inner.active = None; }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn enabled() -> AppliedPolicy {
        AppliedPolicy { ai_enabled: true, chat_enabled: true, target_mode: "toys".into(),
            cooldown_secs: 5, ..Default::default() }
    }
    #[test]
    fn denies_caller_consent_and_wrong_window() {
        let a = Arc::new(Authority::default());
        assert!(a.apply("overlay", enabled()).is_err());
        a.pause(false);
        assert!(a.begin("a".into(), a.revision(), false, false, false, &[]).is_err());
        a.apply("settings", enabled()).unwrap();
        assert!(a.begin("a".into(), a.revision(), false, true, false, &[]).is_err());
        assert!(a.begin("a".into(), a.revision(), false, false, true, &[]).is_err());
        a.pause(true);
        assert!(a.begin("a".into(), a.revision(), false, false, false, &[]).is_err());
    }
    #[test]
    fn shared_slot_stays_reserved_until_cancelled_owner_drops() {
        let a = Arc::new(Authority::default());
        a.apply("settings", enabled()).unwrap(); a.pause(false);
        let owner = a.begin("insight".into(), a.revision(), false, false, false, &[]).unwrap();
        a.cancel("unrelated"); assert!(owner.check().is_ok());
        a.cancel("insight"); assert!(owner.check().is_err());
        assert!(a.begin("chat".into(), a.revision(), true, false, false, &[]).is_err());
        drop(owner);
        assert!(a.begin("chat".into(), a.revision(), true, false, false, &[]).is_ok());
    }
    #[tokio::test]
    async fn pause_drops_mock_transport_and_prevents_publication() {
        let a = Arc::new(Authority::default());
        a.apply("settings", enabled()).unwrap(); a.pause(false);
        let owner = a.begin("a".into(), a.revision(), false, false, false, &[]).unwrap();
        let work = async { a.pause(true); std::future::pending::<Result<(), AiError>>().await };
        assert!(matches!(owner.run(work).await, Err(AiError::Cancelled)));
    }
    #[test]
    fn consent_revision_monitor_and_chat_denials() {
        let a = Arc::new(Authority::default());
        let mut p = enabled(); p.chat_enabled = false; p.screenshots = true; p.monitors = vec![1];
        a.apply("settings", p).unwrap(); a.pause(false);
        assert!(a.begin("a".into(), 0, false, true, false, &[1]).is_err());
        assert!(a.begin("a".into(), a.revision(), false, true, false, &[0]).is_err());
        assert!(a.begin("a".into(), a.revision(), true, false, false, &[]).is_err());
        assert!(a.begin("a".into(), a.revision(), false, true, false, &[1]).is_ok());
    }
}
