use crate::node::build_route_suggestion;
use crate::protocol::{
    LtpOutgoingMessage, TimeOrientationBoostPayload, TimeOrientationDirectionPayload,
};
use crate::state::LtpNodeState;

#[test]
fn updates_orientation_state() {
    let mut state = LtpNodeState::new();
    let payload = TimeOrientationBoostPayload {
        direction: TimeOrientationDirectionPayload::Future,
        strength: 0.9,
    };

    state.update_orientation("client-1", Some(0.8), Some(payload.clone()));

    let stored = state.get_client_state("client-1").unwrap();
    assert_eq!(stored.focus_momentum, Some(0.8));
    assert_eq!(stored.time_orientation.as_ref(), Some(&payload));
}

#[test]
fn builds_route_suggestion_with_orientation() {
    let mut state = LtpNodeState::new();
    let payload = TimeOrientationBoostPayload {
        direction: TimeOrientationDirectionPayload::Future,
        strength: 0.9,
    };
    state.update_orientation("client-1", Some(0.8), Some(payload.clone()));

    let suggestion = build_route_suggestion(&state, "client-1");
    match suggestion {
        LtpOutgoingMessage::RouteSuggestion {
            suggested_sector,
            reason,
            debug,
            ..
        } => {
            assert!(suggested_sector.contains("future_planning"));
            assert!(suggested_sector.contains("high_momentum"));
            assert!(reason.unwrap_or_default().len() > 0);
            let debug = debug.expect("debug block should be set");
            assert_eq!(debug.time_orientation.as_ref(), Some(&payload));
        }
        _ => panic!("expected route suggestion"),
    }
}

#[test]
fn builds_default_route_when_no_state() {
    let state = LtpNodeState::new();
    let suggestion = build_route_suggestion(&state, "unknown-client");
    match suggestion {
        LtpOutgoingMessage::RouteSuggestion {
            suggested_sector,
            reason,
            debug,
            ..
        } => {
            assert_eq!(suggested_sector, "neutral");
            assert_eq!(reason, Some("default".to_string()));
            assert!(debug.is_some());
        }
        _ => panic!("expected route suggestion"),
    }
}
