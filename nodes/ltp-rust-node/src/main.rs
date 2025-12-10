mod node;
mod protocol;
mod state;
#[cfg(test)]
mod tests;

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::Context;
use futures_util::{SinkExt, StreamExt};
use protocol::{LtpIncomingMessage, LtpOutgoingMessage};
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use uuid::Uuid;

use crate::node::build_route_suggestion;
use crate::state::LtpNodeState;

type SharedState = Arc<Mutex<LtpNodeState>>;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let addr = std::env::var("LTP_NODE_ADDR").unwrap_or_else(|_| "127.0.0.1:7070".to_string());
    let node_id = std::env::var("LTP_NODE_ID").unwrap_or_else(|_| format!("ltp-node-{}", Uuid::new_v4()));

    let listener = TcpListener::bind(&addr)
        .await
        .with_context(|| format!("failed to bind to {addr}"))?;

    println!("[ltp-rust-node] listening on ws://{addr} with node_id={node_id}");

    let state: SharedState = Arc::new(Mutex::new(LtpNodeState::new()));

    while let Ok((stream, peer)) = listener.accept().await {
        let state = state.clone();
        let node_id = node_id.clone();
        tokio::spawn(async move {
            if let Err(err) = handle_connection(stream, peer, state, node_id).await {
                eprintln!("[ltp-rust-node] connection error: {err:?}");
            }
        });
    }

    Ok(())
}

async fn handle_connection(
    stream: tokio::net::TcpStream,
    peer: SocketAddr,
    state: SharedState,
    node_id: String,
) -> anyhow::Result<()> {
    println!("[ltp-rust-node] new connection from {peer}");
    let ws_stream = accept_async(stream)
        .await
        .context("websocket handshake failed")?;

    let (mut write, mut read) = ws_stream.split();

    while let Some(msg) = read.next().await {
        let msg = match msg {
            Ok(m) => m,
            Err(err) => {
                eprintln!("[ltp-rust-node] websocket error: {err}");
                break;
            }
        };

        match msg {
            Message::Text(text) => {
                let responses = match serde_json::from_str::<LtpIncomingMessage>(&text) {
                    Ok(incoming) => process_message(incoming, &state, &node_id).await,
                    Err(err) => Some(vec![LtpOutgoingMessage::Error {
                        message: format!("invalid message: {err}"),
                    }]),
                };

                if let Some(responses) = responses {
                    for response in responses {
                        if let Err(err) = send_json(&mut write, &response).await {
                            eprintln!("[ltp-rust-node] failed to send response: {err:?}");
                            break;
                        }
                    }
                }
            }
            Message::Binary(_) => {
                let err_msg = LtpOutgoingMessage::Error {
                    message: "binary messages are not supported".to_string(),
                };
                if let Err(err) = send_json(&mut write, &err_msg).await {
                    eprintln!("[ltp-rust-node] failed to send binary error: {err:?}");
                    break;
                }
            }
            Message::Close(_) => break,
            Message::Ping(p) => {
                if let Err(err) = write.send(Message::Pong(p)).await {
                    eprintln!("[ltp-rust-node] failed to respond to ping: {err:?}");
                    break;
                }
            }
            Message::Pong(_) => {}
            _ => {}
        }
    }

    println!("[ltp-rust-node] connection from {peer} closed");
    Ok(())
}

async fn process_message(
    incoming: LtpIncomingMessage,
    state: &SharedState,
    node_id: &str,
) -> Option<Vec<LtpOutgoingMessage>> {
    match incoming {
        LtpIncomingMessage::Hello { client_id, .. } => {
            let mut guard = state.lock().await;
            guard.touch_heartbeat(&client_id);
            Some(vec![LtpOutgoingMessage::HelloAck {
                node_id: node_id.to_string(),
                accepted: true,
            }])
        }
        LtpIncomingMessage::Heartbeat {
            client_id,
            timestamp_ms,
        } => {
            let mut guard = state.lock().await;
            guard.touch_heartbeat(&client_id);
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
            let mut guard = state.lock().await;
            guard.update_orientation(&client_id, focus_momentum, time_orientation);
            None
        }
        LtpIncomingMessage::RouteRequest { client_id, .. } => {
            let guard = state.lock().await;
            Some(vec![build_route_suggestion(&guard, &client_id)])
        }
    }
}

async fn send_json(
    write: &mut futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
        Message,
    >,
    message: &LtpOutgoingMessage,
) -> anyhow::Result<()> {
    let payload = serde_json::to_string(message)?;
    write.send(Message::Text(payload)).await?;
    Ok(())
}
