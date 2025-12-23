use std::sync::Arc;
use std::time::{Duration, Instant};

use dashmap::DashMap;
use tokio::sync::Mutex;

use crate::protocol::TimeOrientationBoostPayload;

#[derive(Debug, Clone)]
pub struct SessionState {
    pub last_seen: Instant,
    pub focus_momentum: Option<f64>,
    pub time_orientation: Option<TimeOrientationBoostPayload>,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            last_seen: Instant::now(),
            focus_momentum: None,
            time_orientation: None,
        }
    }

    pub fn update_last_seen(&mut self) {
        self.last_seen = Instant::now();
    }
}

#[derive(Debug, Default)]
pub struct LtpNodeState {
    sessions: DashMap<String, Arc<Mutex<SessionState>>>,
}

#[derive(Debug, Default)]
pub struct ExpireStats {
    pub expired: usize,
    pub skipped_locks: usize,
    pub scanned: usize,
    pub sweep_ms: u128,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SessionSnapshot {
    pub last_seen: Instant,
    pub focus_momentum: Option<f64>,
    pub time_orientation: Option<TimeOrientationBoostPayload>,
}

impl LtpNodeState {
    pub fn new() -> Self {
        Self {
            sessions: DashMap::new(),
        }
    }

    pub fn len(&self) -> usize {
        self.sessions.len()
    }

    pub async fn touch_heartbeat(&self, session_id: &str) -> bool {
        let mut created = false;
        let session = self
            .sessions
            .entry(session_id.to_owned())
            .or_insert_with(|| {
                created = true;
                Arc::new(Mutex::new(SessionState::new()))
            })
            .clone();
        let mut guard = session.lock().await;
        guard.update_last_seen();
        created
    }

    pub async fn update_orientation(
        &self,
        session_id: &str,
        focus_momentum: Option<f64>,
        time_orientation: Option<TimeOrientationBoostPayload>,
    ) -> bool {
        let mut created = false;
        let session = self
            .sessions
            .entry(session_id.to_owned())
            .or_insert_with(|| {
                created = true;
                Arc::new(Mutex::new(SessionState::new()))
            })
            .clone();
        let mut guard = session.lock().await;
        if let Some(fm) = focus_momentum {
            guard.focus_momentum = Some(fm);
        }
        if time_orientation.is_some() {
            guard.time_orientation = time_orientation;
        }
        guard.update_last_seen();
        created
    }

    pub async fn snapshot(&self, session_id: &str) -> Option<SessionSnapshot> {
        let session = self.sessions.get(session_id)?.clone();
        let guard = session.lock().await;
        Some(SessionSnapshot {
            last_seen: guard.last_seen,
            focus_momentum: guard.focus_momentum,
            time_orientation: guard.time_orientation.clone(),
        })
    }

    pub fn remove(&self, session_id: &str) -> bool {
        self.sessions.remove(session_id).is_some()
    }

    pub fn expire_idle(&self, idle_ttl: Duration) -> ExpireStats {
        let sweep_start = Instant::now();
        let mut stats = ExpireStats::default();
        let first_pass_now = sweep_start;
        let keys: Vec<String> = self
            .sessions
            .iter()
            .filter_map(|entry| {
                stats.scanned += 1;
                let session = entry.value();
                match session.try_lock() {
                    Ok(guard) => {
                        let idle = first_pass_now
                            .checked_duration_since(guard.last_seen)
                            .unwrap_or(Duration::ZERO);
                        if idle >= idle_ttl {
                            Some(entry.key().clone())
                        } else {
                            None
                        }
                    }
                    Err(_) => {
                        stats.skipped_locks += 1;
                        None
                    }
                }
            })
            .collect();

        let confirm_now = Instant::now();
        for key in keys {
            if let Some(session) = self.sessions.get(&key).map(|entry| entry.value().clone()) {
                match session.try_lock() {
                    Ok(guard) => {
                        let idle = confirm_now
                            .checked_duration_since(guard.last_seen)
                            .unwrap_or(Duration::ZERO);
                        if idle >= idle_ttl && self.sessions.remove(&key).is_some() {
                            stats.expired += 1;
                        }
                    }
                    Err(_) => {
                        stats.skipped_locks += 1;
                    }
                }
            }
        }

        stats.sweep_ms = sweep_start.elapsed().as_millis();
        stats
    }
}
