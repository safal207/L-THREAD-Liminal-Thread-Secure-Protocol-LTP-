use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum LtpIncomingMessage {
    Hello {
        client_id: String,
        #[serde(default)]
        session_tag: Option<String>,
        #[serde(default)]
        auth_token: Option<String>,
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
    },
    HeartbeatAck {
        client_id: String,
        timestamp_ms: i64,
    },
    RouteSuggestion {
        client_id: String,
        suggested_sector: Sector,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Sector {
    Neutral,
    NeutralHighMomentum,
    NeutralLowMomentum,
    RetrospectiveSafe,
    RetrospectiveSafeHighMomentum,
    RetrospectiveSafeLowMomentum,
    PresentFocus,
    PresentFocusHighMomentum,
    PresentFocusLowMomentum,
    FuturePlanning,
    FuturePlanningHighMomentum,
    FuturePlanningLowMomentum,
    MultiBridge,
    MultiBridgeHighMomentum,
    MultiBridgeLowMomentum,
}

impl Sector {
    pub fn base_neutral() -> Self {
        Sector::Neutral
    }

    pub fn with_momentum(self, focus_momentum: Option<f64>) -> Self {
        let momentum = match focus_momentum {
            Some(v) if v > 0.7 => Some(Momentum::High),
            Some(v) if v < 0.3 => Some(Momentum::Low),
            _ => None,
        };

        match (self, momentum) {
            (Sector::Neutral, Some(Momentum::High)) => Sector::NeutralHighMomentum,
            (Sector::Neutral, Some(Momentum::Low)) => Sector::NeutralLowMomentum,
            (Sector::RetrospectiveSafe, Some(Momentum::High)) => {
                Sector::RetrospectiveSafeHighMomentum
            }
            (Sector::RetrospectiveSafe, Some(Momentum::Low)) => {
                Sector::RetrospectiveSafeLowMomentum
            }
            (Sector::PresentFocus, Some(Momentum::High)) => Sector::PresentFocusHighMomentum,
            (Sector::PresentFocus, Some(Momentum::Low)) => Sector::PresentFocusLowMomentum,
            (Sector::FuturePlanning, Some(Momentum::High)) => Sector::FuturePlanningHighMomentum,
            (Sector::FuturePlanning, Some(Momentum::Low)) => Sector::FuturePlanningLowMomentum,
            (Sector::MultiBridge, Some(Momentum::High)) => Sector::MultiBridgeHighMomentum,
            (Sector::MultiBridge, Some(Momentum::Low)) => Sector::MultiBridgeLowMomentum,
            (base, _) => base,
        }
    }
}

enum Momentum {
    High,
    Low,
}
