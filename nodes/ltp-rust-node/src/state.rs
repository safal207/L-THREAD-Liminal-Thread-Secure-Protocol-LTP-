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

    pub async fn touch_heartbeat(&self, client_id: &str) -> bool {
        let mut created = false;
        let session = self
            .sessions
            .entry(client_id.to_owned())
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
        client_id: &str,
        focus_momentum: Option<f64>,
        time_orientation: Option<TimeOrientationBoostPayload>,
    ) -> bool {
        let mut created = false;
        let session = self
            .sessions
            .entry(client_id.to_owned())
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

    pub async fn snapshot(&self, client_id: &str) -> Option<SessionSnapshot> {
        let session = self.sessions.get(client_id)?.clone();
        let guard = session.lock().await;
        Some(SessionSnapshot {
            last_seen: guard.last_seen,
            focus_momentum: guard.focus_momentum,
            time_orientation: guard.time_orientation.clone(),
        })
    }

    pub fn remove(&self, client_id: &str) -> bool {
        self.sessions.remove(client_id).is_some()
    }

    pub fn expire_idle(&self, idle_ttl: Duration) -> ExpireStats {
        let sweep_start = Instant::now();
        let mut stats = ExpireStats::default();
        let keys: Vec<String> = self
            .sessions
            .iter()
            .filter_map(|entry| {
                let session = entry.value();
                stats.scanned += 1;
                if let Ok(guard) = session.try_lock() {
                    if sweep_start.duration_since(guard.last_seen) >= idle_ttl {
                        Some(entry.key().clone())
                    } else {
                        None
                    }
                } else {
                    stats.skipped_locks += 1;
                    None
                }
            })
            .collect();

        for key in keys {
            let still_idle = self.sessions.get(&key).and_then(|entry| {
                let session = entry.value();
                if let Ok(guard) = session.try_lock() {
                    if Instant::now().duration_since(guard.last_seen) >= idle_ttl {
                        Some(entry.key().clone())
                    } else {
                        None
                    }
                } else {
                    stats.skipped_locks += 1;
                    None
                }
            });

            if let Some(key) = still_idle {
                if self.sessions.remove(&key).is_some() {
                    stats.expired += 1;
                }
            }
        }
        stats
    }
}
