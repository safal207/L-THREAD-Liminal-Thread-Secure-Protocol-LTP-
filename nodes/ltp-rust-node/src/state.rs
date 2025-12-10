use std::collections::HashMap;
use std::time::Instant;

use crate::protocol::TimeOrientationBoostPayload;

#[derive(Debug, Clone)]
pub struct ClientOrientationState {
    pub last_heartbeat: Instant,
    pub focus_momentum: Option<f64>,
    pub time_orientation: Option<TimeOrientationBoostPayload>,
}

#[derive(Debug, Default)]
pub struct LtpNodeState {
    clients: HashMap<String, ClientOrientationState>,
}

impl LtpNodeState {
    pub fn new() -> Self {
        Self {
            clients: HashMap::new(),
        }
    }

    pub fn touch_heartbeat(&mut self, client_id: &str) {
        let entry = self
            .clients
            .entry(client_id.to_owned())
            .or_insert(ClientOrientationState {
                last_heartbeat: Instant::now(),
                focus_momentum: None,
                time_orientation: None,
            });
        entry.last_heartbeat = Instant::now();
    }

    pub fn update_orientation(
        &mut self,
        client_id: &str,
        focus_momentum: Option<f64>,
        time_orientation: Option<TimeOrientationBoostPayload>,
    ) {
        let entry = self
            .clients
            .entry(client_id.to_owned())
            .or_insert(ClientOrientationState {
                last_heartbeat: Instant::now(),
                focus_momentum: None,
                time_orientation: None,
            });
        if let Some(fm) = focus_momentum {
            entry.focus_momentum = Some(fm);
        }
        if time_orientation.is_some() {
            entry.time_orientation = time_orientation;
        }
    }

    pub fn get_client_state(&self, client_id: &str) -> Option<&ClientOrientationState> {
        self.clients.get(client_id)
    }
}
