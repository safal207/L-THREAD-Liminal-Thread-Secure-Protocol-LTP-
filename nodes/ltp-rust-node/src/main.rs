mod node;
mod protocol;
mod state;
#[cfg(test)]
mod tests;
mod trace;

use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use anyhow::Context;
use axum::{http::StatusCode, routing::get, Router};
use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use prometheus::{Encoder, IntCounter, IntCounterVec, IntGauge, Registry, TextEncoder};
use protocol::{LtpIncomingMessage, LtpOutgoingMessage};
use rand::{rngs::StdRng, Rng, SeedableRng};
use tokio::net::TcpListener;
use tokio::signal;
use tokio::sync::watch;
use tokio::time::timeout;
use tokio_tungstenite::{
    accept_hdr_async,
    tungstenite::{
        handshake::server::{ErrorResponse, Request, Response},
        protocol::{frame::coding::CloseCode, CloseFrame},
        Message, Result as WsResult,
    },
};
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::node::build_route_suggestion;
use crate::state::LtpNodeState;
use crate::trace::TraceLogger;

const DEFAULT_ADDR: &str = "127.0.0.1:7070";
const DEFAULT_METRICS_ADDR: &str = "127.0.0.1:9090";
const DEFAULT_MAX_MESSAGE_BYTES: usize = 64 * 1024;
const DEFAULT_AUTH_KEYS_RELOAD_SECS: u64 = 30;

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
    rate_limit_rps: f64,
    rate_limit_burst: f64,
    ip_rate_limit_rps: f64,
    ip_rate_limit_burst: f64,
    ip_rate_limit_ttl_secs: u64,
    auth: AuthConfig,
    trust_proxy: bool,
    audit_log_file: String,
}

