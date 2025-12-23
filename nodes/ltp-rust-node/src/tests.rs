use std::time::{Duration, Instant};

use crate::node::build_route_suggestion;
use crate::protocol::{
    ErrorCode, LtpIncomingMessage, LtpOutgoingMessage, Sector, TimeOrientationBoostPayload,
    TimeOrientationDirectionPayload,
};
use crate::state::LtpNodeState;
use crate::{process_message, AppContext, AuthConfig, AuthMode, Config, Metrics, TokenBucket};
use dashmap::DashMap;
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::sync::Mutex;

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
            assert_eq!(suggested_sector, Sector::FuturePlanning.to_string());
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
            assert_eq!(suggested_sector, Sector::BaseNeutral.to_string());
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
    let cfg = test_config();
    {
        let mut keys = cfg.auth.keys.write().unwrap();
        keys.insert("valid-id".to_string(), "valid-key".to_string());
    }
    assert!(cfg.auth.validate_api_key("valid-key").unwrap().is_some());
    assert!(cfg.auth.validate_api_key("invalid").unwrap().is_none());
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
    let mut bucket = TokenBucket::new(2.0, 2.0);
    assert!(bucket.allow());
    assert!(bucket.allow());
    assert!(!bucket.allow());
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
        rate_limit_rps: 10.0,
        rate_limit_burst: 20.0,
        ip_rate_limit_rps: 10.0,
        ip_rate_limit_burst: 20.0,
        ip_rate_limit_ttl_secs: 60,
        auth: AuthConfig {
            mode: AuthMode::ApiKey,
            keys: Arc::new(std::sync::RwLock::new(HashMap::new())),
            jwt_secret: None,
            keys_file: None,
            keys_reload_interval: Duration::from_secs(60),
            last_loaded_hash: Arc::new(Mutex::new(None)),
            fail_closed: Arc::new(AtomicBool::new(false)),
        },
        trust_proxy: false,
        audit_log_file: "test_audit.log".to_string(),
    }
}

fn test_app_context() -> AppContext {
    let config = Arc::new(test_config());
    let metrics = Arc::new(Metrics::new().expect("metrics"));
    let state = Arc::new(LtpNodeState::new());
    // In unit tests, we can't easily await inside non-async fn if not wrapped.
    // But test_app_context is called by async tests?
    // Wait, rejects_mismatched_session_id is #[tokio::test] async.
    // So I can block_on or change signature.
    // Since this is a test helper, I'll use futures::executor::block_on or just make it async if possible.
    // But it's a fn, not async fn.
    // I will use tokio::runtime::Runtime or just block_in_place if inside tokio.
    // Actually, I can just use `futures::executor::block_on` if I add `futures` dev-dep.
    // Or just make it async.
    // But `process_message` uses it.

    // Easier: Just spin up a runtime for this call since it's just for test init.
    // Or make test_app_context async.

    // Handle tests that are already inside a runtime (panic: Cannot start a runtime from within a runtime)
    // and tests that are not.
    // Simply use std::thread::spawn to avoid current-thread runtime issues if necessary
    // But since this is a test and we just need an instance...
    // The issue is `block_in_place` requires multithreaded runtime, but some tests run in current_thread.
    // I can just change `test_app_context` to be async!
    // But `process_message` uses `&AppContext`.
    // Let's make `test_app_context` async and await it in tests.

    // But refactoring all tests is annoying.
    // Hack: spawn a thread to run the runtime block_on.
    let log_file = config.audit_log_file.clone();
    let tracer = Arc::new(std::thread::spawn(move || {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            crate::trace::TraceLogger::new(&log_file).await.unwrap()
        })
    }).join().unwrap());

    AppContext {
        config,
        state,
        metrics,
        ip_limiters: Arc::new(DashMap::new()),
        log_throttle: Arc::new(crate::LogThrottle::default()),
        tracer,
    }
}
