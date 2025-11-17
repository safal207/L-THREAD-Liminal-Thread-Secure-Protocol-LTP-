use thiserror::Error;

pub type Result<T> = std::result::Result<T, LtpError>;

#[derive(Error, Debug)]
pub enum LtpError {
    #[error("websocket error: {0}")]
    WebSocket(#[from] tokio_tungstenite::tungstenite::Error),

    #[error("serde json error: {0}")]
    SerdeJson(#[from] serde_json::Error),

    #[error("handshake failed: {0}")]
    Handshake(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("not connected")]
    NotConnected,

    #[error("invalid state: {0}")]
    InvalidState(String),
}

