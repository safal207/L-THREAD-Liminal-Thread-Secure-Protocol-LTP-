use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum LtpIncomingMessage {
    Hello {
        client_id: String,
        #[serde(default)]
        session_tag: Option<String>,
    },
    Heartbeat {
        client_id: String,
        timestamp_ms: i64,
    },
    Orientation {
        client_id: String,
        focus_momentum: Option<f64>,
        #[serde(default)]
        time_orientation: Option<TimeOrientationBoostPayload>,
    },
    RouteRequest {
        client_id: String,
        #[serde(default)]
        hint_sector: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimeOrientationBoostPayload {
    pub direction: TimeOrientationDirectionPayload,
    pub strength: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TimeOrientationDirectionPayload {
    Past,
    Present,
    Future,
    Multi,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum LtpOutgoingMessage {
    HelloAck {
        node_id: String,
        accepted: bool,
    },
    HeartbeatAck {
        client_id: String,
        timestamp_ms: i64,
    },
    RouteSuggestion {
        client_id: String,
        suggested_sector: String,
        #[serde(default)]
        reason: Option<String>,
        #[serde(default)]
        debug: Option<RouteDebugInfo>,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RouteDebugInfo {
    #[serde(default)]
    pub focus_momentum: Option<f64>,
    #[serde(default)]
    pub time_orientation: Option<TimeOrientationBoostPayload>,
}