impl Config {
    fn from_env() -> Self {
        let addr = std::env::var("LTP_NODE_ADDR").unwrap_or_else(|_| DEFAULT_ADDR.to_string());
        let node_id =
            std::env::var("LTP_NODE_ID").unwrap_or_else(|_| format!("ltp-node-{}", Uuid::new_v4()));
        let metrics_addr = std::env::var("LTP_NODE_METRICS_ADDR")
            .unwrap_or_else(|_| DEFAULT_METRICS_ADDR.to_string());
        let max_connections = read_env_usize("LTP_NODE_MAX_CONNECTIONS", 10_000);
        let max_message_bytes = read_env_usize(
            "LTP_NODE_MAX_MESSAGE_BYTES",
            read_env_usize("MAX_MESSAGE_BYTES", DEFAULT_MAX_MESSAGE_BYTES),
        );
        let max_sessions_total = read_env_usize("LTP_NODE_MAX_SESSIONS", 50_000);
        let handshake_timeout_ms = read_env_u64("LTP_NODE_HANDSHAKE_TIMEOUT_MS", 5_000);
        let idle_ttl_ms = read_env_u64("LTP_NODE_IDLE_TTL_MS", 60_000);
        let gc_interval_ms = read_env_u64("LTP_NODE_GC_INTERVAL_MS", 10_000);
        let rate_limit_rps = read_env_f64("RATE_LIMIT_RPS", 10.0);
        let rate_limit_burst = read_env_f64("RATE_LIMIT_BURST", 20.0);
        let ip_rate_limit_rps = read_env_f64("IP_RATE_LIMIT_RPS", 5.0);
        let ip_rate_limit_burst = read_env_f64("IP_RATE_LIMIT_BURST", 10.0);
        let ip_rate_limit_ttl_secs = read_env_u64("IP_RATE_LIMIT_TTL_SECS", 600);
        let trust_proxy = std::env::var("TRUST_PROXY")
            .ok()
            .map(|v| v.to_lowercase() == "true")
            .unwrap_or(false);
        let auth = AuthConfig::from_env();
        let audit_log_file =
            std::env::var("LTP_AUDIT_LOG_FILE").unwrap_or_else(|_| "ltp-audit.log".to_string());

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
            rate_limit_rps,
            rate_limit_burst,
            ip_rate_limit_rps,
            ip_rate_limit_burst,
            ip_rate_limit_ttl_secs,
            auth,
            trust_proxy,
            audit_log_file,
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

fn read_env_f64(key: &str, default: f64) -> f64 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(default)
}

#[derive(Clone, Debug)]
enum AuthMode {
    None,
    ApiKey,
    Jwt,
}

#[allow(dead_code)]
#[derive(Clone, Debug)]
enum IdentitySource {
    Off,
    ApiKey,
    MtlsSubject,
}

#[derive(Clone, Debug)]
struct AuthConfig {
    mode: AuthMode,
    keys: Arc<std::sync::RwLock<HashMap<String, String>>>,
    jwt_secret: Option<String>,
    keys_file: Option<String>,
    keys_reload_interval: Duration,
    last_loaded_hash: Arc<Mutex<Option<u64>>>,
    fail_closed: Arc<AtomicBool>,
}

impl AuthConfig {
    fn from_env() -> Self {
        let mode = match std::env::var("AUTH_MODE")
            .unwrap_or_else(|_| "none".to_string())
            .to_lowercase()
            .as_str()
        {
            "api_key" => AuthMode::ApiKey,
            "jwt" => AuthMode::Jwt,
            _ => AuthMode::None,
        };

        let keys_reload_interval = Duration::from_secs(read_env_u64(
            "AUTH_KEYS_RELOAD_INTERVAL_SECS",
            DEFAULT_AUTH_KEYS_RELOAD_SECS,
        ));
        let keys_file = std::env::var("AUTH_KEYS_FILE").ok();
        let mut source_map = HashMap::new();

        let fail_closed = Arc::new(AtomicBool::new(false));
        if let Some(path) = keys_file.as_ref() {
            match Self::load_keys_file(path) {
                Ok((map, hash)) => {
                    source_map = map;
                    return Self {
                        mode,
                        keys: Arc::new(std::sync::RwLock::new(source_map)),
                        jwt_secret: std::env::var("AUTH_JWT_SECRET").ok(),
                        keys_file,
                        keys_reload_interval,
                        last_loaded_hash: Arc::new(Mutex::new(Some(hash))),
                        fail_closed: fail_closed.clone(),
                    };
                }
                Err(err) => {
                    warn!(error = %err, file = %path, "failed to load AUTH_KEYS_FILE at startup");
                    fail_closed.store(true, Ordering::Relaxed);
                }
            }
        }

        if let Ok(raw_keys) = std::env::var("AUTH_KEYS") {
            source_map.extend(parse_keys(&raw_keys));
        }

        if matches!(mode, AuthMode::Jwt) {
            warn!("AUTH_MODE=jwt is configured but JWT verification is not implemented; connections will be rejected");
        }

        Self {
            mode,
            keys: Arc::new(std::sync::RwLock::new(source_map)),
            jwt_secret: std::env::var("AUTH_JWT_SECRET").ok(),
            keys_file,
            keys_reload_interval,
            last_loaded_hash: Arc::new(Mutex::new(None)),
            fail_closed,
        }
    }

