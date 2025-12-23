mod node;
mod protocol;
mod state;
#[cfg(test)]
mod tests;

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::Context;
use axum::{http::StatusCode, routing::get, Router};
use futures_util::{SinkExt, StreamExt};
use prometheus::{Encoder, Histogram, IntCounter, IntCounterVec, IntGauge, Registry, TextEncoder};
use protocol::{LtpIncomingMessage, LtpOutgoingMessage};
use rand::{rngs::StdRng, Rng, SeedableRng};
use tokio::net::TcpListener;
use tokio::signal;
use tokio::sync::watch;
use tokio::time::timeout;
use tokio_tungstenite::{
    accept_async,
    tungstenite::{
        protocol::{frame::coding::CloseCode, CloseFrame},
        Message, Result as WsResult,
    },
};
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::node::build_route_suggestion;
use crate::state::LtpNodeState;

const DEFAULT_ADDR: &str = "127.0.0.1:7070";
const DEFAULT_METRICS_ADDR: &str = "127.0.0.1:9090";

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

#[derive(Clone, Debug)]
struct Config {
    addr: String,
    node_id: String,
    metrics_addr: String,
    max_connections: usize,
    max_message_bytes: usize,
    max_sessions_total: usize,
    handshake_timeout_ms: u64,
    idle_ttl_ms: u64,
    gc_interval_ms: u64,
    api_keys: Vec<String>,
    rate_limit_rps: u64,
    rate_limit_burst: u64,
}

impl Config {
    fn from_env() -> Self {
        let addr = std::env::var("LTP_NODE_ADDR").unwrap_or_else(|_| DEFAULT_ADDR.to_string());
        let node_id =
            std::env::var("LTP_NODE_ID").unwrap_or_else(|_| format!("ltp-node-{}", Uuid::new_v4()));
        let metrics_addr = std::env::var("LTP_NODE_METRICS_ADDR")
            .unwrap_or_else(|_| DEFAULT_METRICS_ADDR.to_string());
        let max_connections = read_env_usize("LTP_NODE_MAX_CONNECTIONS", 10_000);
        let max_message_bytes = read_env_usize("LTP_NODE_MAX_MESSAGE_BYTES", 128 * 1024);
        let max_sessions_total = read_env_usize("LTP_NODE_MAX_SESSIONS", 50_000);
        let handshake_timeout_ms = read_env_u64("LTP_NODE_HANDSHAKE_TIMEOUT_MS", 5_000);
        let idle_ttl_ms = read_env_u64("LTP_NODE_IDLE_TTL_MS", 60_000);
        let gc_interval_ms = read_env_u64("LTP_NODE_GC_INTERVAL_MS", 10_000);
        let api_keys = read_api_keys();
        let rate_limit_rps = read_env_u64("LTP_RATE_LIMIT_RPS", 20);
        let rate_limit_burst = read_env_u64("LTP_RATE_LIMIT_BURST", 40);

        Self {
            addr,
            node_id,
            metrics_addr,
            max_connections,
            max_message_bytes,
            max_sessions_total,
            handshake_timeout_ms,
            idle_ttl_ms,
            gc_interval_ms,
            api_keys,
            rate_limit_rps,
            rate_limit_burst,
        }
    }
}

fn read_env_usize(key: &str, default: usize) -> usize {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(default)
}

fn read_env_u64(key: &str, default: u64) -> u64 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(default)
}

fn read_api_keys() -> Vec<String> {
    if let Ok(list) = std::env::var("LTP_API_KEYS") {
        list.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    } else if let Ok(single) = std::env::var("LTP_API_KEY") {
        if single.trim().is_empty() {
            vec![]
        } else {
            vec![single]
        }
    } else {
        vec![]
    }
}

