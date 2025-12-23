use std::time::{Duration, Instant};

use crate::node::build_route_suggestion;
use crate::protocol::{
    ErrorCode, LtpIncomingMessage, LtpOutgoingMessage, TimeOrientationBoostPayload,
    TimeOrientationDirectionPayload,
};
use crate::state::LtpNodeState;
use crate::{process_message, validate_api_key, AppContext, Config, Metrics, TokenBucket};
use std::sync::Arc;

#[tokio::test]
async fn updates_orientation_state() {
    let state = LtpNodeState::new();
    let payload = TimeOrientationBoostPayload {
        direction: TimeOrientationDirectionPayload::Future,
        strength: 0.9,
    };

    state
        .update_orientation("session-1", Some(0.8), Some(payload.clone()))
        .await;

    let stored = state.snapshot("session-1").await.unwrap();
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
        .update_orientation("session-1", Some(0.8), Some(payload.clone()))
        .await;

    let suggestion = build_route_suggestion(&state, "session-1").await;
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
    let removed = state.expire_idle(std::time::Duration::from_millis(0));
    assert_eq!(removed.expired, 1);
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

#[tokio::test]
async fn validate_api_key_accepts_and_rejects() {
    let mut cfg = test_config();
    cfg.api_keys = vec!["valid-key".to_string()];
    assert!(validate_api_key("valid-key", &cfg).is_some());
    assert!(validate_api_key("invalid", &cfg).is_none());
}

#[tokio::test]
async fn rejects_mismatched_session_id() {
    let ctx = test_app_context();
    let auth = crate::AuthContext {
        auth_id: "auth".to_string(),
        session_id: "correct-session".to_string(),
    };
    let result = process_message(
        LtpIncomingMessage::Heartbeat {
            session_id: "wrong-session".to_string(),
            timestamp_ms: 1,
        },
        &ctx,
        &auth,
    )
    .await
    .unwrap();
    match &result[0] {
        LtpOutgoingMessage::Error { code, .. } => assert_eq!(code, &ErrorCode::Forbidden),
        _ => panic!("expected forbidden error"),
    }
}

#[tokio::test]
async fn token_bucket_enforces_limit() {
    let mut bucket = TokenBucket::new(2, 2);
    assert!(bucket.try_consume());
    assert!(bucket.try_consume());
    assert!(!bucket.try_consume());
}

fn test_config() -> Config {
    Config {
        addr: "127.0.0.1:1".to_string(),
        node_id: "node-test".to_string(),
        metrics_addr: "127.0.0.1:9090".to_string(),
        max_connections: 10,
        max_message_bytes: 1024,
        max_sessions_total: 100,
        handshake_timeout_ms: 1000,
        idle_ttl_ms: 1000,
        gc_interval_ms: 1000,
        api_keys: vec![],
        rate_limit_rps: 10,
        rate_limit_burst: 20,
    }
}

fn test_app_context() -> AppContext {
    let config = Arc::new(test_config());
    let metrics = Arc::new(Metrics::new().expect("metrics"));
    let state = Arc::new(LtpNodeState::new());
    AppContext {
        config,
        state,
        metrics,
    }
}