    fn start_reload_task(&self, metrics: Arc<Metrics>, shutdown: watch::Receiver<bool>) {
        if self.keys_file.is_none() {
            return;
        }
        let path = self.keys_file.clone().unwrap();
        let keys_handle = self.keys.clone();
        let last_loaded_hash = self.last_loaded_hash.clone();
        let interval = self.keys_reload_interval;
        let fail_closed_flag = self.fail_closed.clone();
        tokio::spawn(async move {
            let mut shutdown = shutdown;
            loop {
                tokio::select! {
                    _ = tokio::time::sleep(interval) => {},
                    _ = shutdown.changed() => {
                        if *shutdown.borrow() { break; }
                    }
                }

                match AuthConfig::load_keys_file(&path) {
                    Ok((map, hash)) => {
                        let mut guard = last_loaded_hash.lock().unwrap_or_else(|p| p.into_inner());
                        let changed = guard.map(|h| h != hash).unwrap_or(true);
                        if changed {
                            if let Ok(mut keys_guard) = keys_handle.write() {
                                *keys_guard = map;
                                metrics.auth_keys_active.set(keys_guard.len() as i64);
                            }
                            *guard = Some(hash);
                            drop(guard);
                            fail_closed_flag.store(false, Ordering::Relaxed);
                            metrics.auth_keys_reload_success_total.inc();
                            info!(file = %path, "reloaded auth keys");
                        }
                    }
                    Err(err) => {
                        metrics.auth_keys_reload_failure_total.inc();
                        warn!(error = %err, file = %path, "failed to reload auth keys");
                    }
                }

                if *shutdown.borrow() {
                    break;
                }
            }
        });
    }

    fn load_keys_file(path: &str) -> anyhow::Result<(HashMap<String, String>, u64)> {
        let content = std::fs::read_to_string(path)?;
        let map = serde_json::from_str::<HashMap<String, String>>(&content)?;
        let hash = hash_string(&content);
        Ok((map, hash))
    }

    fn auth_enabled(&self) -> bool {
        !matches!(self.mode, AuthMode::None)
    }

    fn identity_source(&self) -> IdentitySource {
        match self.mode {
            AuthMode::ApiKey => IdentitySource::ApiKey,
            AuthMode::Jwt => IdentitySource::Off,
            AuthMode::None => IdentitySource::Off,
        }
    }

    fn authenticate_header(&self, req: &Request) -> Result<Option<String>, Box<ErrorResponse>> {
        match self.mode {
            AuthMode::None => Ok(None),
            AuthMode::ApiKey => {
                let empty_keys = self.keys.read().map(|k| k.is_empty()).unwrap_or(true);
                if self.fail_closed.load(Ordering::Relaxed) || empty_keys {
                    return Err(Box::new(build_error_response(
                        http::StatusCode::UNAUTHORIZED,
                        "authentication is not available".to_string(),
                    )));
                }
                let token = extract_api_key(req.headers()).ok_or_else(|| {
                    Box::new(build_error_response(
                        http::StatusCode::UNAUTHORIZED,
                        "missing api key".to_string(),
                    ))
                })?;
                self.validate_api_key(&token)
            }
            AuthMode::Jwt => {
                let _ = &self.jwt_secret;
                Err(Box::new(build_error_response(
                    http::StatusCode::UNAUTHORIZED,
                    "jwt mode is not yet supported".to_string(),
                )))
            }
        }
    }

