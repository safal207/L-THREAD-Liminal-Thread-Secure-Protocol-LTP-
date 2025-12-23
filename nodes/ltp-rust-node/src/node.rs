use crate::protocol::{
    LtpOutgoingMessage, RouteDebugInfo, Sector, TimeOrientationBoostPayload,
    TimeOrientationDirectionPayload,
};
use crate::state::LtpNodeState;

pub async fn build_route_suggestion(state: &LtpNodeState, session_id: &str) -> LtpOutgoingMessage {
    let client_state = state.snapshot(session_id).await;

    let mut suggested_sector = Sector::base_neutral();
    let mut reason = String::from("default");

    let mut fm = None;
    let mut to: Option<TimeOrientationBoostPayload> = None;

    if let Some(cs) = client_state {
        fm = cs.focus_momentum;
        to = cs.time_orientation.clone();

        if let Some(orientation) = &cs.time_orientation {
            match orientation.direction {
                TimeOrientationDirectionPayload::Past => {
                    suggested_sector = Sector::RetrospectiveSafe;
                    reason = "client leaning towards past".to_string();
                }
                TimeOrientationDirectionPayload::Present => {
                    suggested_sector = Sector::PresentFocus;
                    reason = "client is present-oriented".to_string();
                }
                TimeOrientationDirectionPayload::Future => {
                    suggested_sector = Sector::FuturePlanning;
                    reason = "client oriented to future".to_string();
                }
                TimeOrientationDirectionPayload::Multi => {
                    suggested_sector = Sector::MultiBridge;
                    reason = "client in multi-temporal state".to_string();
                }
            }
        }

        if let Some(m) = cs.focus_momentum {
            suggested_sector = suggested_sector.with_momentum(Some(m));
        }
    }

    LtpOutgoingMessage::RouteSuggestion {
        session_id: session_id.to_string(),
        suggested_sector: suggested_sector.to_string(), // Fixed mismatch
        reason: Some(reason),
        debug: Some(RouteDebugInfo {
            focus_momentum: fm,
            time_orientation: to,
        }),
    }
}
