use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum LtpIncomingMessage {
    Hello {
        api_key: String,
        #[serde(default)]
        client_label: Option<String>,
    },
    Heartbeat {
        session_id: String,
        timestamp_ms: i64,
    },
    Orientation {
        session_id: String,
        focus_momentum: Option<f64>,
        #[serde(default)]
        time_orientation: Option<TimeOrientationBoostPayload>,
    },
    RouteRequest {
        session_id: String,
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
        session_id: String,
    },
    HeartbeatAck {
        session_id: String,
        timestamp_ms: i64,
    },
    RouteSuggestion {
        session_id: String,
        suggested_sector: String,
        #[serde(default)]
        reason: Option<String>,
        #[serde(default)]
        debug: Option<RouteDebugInfo>,
    },
    Error {
        code: ErrorCode,
        #[serde(default)]
        message: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RouteDebugInfo {
    #[serde(default)]
    pub focus_momentum: Option<f64>,
    #[serde(default)]
    pub time_orientation: Option<TimeOrientationBoostPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    Unauthorized,
    Forbidden,
    RateLimit,
    Invalid,
}
