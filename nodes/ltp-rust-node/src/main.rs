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
use prometheus::{Encoder, IntCounterVec, IntGauge, Registry, TextEncoder};
use protocol::{LtpIncomingMessage, LtpOutgoingMessage};
use tokio::net::TcpListener;
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
const DEFAULT_METRICS_ADDR: &str = "0.0.0.0:9090";

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

        registry.register(Box::new(connections.clone()))?;
        registry.register(Box::new(sessions.clone()))?;
        registry.register(Box::new(sessions_expired.clone()))?;
        registry.register(Box::new(messages_total.clone()))?;
        registry.register(Box::new(messages_rejected.clone()))?;

        Ok(Self {
            registry,
            connections,
            sessions,
            sessions_expired,
            messages_total,
            messages_rejected,
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
    tokio::spawn(async move {
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

        if let Err(err) = axum::serve(listener, metrics_app.into_make_service()).await {
            error!(error = ?err, "failed to start metrics server");
        }
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

    spawn_janitor(ctx.clone());

    loop {
        let (stream, peer) = listener.accept().await?;

        if ctx.metrics.connections.get() as usize >= ctx.config.max_connections {
            warn!(
                remote_addr = %peer,
                max_connections = ctx.config.max_connections,
                "rejecting connection: connection limit reached"
            );
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

fn spawn_janitor(ctx: AppContext) {
    tokio::spawn(async move {
        let idle_ttl = Duration::from_millis(ctx.config.idle_ttl_ms);
        let interval = Duration::from_millis(ctx.config.gc_interval_ms);
        loop {
            tokio::time::sleep(interval).await;
            let removed = ctx.state.expire_idle(idle_ttl);
            if removed > 0 {
                ctx.metrics.sessions.sub(removed as i64);
                ctx.metrics
                    .sessions_expired
                    .with_label_values(&["ttl"])
                    .inc_by(removed as u64);
                info!(removed, reason = "ttl", "expired idle sessions");
            }
        }
    });
}

fn reject_when_over_capacity(ctx: &AppContext, client_id: &str) -> bool {
    if ctx.state.len() > ctx.config.max_sessions_total {
        ctx.state.remove(client_id);
        warn!(
            client_id = %client_id,
            max_sessions = ctx.config.max_sessions_total,
            "rejecting session: session limit reached"
        );
        ctx.metrics
            .messages_rejected
            .with_label_values(&["rate_limit"])
            .inc();
        return true;
    }
    ctx.metrics.sessions.inc();
    false
}
