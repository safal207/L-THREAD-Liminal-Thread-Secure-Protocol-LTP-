mod node;
mod protocol;
mod state;
#[cfg(test)]
mod tests;

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

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

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing();

    let config = Arc::new(Config::from_env());
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
    let mut active_session: Option<String> = None;

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
                        if let Some(client_id) = extract_client_id(&incoming) {
                            active_session.get_or_insert_with(|| client_id.clone());
                        }

                        ctx.metrics
                            .messages_total
                            .with_label_values(&[incoming_type(&incoming)])
                            .inc();

                        if let Some(responses) =
                            process_message(incoming, &ctx, &ctx.config.node_id).await
                        {
                            for response in responses {
                                if let Err(err) = send_json(&mut write, &response).await {
                                    warn!(
                                        remote_addr = %peer,
                                        error = ?err,
                                        "failed to send response"
                                    );
                                    break;
                                }
                            }
                        }
                    }
                    Err(err) => {
                        warn!(remote_addr = %peer, error = ?err, "invalid JSON payload");
                        ctx.metrics
                            .messages_rejected
                            .with_label_values(&["invalid_json"])
                            .inc();
                        let err_msg = LtpOutgoingMessage::Error {
                            message: "invalid message".to_string(),
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
                    message: "binary messages are not supported".to_string(),
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

    if let Some(client_id) = active_session {
        if ctx.state.remove(&client_id) {
            ctx.metrics.sessions.dec();
            info!(remote_addr = %peer, client_id = %client_id, "session removed on disconnect");
        }
    }

    ctx.metrics.connections.dec();
    info!(remote_addr = %peer, "connection closed");
    Ok(())
}

fn extract_client_id(msg: &LtpIncomingMessage) -> Option<String> {
    match msg {
        LtpIncomingMessage::Hello { client_id, .. } => Some(client_id.clone()),
        LtpIncomingMessage::Heartbeat { client_id, .. } => Some(client_id.clone()),
        LtpIncomingMessage::Orientation { client_id, .. } => Some(client_id.clone()),
        LtpIncomingMessage::RouteRequest { client_id, .. } => Some(client_id.clone()),
    }
}

fn incoming_type(msg: &LtpIncomingMessage) -> &'static str {
    match msg {
        LtpIncomingMessage::Hello { .. } => "hello",
        LtpIncomingMessage::Heartbeat { .. } => "heartbeat",
        LtpIncomingMessage::Orientation { .. } => "orientation",
        LtpIncomingMessage::RouteRequest { .. } => "route_request",
    }
}

async fn process_message(
    incoming: LtpIncomingMessage,
    ctx: &AppContext,
    node_id: &str,
) -> Option<Vec<LtpOutgoingMessage>> {
    match incoming {
        LtpIncomingMessage::Hello { client_id, .. } => {
            let created = ctx.state.touch_heartbeat(&client_id).await;
            if created {
                if reject_when_over_capacity(&ctx, &client_id) {
                    return Some(vec![LtpOutgoingMessage::Error {
                        message: "session limit reached".to_string(),
                    }]);
                }
            }
            Some(vec![LtpOutgoingMessage::HelloAck {
                node_id: node_id.to_string(),
                accepted: true,
            }])
        }
        LtpIncomingMessage::Heartbeat {
            client_id,
            timestamp_ms,
        } => {
            let created = ctx.state.touch_heartbeat(&client_id).await;
            if created && reject_when_over_capacity(&ctx, &client_id) {
                return Some(vec![LtpOutgoingMessage::Error {
                    message: "session limit reached".to_string(),
                }]);
            }
            Some(vec![LtpOutgoingMessage::HeartbeatAck {
                client_id,
                timestamp_ms,
            }])
        }
        LtpIncomingMessage::Orientation {
            client_id,
            focus_momentum,
            time_orientation,
        } => {
            let created = ctx
                .state
                .update_orientation(&client_id, focus_momentum, time_orientation)
                .await;
            if created && reject_when_over_capacity(&ctx, &client_id) {
                return Some(vec![LtpOutgoingMessage::Error {
                    message: "session limit reached".to_string(),
                }]);
            }
            None
        }
        LtpIncomingMessage::RouteRequest { client_id, .. } => {
            Some(vec![build_route_suggestion(&ctx.state, &client_id).await])
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

            let stats = ctx.state.expire_idle(idle_ttl);
            let sweep_duration =
                Duration::from_millis(stats.sweep_ms.min(u128::from(u64::MAX)) as u64);
            ctx.metrics
                .janitor_sweep_duration
                .observe(sweep_duration.as_secs_f64());
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
                duration_ms = stats.sweep_ms,
                "janitor sweep completed"
            );
        }
        info!("janitor task stopped");
    })
}

fn reject_when_over_capacity(ctx: &AppContext, client_id: &str) -> bool {
    if ctx.state.len() > ctx.config.max_sessions_total {
        ctx.state.remove(client_id);
        warn!(
            client_id = %client_id,
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
