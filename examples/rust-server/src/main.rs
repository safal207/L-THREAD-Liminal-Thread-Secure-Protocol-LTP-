use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use uuid::Uuid;

type ThreadStore = Arc<Mutex<HashMap<String, ThreadState>>>;
type SessionStore = Arc<Mutex<HashMap<String, SessionState>>>;

#[derive(Clone)]
struct ThreadState {
    thread_id: String,
    last_session_id: String,
    client_id: String,
    last_seen: u64,
}

#[derive(Clone)]
struct SessionState {
    session_id: String,
    thread_id: String,
    client_id: String,
    connected_at: u64,
}

struct LTPServer {
    threads: ThreadStore,
    sessions: SessionStore,
    tx: broadcast::Sender<String>,
}

impl LTPServer {
    fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        Self {
            threads: Arc::new(Mutex::new(HashMap::new())),
            sessions: Arc::new(Mutex::new(HashMap::new())),
            tx,
        }
    }

    fn create_handshake_ack(&self, thread_id: &str, session_id: &str, resumed: bool) -> Value {
        json!({
            "type": "handshake_ack",
            "ltp_version": "0.3",
            "thread_id": thread_id,
            "session_id": session_id,
            "resumed": resumed,
            "server_capabilities": ["state-update", "ping-pong", "events"],
            "heartbeat_interval_ms": 15000,
            "metadata": {
                "server_version": "0.1.0",
                "region": "local"
            }
        })
    }

    fn create_handshake_reject(&self, reason: &str) -> Value {
        json!({
            "type": "handshake_reject",
            "ltp_version": "0.3",
            "reason": reason,
            "suggest_new": true
        })
    }

    fn register_thread(&self, thread_id: String, session_id: String, client_id: String) {
        let thread = ThreadState {
            thread_id: thread_id.clone(),
            last_session_id: session_id.clone(),
            client_id: client_id.clone(),
            last_seen: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        };

        let session = SessionState {
            session_id: session_id.clone(),
            thread_id: thread_id.clone(),
            client_id: client_id.clone(),
            connected_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        };

        self.threads.lock().unwrap().insert(thread_id, thread);
        self.sessions.lock().unwrap().insert(session_id, session);
    }

    fn get_thread(&self, thread_id: &str) -> Option<ThreadState> {
        self.threads.lock().unwrap().get(thread_id).cloned()
    }
}

#[tokio::main]
async fn main() {
    let server = Arc::new(LTPServer::new());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080")
        .await
        .expect("Failed to bind");

    println!("[LTP Server] Listening on ws://localhost:8080");

    while let Ok((stream, addr)) = listener.accept().await {
        let server = server.clone();
        tokio::spawn(async move {
            handle_connection(stream, addr, server).await;
        });
    }
}

async fn handle_connection(
    stream: tokio::net::TcpStream,
    addr: std::net::SocketAddr,
    server: Arc<LTPServer>,
) {
    println!("[LTP Server] New connection from {}", addr);

    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("[LTP Server] WebSocket handshake failed: {}", e);
            return;
        }
    };

    let (mut write, mut read) = ws_stream.split();
    let mut thread_id: Option<String> = None;
    let mut session_id: Option<String> = None;
    let mut client_id: Option<String> = None;

    while let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                match serde_json::from_str::<Value>(&text) {
                    Ok(message) => {
                        let msg_type = message["type"].as_str().unwrap_or("");

                        match msg_type {
                            "handshake_init" => {
                                let new_thread_id = Uuid::new_v4().to_string();
                                let new_session_id = Uuid::new_v4().to_string();
                                let new_client_id = message["client_id"]
                                    .as_str()
                                    .unwrap_or("unknown")
                                    .to_string();

                                server.register_thread(
                                    new_thread_id.clone(),
                                    new_session_id.clone(),
                                    new_client_id.clone(),
                                );

                                let ack = server.create_handshake_ack(
                                    &new_thread_id,
                                    &new_session_id,
                                    false,
                                );

                                thread_id = Some(new_thread_id);
                                session_id = Some(new_session_id);
                                client_id = Some(new_client_id);

                                println!(
                                    "[LTP Server] Handshake completed: thread={}, session={}",
                                    thread_id.as_ref().unwrap(),
                                    session_id.as_ref().unwrap()
                                );

                                if write.send(Message::Text(ack.to_string())).await.is_err() {
                                    break;
                                }
                            }
                            "handshake_resume" => {
                                let resume_thread_id = message["thread_id"]
                                    .as_str()
                                    .unwrap_or("")
                                    .to_string();
                                let resume_client_id = message["client_id"]
                                    .as_str()
                                    .unwrap_or("unknown")
                                    .to_string();

                                match server.get_thread(&resume_thread_id) {
                                    Some(_) => {
                                        let new_session_id = Uuid::new_v4().to_string();
                                        server.register_thread(
                                            resume_thread_id.clone(),
                                            new_session_id.clone(),
                                            resume_client_id.clone(),
                                        );

                                        let ack = server.create_handshake_ack(
                                            &resume_thread_id,
                                            &new_session_id,
                                            true,
                                        );

                                        thread_id = Some(resume_thread_id);
                                        session_id = Some(new_session_id);
                                        client_id = Some(resume_client_id);

                                        println!(
                                            "[LTP Server] Handshake resumed: thread={}, session={}",
                                            thread_id.as_ref().unwrap(),
                                            session_id.as_ref().unwrap()
                                        );

                                        if write.send(Message::Text(ack.to_string())).await.is_err()
                                        {
                                            break;
                                        }
                                    }
                                    None => {
                                        let reject = server.create_handshake_reject("Thread not found");
                                        if write.send(Message::Text(reject.to_string())).await.is_err() {
                                            break;
                                        }
                                    }
                                }
                            }
                            "ping" => {
                                let pong = json!({
                                    "type": "pong",
                                    "thread_id": message["thread_id"],
                                    "session_id": message["session_id"],
                                    "timestamp": std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap()
                                        .as_secs()
                                });

                                if write.send(Message::Text(pong.to_string())).await.is_err() {
                                    break;
                                }
                            }
                            "state_update" => {
                                let payload = &message["payload"];
                                let kind = payload["kind"].as_str().unwrap_or("unknown");
                                let content_encoding = message["content_encoding"]
                                    .as_str()
                                    .unwrap_or("json");

                                println!(
                                    "[LTP Server] Received state_update: thread={}, kind={}, encoding={}",
                                    thread_id.as_ref().unwrap_or(&"unknown".to_string()),
                                    kind,
                                    content_encoding
                                );
                            }
                            "event" => {
                                let payload = &message["payload"];
                                let event_type = payload["event_type"].as_str().unwrap_or("unknown");

                                println!(
                                    "[LTP Server] Received event: thread={}, type={}",
                                    thread_id.as_ref().unwrap_or(&"unknown".to_string()),
                                    event_type
                                );
                            }
                            _ => {
                                println!("[LTP Server] Unknown message type: {}", msg_type);
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("[LTP Server] Failed to parse message: {}", e);
                    }
                }
            }
            Ok(Message::Close(_)) => {
                println!("[LTP Server] Connection closed");
                break;
            }
            Err(e) => {
                eprintln!("[LTP Server] WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }
}

