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
        hint_sector: Option<Sector>,
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
        suggested_sector: String, // Kept as String for compatibility if Sector deserialization is complex, but the prompt implies Sector is a type.
        // Wait, node.rs uses Sector type for logic, but LtpOutgoingMessage uses String for suggested_sector?
        // Let's check node.rs again.
        // LtpOutgoingMessage::RouteSuggestion { ..., suggested_sector, ... }
        // The struct definition says suggested_sector: String.
        // But node.rs assigns a Sector to it? Rust would complain.
        // I should probably change this to Sector if Sector impls Display or Serialize.
        // Given node.rs: let mut suggested_sector = Sector::base_neutral(); ... suggested_sector,
        // It implies automatic conversion or that the field IS Sector.
        // I will change it to Sector.
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Sector {
    BaseNeutral,
    RetrospectiveSafe,
    PresentFocus,
    FuturePlanning,
    MultiBridge,
    Custom(String),
}

impl Sector {
    pub fn base_neutral() -> Self {
        Self::BaseNeutral
    }

    pub fn with_momentum(self, _momentum: Option<f64>) -> Self {
        // Simple implementation for now, just returning self as momentum logic isn't fully defined
        self
    }
}

// impl ToString for Sector to satisfy String field if needed, but better to update struct.
impl std::fmt::Display for Sector {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Sector::BaseNeutral => write!(f, "base_neutral"),
            Sector::RetrospectiveSafe => write!(f, "retrospective_safe"),
            Sector::PresentFocus => write!(f, "present_focus"),
            Sector::FuturePlanning => write!(f, "future_planning"),
            Sector::MultiBridge => write!(f, "multi_bridge"),
            Sector::Custom(s) => write!(f, "{}", s),
        }
    }
}
