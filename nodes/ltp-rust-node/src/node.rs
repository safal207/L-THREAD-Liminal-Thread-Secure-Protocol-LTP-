use crate::protocol::{
    LtpOutgoingMessage, RouteDebugInfo, TimeOrientationBoostPayload, TimeOrientationDirectionPayload,
};
use crate::state::LtpNodeState;

pub fn build_route_suggestion(state: &LtpNodeState, client_id: &str) -> LtpOutgoingMessage {
    let client_state = state.get_client_state(client_id);

    let mut suggested_sector = "neutral".to_string();
    let mut reason = String::from("default");

    let mut fm = None;
    let mut to: Option<TimeOrientationBoostPayload> = None;

    if let Some(cs) = client_state {
        fm = cs.focus_momentum;
        to = cs.time_orientation.clone();

        if let Some(orientation) = &cs.time_orientation {
            match orientation.direction {
                TimeOrientationDirectionPayload::Past => {
                    suggested_sector = "retrospective_safe".to_string();
                    reason = "client leaning towards past".to_string();
                }
                TimeOrientationDirectionPayload::Present => {
                    suggested_sector = "present_focus".to_string();
                    reason = "client is present-oriented".to_string();
                }
                TimeOrientationDirectionPayload::Future => {
                    suggested_sector = "future_planning".to_string();
                    reason = "client oriented to future".to_string();
                }
                TimeOrientationDirectionPayload::Multi => {
                    suggested_sector = "multi_bridge".to_string();
                    reason = "client in multi-temporal state".to_string();
                }
            }
        }

        if let Some(m) = cs.focus_momentum {
            if m > 0.7 {
                suggested_sector.push_str("_high_momentum");
            } else if m < 0.3 {
                suggested_sector.push_str("_low_momentum");
            }
        }
    }

    LtpOutgoingMessage::RouteSuggestion {
        client_id: client_id.to_string(),
        suggested_sector,
        reason: Some(reason),
        debug: Some(RouteDebugInfo {
            focus_momentum: fm,
            time_orientation: to,
        }),
    }
}
