use std::time::{Duration, Instant};

use crate::node::build_route_suggestion;
use crate::protocol::{
    LtpOutgoingMessage, Sector, TimeOrientationBoostPayload, TimeOrientationDirectionPayload,
};
use crate::state::LtpNodeState;

#[tokio::test]
async fn updates_orientation_state() {
    let state = LtpNodeState::new();
    let payload = TimeOrientationBoostPayload {
        direction: TimeOrientationDirectionPayload::Future,
        strength: 0.9,
    };

    state
        .update_orientation("client-1", Some(0.8), Some(payload.clone()))
        .await;

    let stored = state.snapshot("client-1").await.unwrap();
    assert_eq!(stored.focus_momentum, Some(0.8));
    assert_eq!(stored.time_orientation.as_ref(), Some(&payload));
}

#[tokio::test]
async fn builds_route_suggestion_with_orientation() {
    let state = LtpNodeState::new();
    let payload = TimeOrientationBoostPayload {
        direction: TimeOrientationDirectionPayload::Future,
        strength: 0.9,
    };
    state
        .update_orientation("client-1", Some(0.8), Some(payload.clone()))
        .await;

    let suggestion = build_route_suggestion(&state, "client-1").await;
    match suggestion {
        LtpOutgoingMessage::RouteSuggestion {
            suggested_sector,
            reason,
            debug,
            ..
        } => {
            assert_eq!(suggested_sector, Sector::FuturePlanningHighMomentum);
            assert!(reason.unwrap_or_default().len() > 0);
            let debug = debug.expect("debug block should be set");
            assert_eq!(debug.time_orientation.as_ref(), Some(&payload));
        }
        _ => panic!("expected route suggestion"),
    }
}

#[tokio::test]
async fn builds_default_route_when_no_state() {
    let state = LtpNodeState::new();
    let suggestion = build_route_suggestion(&state, "unknown-client").await;
    match suggestion {
        LtpOutgoingMessage::RouteSuggestion {
            suggested_sector,
            reason,
            debug,
            ..
        } => {
            assert_eq!(suggested_sector, Sector::Neutral);
            assert_eq!(reason, Some("default".to_string()));
            assert!(debug.is_some());
        }
        _ => panic!("expected route suggestion"),
    }
}

#[tokio::test]
async fn expires_idle_sessions() {
    let state = LtpNodeState::new();
    state.touch_heartbeat("stale-client").await;
    let removed = state.expire_idle(Duration::from_millis(0));
    assert_eq!(removed.expired, 1);
}

#[tokio::test]
async fn expire_idle_removes_old_sessions_and_updates_stats() {
    let state = LtpNodeState::new();
    let ttl = Duration::from_millis(50);

    state.touch_heartbeat("old-1").await;
    state.touch_heartbeat("old-2").await;
    state.touch_heartbeat("fresh").await;

    state
        .set_last_seen_for_test("old-1", Instant::now() - ttl * 2)
        .await;
    state
        .set_last_seen_for_test("old-2", Instant::now() - ttl * 3)
        .await;
    state
        .set_last_seen_for_test("fresh", Instant::now() - ttl / 4)
        .await;

    let stats = state.expire_idle(ttl);
    assert_eq!(stats.expired, 2);
    assert_eq!(state.len(), 1);
    assert!(stats.scanned >= 3);
}

#[tokio::test]
async fn expire_idle_keeps_recent_sessions() {
    let state = LtpNodeState::new();
    let ttl = Duration::from_secs(1);

    state.touch_heartbeat("recent").await;
    state
        .set_last_seen_for_test("recent", Instant::now() - ttl / 2)
        .await;

    let stats = state.expire_idle(ttl);
    assert_eq!(stats.expired, 0);
    assert_eq!(state.len(), 1);
}

#[tokio::test]
async fn expire_idle_handles_future_last_seen_without_panic() {
    let state = LtpNodeState::new();
    let ttl = Duration::from_millis(10);

    state.touch_heartbeat("future").await;
    state
        .set_last_seen_for_test("future", Instant::now() + ttl)
        .await;

    let stats = state.expire_idle(ttl);
    assert_eq!(stats.expired, 0);
    assert_eq!(state.len(), 1);
}

#[tokio::test]
async fn heartbeat_updates_last_seen() {
    let state = LtpNodeState::new();
    state.touch_heartbeat("client-1").await;
    let before = state.snapshot("client-1").await.unwrap().last_seen;

    tokio::time::sleep(std::time::Duration::from_millis(5)).await;
    state.touch_heartbeat("client-1").await;
    let after = state.snapshot("client-1").await.unwrap().last_seen;
    assert!(after > before);
}

#[test]
fn sector_round_trips() {
    let sector = Sector::FuturePlanningLowMomentum;
    let serialized = serde_json::to_string(&sector).unwrap();
    assert_eq!(serialized, "\"future_planning_low_momentum\"");
    let deserialized: Sector = serde_json::from_str(&serialized).unwrap();
    assert_eq!(deserialized, sector);
}