fn auth_id_for_key(api_key: &str) -> String {
    let mut hasher = DefaultHasher::new();
    api_key.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn validate_api_key(api_key: &str, config: &Config) -> Option<String> {
    if config.api_keys.is_empty() {
        return None;
    }
    config
        .api_keys
        .iter()
        .find(|k| *k == api_key)
        .map(|_| auth_id_for_key(api_key))
}

struct Metrics {
    registry: Registry,
    connections: IntGauge,
    sessions: IntGauge,
    sessions_expired: IntCounterVec,
    messages_total: IntCounterVec,
    messages_rejected: IntCounterVec,
    janitor_sweep_duration: Histogram,
    janitor_skipped_lock: IntCounter,
    janitor_expired_last_sweep: IntGauge,
    capacity_rejections: IntCounter,
}

impl Metrics {
    fn new() -> anyhow::Result<Self> {
        let registry = Registry::new();
        let connections = IntGauge::new(
            "ltp_ws_connections_current",
            "Current websocket connections",
        )?;
        let sessions = IntGauge::new("ltp_sessions_total", "Current tracked sessions")?;
        let sessions_expired = IntCounterVec::new(
            prometheus::Opts::new("ltp_sessions_expired_total", "Expired sessions total"),
            &["reason"],
        )?;
        let messages_total = IntCounterVec::new(
            prometheus::Opts::new("ltp_msgs_total", "Total LTP messages processed"),
            &["type"],
        )?;
        let messages_rejected = IntCounterVec::new(
            prometheus::Opts::new("ltp_msg_rejected_total", "Rejected inbound messages"),
            &["reason"],
        )?;
        let janitor_sweep_duration = Histogram::with_opts(prometheus::HistogramOpts::new(
            "ltp_janitor_sweep_duration_seconds",
            "Duration of janitor sweeps",
        ))?;
        let janitor_skipped_lock = IntCounter::new(
            "ltp_janitor_skipped_lock_total",
            "Sessions skipped during GC because locks were contended",
        )?;
        let janitor_expired_last_sweep = IntGauge::new(
            "ltp_janitor_expired_last_sweep",
            "Sessions expired in the most recent GC sweep",
        )?;
        let capacity_rejections = IntCounter::new(
            "ltp_capacity_rejections_total",
            "Sessions rejected due to capacity limits",
        )?;

        registry.register(Box::new(connections.clone()))?;
        registry.register(Box::new(sessions.clone()))?;
        registry.register(Box::new(sessions_expired.clone()))?;
        registry.register(Box::new(messages_total.clone()))?;
        registry.register(Box::new(messages_rejected.clone()))?;
        registry.register(Box::new(janitor_sweep_duration.clone()))?;
        registry.register(Box::new(janitor_skipped_lock.clone()))?;
        registry.register(Box::new(janitor_expired_last_sweep.clone()))?;
        registry.register(Box::new(capacity_rejections.clone()))?;

        Ok(Self {
            registry,
            connections,
            sessions,
            sessions_expired,
            messages_total,
            messages_rejected,
            janitor_sweep_duration,
            janitor_skipped_lock,
            janitor_expired_last_sweep,
            capacity_rejections,
        })
    }

    fn render(&self) -> anyhow::Result<String> {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();
        encoder.encode(&metric_families, &mut buffer)?;
        Ok(String::from_utf8(buffer)?)
    }
}

#[derive(Clone)]
struct AppContext {
    config: Arc<Config>,
    state: Arc<LtpNodeState>,
    metrics: Arc<Metrics>,
}

#[derive(Debug, Clone)]
struct AuthContext {
    auth_id: String,
    session_id: String,
}

#[derive(Debug)]
struct TokenBucket {
    capacity: f64,
    tokens: f64,
    refill_per_sec: f64,
    last_refill: Instant,
}

impl TokenBucket {
    fn new(rps: u64, burst: u64) -> Self {
        let capacity = burst.max(rps) as f64;
        Self {
            capacity,
            tokens: capacity,
            refill_per_sec: rps as f64,
            last_refill: Instant::now(),
        }
    }

    fn try_consume(&mut self) -> bool {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        if elapsed > 0.0 {
            let new_tokens = elapsed * self.refill_per_sec;
            self.tokens = (self.tokens + new_tokens).min(self.capacity);
            self.last_refill = now;
        }

        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

#[derive(Debug)]
struct ParseErrorSampler {
    last_log: Option<Instant>,
    suppressed: u64,
    interval: Duration,
}

impl ParseErrorSampler {
    fn new(interval: Duration) -> Self {
        Self {
            last_log: None,
            suppressed: 0,
            interval,
        }
    }

    /// Returns the number of suppressed events if a log should be emitted now.
    fn record(&mut self) -> Option<u64> {
        let now = Instant::now();
        match self.last_log {
            None => {
                self.last_log = Some(now);
                Some(0)
            }
            Some(last) if now.duration_since(last) >= self.interval => {
                let suppressed = self.suppressed;
                self.suppressed = 0;
                self.last_log = Some(now);
                Some(suppressed)
            }
            Some(_) => {
                self.suppressed += 1;
                None
            }
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing();

    let config = Arc::new(Config::from_env());
    if config.api_keys.is_empty() {
        warn!("no API keys configured; all handshakes will be rejected");
    } else {
        info!(
            api_keys_loaded = config.api_keys.len(),
            "API key authentication enabled"
        );
    }
    let metrics = Arc::new(Metrics::new()?);
    let state = Arc::new(LtpNodeState::new());
    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let ctx = AppContext {
        config: config.clone(),
        state: state.clone(),
        metrics: metrics.clone(),
    };

    let metrics_app = Router::new().route(
        "/metrics",
        get({
            let metrics = metrics.clone();
            move || {
                let metrics = metrics.clone();
                async move {
                    metrics
                        .render()
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
                }
            }
        }),
    );

    let metrics_config = config.clone();
    let mut metrics_shutdown = shutdown_rx.clone();
    let metrics_handle = tokio::spawn(async move {
        let listener = match TcpListener::bind(&metrics_config.metrics_addr).await {
            Ok(listener) => listener,
            Err(err) => {
                error!(
                    error = ?err,
                    addr = %metrics_config.metrics_addr,
                    "failed to bind metrics listener"
                );
                return;
            }
        };

        info!(addr = %metrics_config.metrics_addr, "metrics server listening");

        if let Err(err) = axum::serve(listener, metrics_app.into_make_service())
            .with_graceful_shutdown(async move {
                let _ = metrics_shutdown.changed().await;
            })
            .await
        {
            error!(error = ?err, "failed to start metrics server");
        }

        info!("metrics server shutdown complete");
    });

    let listener = TcpListener::bind(&config.addr)
        .await
        .with_context(|| format!("failed to bind to {}", config.addr))?;

    info!(
        addr = %config.addr,
        node_id = %config.node_id,
        metrics_addr = %config.metrics_addr,
        "ltp-rust-node listening"
    );

    let janitor_handle = spawn_janitor(ctx.clone(), shutdown_rx.clone());

    loop {
        tokio::select! {
            biased;
            _ = signal::ctrl_c() => {
                info!("shutdown signal received, stopping accept loop");
                let _ = shutdown_tx.send(true);
                break;
            }
            accept_result = listener.accept() => {
                let (stream, peer) = accept_result?;

                if ctx.metrics.connections.get() as usize >= ctx.config.max_connections {
                    warn!(
                        remote_addr = %peer,
                        max_connections = ctx.config.max_connections,
                        "rejecting connection: connection limit reached"
                    );
                    ctx.metrics.capacity_rejections.inc();
                    continue;
                }

                let ctx_clone = ctx.clone();
                tokio::spawn(async move {
                    if let Err(err) = handle_connection(stream, peer, ctx_clone.clone()).await {
                        error!(remote_addr = %peer, error = ?err, "connection handler error");
                    }
                });
            }
        }
    }

    info!("waiting for background tasks to finish");
    let _ = shutdown_tx.send(true);
    let _ = janitor_handle.await;
    let _ = metrics_handle.await;
    info!("shutdown complete");
    Ok(())
}

fn init_tracing() {
    use tracing_subscriber::filter::EnvFilter;
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::fmt().with_env_filter(filter).init();
}

async fn handle_connection(
    stream: tokio::net::TcpStream,
    peer: SocketAddr,
    ctx: AppContext,
) -> anyhow::Result<()> {
    let ws_stream = match timeout(
        Duration::from_millis(ctx.config.handshake_timeout_ms),
        accept_async(stream),
    )
    .await
    {
        Ok(Ok(ws)) => ws,
        Ok(Err(err)) => {
            warn!(remote_addr = %peer, error = ?err, "websocket handshake failed");
            return Ok(());
        }
        Err(_) => {
            warn!(remote_addr = %peer, "handshake timed out");
            return Ok(());
        }
    };

    ctx.metrics.connections.inc();
    info!(remote_addr = %peer, "websocket connection established");

    let (mut write, mut read) = ws_stream.split();
    let mut parse_sampler = ParseErrorSampler::new(Duration::from_secs(1));
    let mut rate_limiter = TokenBucket::new(ctx.config.rate_limit_rps, ctx.config.rate_limit_burst);

    let auth_ctx =
        match perform_handshake(&mut write, &mut read, &ctx, peer, &mut parse_sampler).await? {
            Some(auth_ctx) => auth_ctx,
            None => {
                ctx.metrics.connections.dec();
                return Ok(());
            }
        };
    let active_session = auth_ctx.session_id.clone();

    while let Some(msg) = read.next().await {
        let msg = match msg {
            Ok(m) => m,
            Err(err) => {
                warn!(remote_addr = %peer, error = ?err, "websocket read error");
                break;
            }
        };

        match msg {
            Message::Text(text) => {
                if !rate_limiter.try_consume() {
                    warn!(remote_addr = %peer, "rate limit exceeded, closing connection");
                    let _ = send_json(
                        &mut write,
                        &LtpOutgoingMessage::Error {
                            code: protocol::ErrorCode::RateLimit,
                            message: Some("too many messages".to_string()),
                        },
                    )
                    .await;
                    break;
                }

                if text.as_bytes().len() > ctx.config.max_message_bytes {
                    warn!(
                        remote_addr = %peer,
                        size = text.as_bytes().len(),
                        max = ctx.config.max_message_bytes,
                        "rejecting message: too large"
                    );
                    ctx.metrics
                        .messages_rejected
                        .with_label_values(&["too_large"])
                        .inc();
                    let _ = write
                        .send(Message::Close(Some(CloseFrame {
                            code: CloseCode::Size,
                            reason: "message too large".into(),
                        })))
                        .await;
                    break;
                }

                match serde_json::from_str::<LtpIncomingMessage>(&text) {
                    Ok(incoming) => {
                        ctx.metrics
                            .messages_total
                            .with_label_values(&[incoming_type(&incoming)])
                            .inc();

                        if let Some(responses) = process_message(incoming, &ctx, &auth_ctx).await {
                            let mut should_close = false;
                            for response in responses {
                                if let LtpOutgoingMessage::Error { code, .. } = &response {
                                    if matches!(
                                        code,
                                        protocol::ErrorCode::Forbidden
                                            | protocol::ErrorCode::RateLimit
                                    ) {
                                        should_close = true;
                                    }
                                }
                                if let Err(err) = send_json(&mut write, &response).await {
                                    warn!(
                                        remote_addr = %peer,
                                        error = ?err,
                                        "failed to send response"
                                    );
                                    break;
                                }
                            }
                            if should_close {
                                let _ = write.close().await;
                                break;
                            }
                        }
                    }
                    Err(err) => {
                        if let Some(suppressed) = parse_sampler.record() {
                            warn!(
                                remote_addr = %peer,
                                error = ?err,
                                suppressed,
                                "parse_error rate-limited"
                            );
                        }
                        ctx.metrics
                            .messages_rejected
                            .with_label_values(&["invalid_json"])
                            .inc();
                        let err_msg = LtpOutgoingMessage::Error {
                            code: protocol::ErrorCode::Invalid,
                            message: Some("invalid message".to_string()),
                        };
                        if let Err(err) = send_json(&mut write, &err_msg).await {
                            warn!(remote_addr = %peer, error = ?err, "failed to send error");
                            break;
                        }
                    }
                }
            }
            Message::Binary(_) => {
                ctx.metrics
                    .messages_rejected
                    .with_label_values(&["invalid_json"])
                    .inc();
                let err_msg = LtpOutgoingMessage::Error {
                    code: protocol::ErrorCode::Invalid,
                    message: Some("binary messages are not supported".to_string()),
                };
                if let Err(err) = send_json(&mut write, &err_msg).await {
                    warn!(remote_addr = %peer, error = ?err, "failed to send binary error");
                    break;
                }
            }
            Message::Close(_) => break,
            Message::Ping(p) => {
                if let Err(err) = write.send(Message::Pong(p)).await {
                    warn!(remote_addr = %peer, error = ?err, "failed to respond to ping");
                    break;
                }
            }
            Message::Pong(_) => {}
            _ => {}
        }
    }

    if ctx.state.remove(&active_session) {
        ctx.metrics.sessions.dec();
        info!(
            remote_addr = %peer,
            auth_id = %auth_ctx.auth_id,
            session_id = %active_session,
            "session removed on disconnect"
        );
    }

    ctx.metrics.connections.dec();
    info!(
        remote_addr = %peer,
        auth_id = %auth_ctx.auth_id,
        "connection closed"
    );
    Ok(())
}

fn incoming_type(msg: &LtpIncomingMessage) -> &'static str {
    match msg {
        LtpIncomingMessage::Hello { .. } => "hello",
        LtpIncomingMessage::Heartbeat { .. } => "heartbeat",
        LtpIncomingMessage::Orientation { .. } => "orientation",
        LtpIncomingMessage::RouteRequest { .. } => "route_request",
    }
}

async fn perform_handshake(
    write: &mut futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
        Message,
    >,
    read: &mut futures_util::stream::SplitStream<
        tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    >,
    ctx: &AppContext,
    peer: SocketAddr,
    parse_sampler: &mut ParseErrorSampler,
) -> anyhow::Result<Option<AuthContext>> {
    while let Some(msg) = read.next().await {
        let msg = match msg {
            Ok(m) => m,
            Err(err) => {
                warn!(remote_addr = %peer, error = ?err, "websocket read error during handshake");
                return Ok(None);
            }
        };

        match msg {
            Message::Text(text) => {
                if text.as_bytes().len() > ctx.config.max_message_bytes {
                    warn!(
                        remote_addr = %peer,
                        size = text.as_bytes().len(),
                        max = ctx.config.max_message_bytes,
                        "rejecting handshake: message too large"
                    );
                    ctx.metrics
                        .messages_rejected
                        .with_label_values(&["too_large"])
                        .inc();
                    let _ = write
                        .send(Message::Close(Some(CloseFrame {
                            code: CloseCode::Size,
                            reason: "message too large".into(),
                        })))
                        .await;
                    return Ok(None);
                }

                match serde_json::from_str::<LtpIncomingMessage>(&text) {
                    Ok(LtpIncomingMessage::Hello { api_key, .. }) => {
                        if let Some(auth_id) = validate_api_key(&api_key, &ctx.config) {
                            let session_id = Uuid::new_v4().to_string();
                            let created = ctx.state.touch_heartbeat(&session_id).await;
                            if created && reject_when_over_capacity(ctx, &session_id) {
                                let _ = send_json(
                                    write,
                                    &LtpOutgoingMessage::Error {
                                        code: protocol::ErrorCode::RateLimit,
                                        message: Some("session limit reached".to_string()),
                                    },
                                )
                                .await;
                                let _ = write.close().await;
                                return Ok(None);
                            }
                            info!(
                                remote_addr = %peer,
                                auth_id = %auth_id,
                                session_id = %session_id,
                                "handshake authorized"
                            );
                            let ack = LtpOutgoingMessage::HelloAck {
                                node_id: ctx.config.node_id.clone(),
                                accepted: true,
                                session_id: session_id.clone(),
                            };
                            send_json(write, &ack).await?;
                            return Ok(Some(AuthContext {
                                auth_id,
                                session_id,
                            }));
                        } else {
                            warn!(remote_addr = %peer, "handshake unauthorized");
                            ctx.metrics
                                .messages_rejected
                                .with_label_values(&["unauthorized"])
                                .inc();
                            let _ = send_json(
                                write,
                                &LtpOutgoingMessage::Error {
                                    code: protocol::ErrorCode::Unauthorized,
                                    message: Some("unauthorized".to_string()),
                                },
                            )
                            .await;
                            let _ = write.close().await;
                            return Ok(None);
                        }
                    }
                    Ok(other) => {
                        warn!(
                            remote_addr = %peer,
                            message_type = incoming_type(&other),
                            "unexpected message before handshake"
                        );
                        let _ = send_json(
                            write,
                            &LtpOutgoingMessage::Error {
                                code: protocol::ErrorCode::Invalid,
                                message: Some("handshake required".to_string()),
                            },
                        )
                        .await;
                        let _ = write.close().await;
                        return Ok(None);
                    }
                    Err(err) => {
                        if let Some(suppressed) = parse_sampler.record() {
                            warn!(
                                remote_addr = %peer,
                                error = ?err,
                                suppressed,
                                "parse_error rate-limited during handshake"
                            );
                        }
                        ctx.metrics
                            .messages_rejected
                            .with_label_values(&["invalid_json"])
                            .inc();
                        let _ = send_json(
                            write,
                            &LtpOutgoingMessage::Error {
                                code: protocol::ErrorCode::Invalid,
                                message: Some("invalid handshake".to_string()),
                            },
                        )
                        .await;
                        let _ = write.close().await;
                        return Ok(None);
                    }
                }
            }
            Message::Close(_) => return Ok(None),
            Message::Ping(p) => {
                if let Err(err) = write.send(Message::Pong(p)).await {
                    warn!(remote_addr = %peer, error = ?err, "failed to respond to ping");
                    return Ok(None);
                }
            }
            Message::Pong(_) => {}
            Message::Binary(_) => {
                ctx.metrics
                    .messages_rejected
                    .with_label_values(&["invalid_json"])
                    .inc();
                let _ = send_json(
                    write,
                    &LtpOutgoingMessage::Error {
                        code: protocol::ErrorCode::Invalid,
                        message: Some("binary handshake not supported".to_string()),
                    },
                )
                .await;
                let _ = write.close().await;
                return Ok(None);
            }
            _ => {}
        }
    }

    Ok(None)
}

async fn process_message(
    incoming: LtpIncomingMessage,
    ctx: &AppContext,
    auth: &AuthContext,
) -> Option<Vec<LtpOutgoingMessage>> {
    match incoming {
        LtpIncomingMessage::Hello { .. } => Some(vec![LtpOutgoingMessage::Error {
            code: protocol::ErrorCode::Invalid,
            message: Some("handshake already completed".to_string()),
        }]),
        LtpIncomingMessage::Heartbeat {
            session_id,
            timestamp_ms,
        } => {
            if session_id != auth.session_id {
                ctx.metrics
                    .messages_rejected
                    .with_label_values(&["forbidden"])
                    .inc();
                return Some(vec![LtpOutgoingMessage::Error {
                    code: protocol::ErrorCode::Forbidden,
                    message: Some("session mismatch".to_string()),
                }]);
            }
            let created = ctx.state.touch_heartbeat(&auth.session_id).await;
            if created && reject_when_over_capacity(&ctx, &auth.session_id) {
                return Some(vec![LtpOutgoingMessage::Error {
                    code: protocol::ErrorCode::RateLimit,
                    message: Some("session limit reached".to_string()),
                }]);
            }
            Some(vec![LtpOutgoingMessage::HeartbeatAck {
                session_id: auth.session_id.clone(),
                timestamp_ms,
            }])
        }
        LtpIncomingMessage::Orientation {
            session_id,
            focus_momentum,
            time_orientation,
        } => {
            if session_id != auth.session_id {
                ctx.metrics
                    .messages_rejected
                    .with_label_values(&["forbidden"])
                    .inc();
                return Some(vec![LtpOutgoingMessage::Error {
                    code: protocol::ErrorCode::Forbidden,
                    message: Some("session mismatch".to_string()),
                }]);
            }
            let created = ctx
                .state
                .update_orientation(&auth.session_id, focus_momentum, time_orientation)
                .await;
            if created && reject_when_over_capacity(&ctx, &auth.session_id) {
                return Some(vec![LtpOutgoingMessage::Error {
                    code: protocol::ErrorCode::RateLimit,
                    message: Some("session limit reached".to_string()),
                }]);
            }
            None
        }
        LtpIncomingMessage::RouteRequest { session_id, .. } => {
            if session_id != auth.session_id {
                ctx.metrics
                    .messages_rejected
                    .with_label_values(&["forbidden"])
                    .inc();
                return Some(vec![LtpOutgoingMessage::Error {
                    code: protocol::ErrorCode::Forbidden,
                    message: Some("session mismatch".to_string()),
                }]);
            }
            Some(vec![
                build_route_suggestion(&ctx.state, &auth.session_id).await,
            ])
        }
    }
}

async fn send_json(
    write: &mut futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
        Message,
    >,
    message: &LtpOutgoingMessage,
) -> WsResult<()> {
    let payload = serde_json::to_string(message).expect("serialization should succeed");
    write.send(Message::Text(payload)).await
}

fn spawn_janitor(
    ctx: AppContext,
    mut shutdown: watch::Receiver<bool>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        info!("janitor task started");
        let idle_ttl = Duration::from_millis(ctx.config.idle_ttl_ms);
        let base_interval = Duration::from_millis(ctx.config.gc_interval_ms);
        let mut rng = StdRng::from_entropy();
        loop {
            let jitter_factor: f64 = rng.gen_range(0.9..=1.1);
            let sleep_millis = (base_interval.as_millis() as f64 * jitter_factor) as u64;
            let sleep_duration = Duration::from_millis(sleep_millis.max(1));
            tokio::select! {
                result = shutdown.changed() => {
                    if result.is_err() || *shutdown.borrow() {
                        info!("janitor task received shutdown signal");
                        break;
                    }
                }
                _ = tokio::time::sleep(sleep_duration) => {}
            }

            if *shutdown.borrow() {
                info!("janitor task received shutdown signal");
                break;
            }

            let sweep_start = Instant::now();
            let stats = ctx.state.expire_idle(idle_ttl);
            let elapsed = sweep_start.elapsed();
            ctx.metrics
                .janitor_sweep_duration
                .observe(elapsed.as_secs_f64());
            ctx.metrics
                .janitor_skipped_lock
                .inc_by(stats.skipped_locks as u64);
            ctx.metrics
                .janitor_expired_last_sweep
                .set(stats.expired as i64);

            if stats.expired > 0 {
                ctx.metrics.sessions.sub(stats.expired as i64);
                ctx.metrics
                    .sessions_expired
                    .with_label_values(&["ttl"])
                    .inc_by(stats.expired as u64);
            }

            info!(
                expired = stats.expired,
                scanned = stats.scanned,
                skipped_locks = stats.skipped_locks,
                duration_ms = elapsed.as_millis(),
                "janitor sweep completed"
            );
        }
        info!("janitor task stopped");
    })
}

fn reject_when_over_capacity(ctx: &AppContext, session_id: &str) -> bool {
    if ctx.state.len() > ctx.config.max_sessions_total {
        ctx.state.remove(session_id);
        warn!(
            session_id = %session_id,
            max_sessions = ctx.config.max_sessions_total,
            "rejecting session: session limit reached"
        );
        ctx.metrics.capacity_rejections.inc();
        ctx.metrics
            .messages_rejected
            .with_label_values(&["rate_limit"])
            .inc();
        return true;
    }
    ctx.metrics.sessions.inc();
    false
}