    fn validate_api_key(&self, token: &str) -> Result<Option<String>, Box<ErrorResponse>> {
        let keys_guard = self.keys.read().expect("auth keys poisoned");
        for (id, key) in keys_guard.iter() {
            if constant_time_equal(key.as_bytes(), token.as_bytes()) {
                return Ok(Some(id.clone()));
            }
        }
        Ok(None)
    }
}

#[allow(dead_code)]
fn auth_id_for_key(api_key: &str) -> String {
    let mut hasher = DefaultHasher::new();
    api_key.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn constant_time_equal(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (&x, &y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

fn extract_api_key(headers: &http::HeaderMap) -> Option<String> {
    if let Some(value) = headers.get("x-api-key") {
        if let Ok(val) = value.to_str() {
            if !val.is_empty() {
                return Some(val.to_string());
            }
        }
    }

    if let Some(value) = headers.get(http::header::AUTHORIZATION) {
        if let Ok(val) = value.to_str() {
            if let Some(rest) = val.strip_prefix("Bearer ") {
                return Some(rest.trim().to_string());
            } else if let Some(rest) = val.strip_prefix("ApiKey ") {
                return Some(rest.trim().to_string());
            }
        }
    }

    None
}

fn extract_forwarded_for(headers: &http::HeaderMap) -> Option<IpAddr> {
    headers.get("x-forwarded-for").and_then(|v| {
        v.to_str().ok().and_then(|s| {
            s.split(',')
                .next()
                .and_then(|ip| ip.trim().parse::<IpAddr>().ok())
        })
    })
}

fn build_error_response(status: StatusCode, message: String) -> ErrorResponse {
    Response::builder()
        .status(status)
        .body(Some(message))
        .unwrap_or_else(|_| {
            Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(None)
                .unwrap()
        })
}

struct Metrics {
    registry: Registry,
    connections: IntGauge,
    sessions: IntGauge,
    sessions_expired: IntCounterVec,
    messages_total: IntCounterVec,
    messages_rejected: IntCounterVec,
    invalid_json_total: IntCounter,
    invalid_json_suppressed_total: IntCounter,
    rate_limit_violations_total: IntCounter,
    auth_failures_total: IntCounter,
    capacity_rejections: IntCounter,
    oversize_messages_total: IntCounter,
    ip_rate_limit_violations_total: IntCounter,
    log_suppressed_total: IntCounterVec,
    auth_keys_reload_success_total: IntCounter,
    auth_keys_reload_failure_total: IntCounter,
    auth_keys_active: IntGauge,
    janitor_sweep_duration: prometheus::Histogram,
    janitor_skipped_lock: IntCounter,
    janitor_expired_last_sweep: IntGauge,
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
        let invalid_json_total =
            IntCounter::new("ws_invalid_json_total", "Invalid websocket JSON messages")?;
        let invalid_json_suppressed_total = IntCounter::new(
            "ws_invalid_json_suppressed_total",
            "Suppressed invalid JSON logs",
        )?;
        let rate_limit_violations_total =
            IntCounter::new("rate_limit_violations_total", "Rate limit violations total")?;
        let auth_failures_total =
            IntCounter::new("auth_failures_total", "Failed websocket authentications")?;
        let capacity_rejections = IntCounter::new(
            "ltp_capacity_rejections_total",
            "Rejected due to capacity limits",
        )?;
        let oversize_messages_total = IntCounter::new(
            "oversize_messages_total",
            "Messages rejected for being too large",
        )?;
        let ip_rate_limit_violations_total = IntCounter::new(
            "ip_rate_limit_violations_total",
            "Rate limit violations per IP",
        )?;
        let log_suppressed_total = IntCounterVec::new(
            prometheus::Opts::new("log_suppressed_total", "Suppressed logs due to throttling"),
            &["category"],
        )?;
        let auth_keys_reload_success_total = IntCounter::new(
            "auth_keys_reload_success_total",
            "Successful auth key reloads",
        )?;
        let auth_keys_reload_failure_total =
            IntCounter::new("auth_keys_reload_failure_total", "Failed auth key reloads")?;
        let auth_keys_active =
            IntGauge::new("auth_keys_active", "Currently active authentication keys")?;
        let janitor_sweep_duration =
            prometheus::Histogram::with_opts(prometheus::HistogramOpts::new(
                "janitor_sweep_duration_seconds",
                "Duration of janitor sweeps",
            ))?;
        let janitor_skipped_lock = IntCounter::new(
            "janitor_skipped_lock_total",
            "Locks skipped during janitor sweeps",
        )?;
        let janitor_expired_last_sweep = IntGauge::new(
            "janitor_expired_last_sweep",
            "Number of sessions expired in last sweep",
        )?;

        registry.register(Box::new(connections.clone()))?;
        registry.register(Box::new(sessions.clone()))?;
        registry.register(Box::new(sessions_expired.clone()))?;
        registry.register(Box::new(messages_total.clone()))?;
        registry.register(Box::new(messages_rejected.clone()))?;
        registry.register(Box::new(invalid_json_total.clone()))?;
        registry.register(Box::new(invalid_json_suppressed_total.clone()))?;
        registry.register(Box::new(rate_limit_violations_total.clone()))?;
        registry.register(Box::new(auth_failures_total.clone()))?;
        registry.register(Box::new(capacity_rejections.clone()))?;
        registry.register(Box::new(oversize_messages_total.clone()))?;
        registry.register(Box::new(ip_rate_limit_violations_total.clone()))?;
        registry.register(Box::new(log_suppressed_total.clone()))?;
        registry.register(Box::new(auth_keys_reload_success_total.clone()))?;
        registry.register(Box::new(auth_keys_reload_failure_total.clone()))?;
        registry.register(Box::new(auth_keys_active.clone()))?;
        registry.register(Box::new(janitor_sweep_duration.clone()))?;
        registry.register(Box::new(janitor_skipped_lock.clone()))?;
        registry.register(Box::new(janitor_expired_last_sweep.clone()))?;

        Ok(Self {
            registry,
            connections,
            sessions,
            sessions_expired,
            messages_total,
            messages_rejected,
            invalid_json_total,
            invalid_json_suppressed_total,
            rate_limit_violations_total,
            auth_failures_total,
            capacity_rejections,
            oversize_messages_total,
            ip_rate_limit_violations_total,
            log_suppressed_total,
            auth_keys_reload_success_total,
            auth_keys_reload_failure_total,
            auth_keys_active,
            janitor_sweep_duration,
            janitor_skipped_lock,
            janitor_expired_last_sweep,
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
    ip_limiters: Arc<DashMap<IpAddr, IpLimiterState>>,
    log_throttle: Arc<LogThrottle>,
    tracer: Arc<TraceLogger>,
}

#[derive(Debug, Clone)]
struct TokenBucket {
    capacity: f64,
    tokens: f64,
    refill_per_sec: f64,
    last_refill: Instant,
}

impl TokenBucket {
    fn new(rps: f64, burst: f64) -> Self {
        let capacity = burst.max(rps);
        Self {
            capacity,
            tokens: capacity,
            refill_per_sec: rps,
            last_refill: Instant::now(),
        }
    }

    fn allow(&mut self) -> bool {
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

#[derive(Debug, Clone)]
struct IpLimiterState {
    limiter: TokenBucket,
    last_seen: Instant,
}

#[derive(Default)]
struct LogThrottle {
    last: std::sync::Mutex<HashMap<&'static str, Instant>>,
}

impl LogThrottle {
    fn should_log(&self, category: &'static str, interval: Duration) -> bool {
        let mut guard = self.last.lock().unwrap_or_else(|p| p.into_inner());
        let now = Instant::now();
        let decision = guard
            .get(category)
            .map(|t| now.duration_since(*t) >= interval)
            .unwrap_or(true);
        if decision {
            guard.insert(category, now);
        }
        decision
    }
}

#[derive(Debug)]
struct AuthContext {
    auth_id: String,
    session_id: String,
}

#[derive(Debug)]
struct ParseErrorSampler {
    last_error: Option<Instant>,
    min_interval: Duration,
    suppressed: usize,
}

impl ParseErrorSampler {
    fn new(min_interval: Duration) -> Self {
        Self {
            last_error: None,
            min_interval,
            suppressed: 0,
        }
    }

    fn record(&mut self) -> Option<usize> {
        let now = Instant::now();
        if let Some(last) = self.last_error {
            if now.duration_since(last) < self.min_interval {
                self.suppressed += 1;
                return None;
            }
        }
        self.last_error = Some(now);
        let count = self.suppressed;
        self.suppressed = 0;
        Some(count)
    }
}

fn parse_keys(input: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for pair in input.split(',') {
        if let Some((id, key)) = pair.split_once(':') {
            map.insert(id.trim().to_string(), key.trim().to_string());
        }
    }
    map
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing();

    let config = Arc::new(Config::from_env());
    let initial_keys_len = config.auth.keys.read().map(|k| k.len() as i64).unwrap_or(0);

    if initial_keys_len == 0 {
        warn!("no API keys configured; all handshakes will be rejected");
    } else {
        info!(
            api_keys_loaded = initial_keys_len,
            "API key authentication enabled"
        );
    }

    if config.trust_proxy && std::env::var("LTP_ALLOW_PROXY_CIDR").is_err() {
        warn!("TRUST_PROXY is enabled but LTP_ALLOW_PROXY_CIDR is not set. Ensure the node is not exposed directly to the internet.");
        // We could error out here to force safe deployment (P1-1), but for now we warn.
        // Actually P1-1 says "If TRUST_PROXY=true, it must require additional guard".
        // Let's enforce it unless LTP_UNSAFE_TRUST_PROXY_ANY is set.
        if std::env::var("LTP_UNSAFE_TRUST_PROXY_ANY").is_err() {
            anyhow::bail!("TRUST_PROXY=true requires LTP_ALLOW_PROXY_CIDR to be set for security. Set LTP_UNSAFE_TRUST_PROXY_ANY=true to override (NOT RECOMMENDED).");
        }
    }

    let metrics = Arc::new(Metrics::new()?);
    let state = Arc::new(LtpNodeState::new());
    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    metrics.auth_keys_active.set(initial_keys_len);
    if matches!(config.auth.mode, AuthMode::ApiKey)
        && config
            .auth
            .keys
            .read()
            .map(|k| k.is_empty())
            .unwrap_or(true)
    {
        warn!("AUTH_MODE=api_key configured without keys; authentication will fail closed");
    }

    let tracer = Arc::new(TraceLogger::new(&config.audit_log_file).await?);
    info!(file = %config.audit_log_file, "trace integrity logger initialized");

    let ctx = AppContext {
        config: config.clone(),
        state: state.clone(),
        metrics: metrics.clone(),
        ip_limiters: Arc::new(DashMap::new()),
        log_throttle: Arc::new(LogThrottle::default()),
        tracer,
    };
    config
        .auth
        .start_reload_task(metrics.clone(), shutdown_rx.clone());

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
    let auth_identity: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let client_ip_override: Arc<Mutex<Option<IpAddr>>> = Arc::new(Mutex::new(None));
    let metrics_for_handshake = ctx.metrics.clone();
    let auth_config = ctx.config.auth.clone();
    let auth_identity_for_cb = auth_identity.clone();
    let trust_proxy = ctx.config.trust_proxy;
    let client_ip_for_cb = client_ip_override.clone();
    let identity_source = auth_config.identity_source();

    let ws_stream = match timeout(
        Duration::from_millis(ctx.config.handshake_timeout_ms),
        accept_hdr_async(stream, move |req: &Request, response: Response| {
            if !auth_config.auth_enabled() {
                return Ok(response);
            }

            if trust_proxy {
                if let Some(ip) = extract_forwarded_for(req.headers()) {
                    if let Ok(mut guard) = client_ip_for_cb.lock() {
                        *guard = Some(ip);
                    }
                }
            }

            match auth_config.authenticate_header(req) {
                Ok(identity) => {
                    if let Some(id) = identity {
                        if let Ok(mut guard) = auth_identity_for_cb.lock() {
                            *guard = Some(id);
                        }
                    }
                    Ok(response)
                }
                Err(err) => {
                    metrics_for_handshake.auth_failures_total.inc();
                    Err(*err)
                }
            }
        }),
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
    let client_ip = client_ip_override
        .lock()
        .ok()
        .and_then(|guard| *guard)
        .unwrap_or(peer.ip());
    info!(
        remote_addr = %peer,
        client_ip = %client_ip,
        identity_source = ?identity_source,
        "websocket connection established"
    );

    let (mut write, mut read) = ws_stream.split();
    let mut parse_sampler = ParseErrorSampler::new(Duration::from_secs(1));
    let mut rate_limiter = TokenBucket::new(ctx.config.rate_limit_rps, ctx.config.rate_limit_burst);
    let mut last_invalid_json_log: Option<Instant> = None;

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
                if !check_ip_rate_limit(&ctx, client_ip) {
                    if log_throttled(&ctx, "ip_rate_limit", || {
                        warn!(remote_addr = %peer, client_ip = %client_ip, "closing connection due to ip rate limit");
                    }) {
                    } else {
                        ctx.metrics
                            .log_suppressed_total
                            .with_label_values(&["ip_rate_limit"])
                            .inc();
                    }
                    ctx.metrics.ip_rate_limit_violations_total.inc();
                    ctx.metrics
                        .messages_rejected
                        .with_label_values(&["rate_limit"])
                        .inc();
                    let _ = write
                        .send(Message::Close(Some(CloseFrame {
                            code: CloseCode::Policy,
                            reason: "ip rate limit exceeded".into(),
                        })))
                        .await;
                    break;
                }

                if !rate_limiter.allow() {
                    if log_throttled(&ctx, "rate_limit", || {
                        warn!(
                            remote_addr = %peer,
                            "closing connection due to rate limit exceeded"
                        );
                    }) {
                    } else {
                        ctx.metrics
                            .log_suppressed_total
                            .with_label_values(&["rate_limit"])
                            .inc();
                    }
                    ctx.metrics.rate_limit_violations_total.inc();
                    ctx.metrics
                        .messages_rejected
                        .with_label_values(&["rate_limit"])
                        .inc();
                    let _ = write
                        .send(Message::Close(Some(CloseFrame {
                            code: CloseCode::Policy,
                            reason: "rate limit exceeded".into(),
                        })))
                        .await;
                    break;
                }

                if text.len() > ctx.config.max_message_bytes {
                    if log_throttled(&ctx, "too_large", || {
                        warn!(
                            remote_addr = %peer,
                            size = text.len(),
                            max = ctx.config.max_message_bytes,
                            "rejecting message: too large"
                        );
                    }) {
                    } else {
                        ctx.metrics
                            .log_suppressed_total
                            .with_label_values(&["too_large"])
                            .inc();
                    }
                    ctx.metrics
                        .messages_rejected
                        .with_label_values(&["too_large"])
                        .inc();
                    ctx.metrics.oversize_messages_total.inc();
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

                        if let Err(e) = ctx.tracer.log("in", &active_session, &incoming).await {
                            warn!(error = ?e, "trace logging failed for incoming message");
                        }

                        if let Some(responses) = process_message(incoming, &ctx, &auth_ctx).await {
                            let mut should_close = false;
                            for response in responses {
                                if let Err(e) = ctx.tracer.log("out", &active_session, &response).await {
                                    warn!(error = ?e, "trace logging failed for outgoing message");
                                }

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
                        if let Err(e) = ctx.tracer.log("out", &active_session, &err_msg).await {
                            warn!(error = ?e, "trace logging failed for error message");
                        }
                        if let Err(err) = send_json(&mut write, &err_msg).await {
                            warn!(remote_addr = %peer, error = ?err, "failed to send error");
                            break;
                        }
                    }
                }
            }
            Message::Binary(_) => {
                let now = Instant::now();
                let should_log = last_invalid_json_log
                    .map(|prev| now.duration_since(prev) >= Duration::from_secs(1))
                    .unwrap_or(true);
                if should_log {
                    warn!(remote_addr = %peer, "binary payloads are not supported");
                    last_invalid_json_log = Some(now);
                } else {
                    ctx.metrics.invalid_json_suppressed_total.inc();
                }
                ctx.metrics.invalid_json_total.inc();
                ctx.metrics
                    .messages_rejected
                    .with_label_values(&["invalid_json"])
                    .inc();
                let err_msg = LtpOutgoingMessage::Error {
                    code: protocol::ErrorCode::Invalid,
                    message: Some("binary messages are not supported".to_string()),
                };
                if let Err(e) = ctx.tracer.log("out", &active_session, &err_msg).await {
                    warn!(error = ?e, "trace logging failed for binary error");
                }
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
                if text.len() > ctx.config.max_message_bytes {
                    warn!(
                        remote_addr = %peer,
                        size = text.len(),
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
                        let valid = match ctx.config.auth.validate_api_key(&api_key) {
                            Ok(Some(id)) => Some(id),
                            _ => None,
                        };

                        if let Some(auth_id) = valid {
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
                            if let Err(e) = ctx.tracer.log("out", &session_id, &ack).await {
                                warn!(error = ?e, "trace logging failed for handshake ack");
                            }
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
            if created && reject_when_over_capacity(ctx, &auth.session_id) {
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
            if created && reject_when_over_capacity(ctx, &auth.session_id) {
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
        let ip_ttl = Duration::from_secs(ctx.config.ip_rate_limit_ttl_secs);
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

            let ip_removed = cleanup_ip_limiters(&ctx, ip_ttl);
            if ip_removed > 0 {
                info!(removed = ip_removed, "expired idle ip limiters");
            }

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

fn check_ip_rate_limit(ctx: &AppContext, ip: IpAddr) -> bool {
    let allow;
    let mut entry = ctx.ip_limiters.entry(ip).or_insert_with(|| IpLimiterState {
        limiter: TokenBucket::new(ctx.config.ip_rate_limit_rps, ctx.config.ip_rate_limit_burst),
        last_seen: Instant::now(),
    });
    {
        let state = entry.value_mut();
        allow = state.limiter.allow();
        state.last_seen = Instant::now();
    }

    if !allow {
        ctx.metrics.ip_rate_limit_violations_total.inc();
    }
    allow
}

fn log_throttled<F: FnOnce()>(ctx: &AppContext, category: &'static str, log_fn: F) -> bool {
    if ctx
        .log_throttle
        .should_log(category, Duration::from_secs(1))
    {
        log_fn();
        true
    } else {
        false
    }
}

fn cleanup_ip_limiters(ctx: &AppContext, ttl: Duration) -> usize {
    let now = Instant::now();
    let mut removed = 0;
    ctx.ip_limiters.retain(|_, v| {
        let keep = now.duration_since(v.last_seen) < ttl;
        if !keep {
            removed += 1;
        }
        keep
    });
    removed
}

fn hash_string(input: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    input.hash(&mut hasher);
    hasher.finish()
}

#[cfg(test)]
mod auth_unit_tests {
    use super::*;

    #[test]
    fn parse_keys_handles_pairs() {
        let map = parse_keys("id1:key1, id2:key2 , bad , id3:key3");
        assert_eq!(map.get("id1").unwrap(), "key1");
        assert_eq!(map.get("id2").unwrap(), "key2");
        assert_eq!(map.get("id3").unwrap(), "key3");
        assert_eq!(map.len(), 3);
    }

    #[test]
    fn constant_time_compare_matches() {
        let config = AuthConfig {
            mode: AuthMode::ApiKey,
            keys: Arc::new(std::sync::RwLock::new(HashMap::from([(
                "id".to_string(),
                "supersecret".to_string(),
            )]))),
            jwt_secret: None,
            keys_file: None,
            keys_reload_interval: Duration::from_secs(30),
            last_loaded_hash: Arc::new(Mutex::new(None)),
            fail_closed: Arc::new(AtomicBool::new(false)),
        };
        assert!(config.validate_api_key("supersecret").unwrap().is_some());
        assert!(config.validate_api_key("wrong").unwrap().is_none());
    }
}
