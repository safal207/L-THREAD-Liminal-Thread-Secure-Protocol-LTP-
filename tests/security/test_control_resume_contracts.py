from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def source(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_control_frames_require_negotiated_session_keys() -> None:
    js = source("sdk/js/src/client.ts")
    py = source("sdk/python/ltp_client/secure_client.py") + source("sdk/python/ltp_client/client.py")
    rust = source("sdk/rust/ltp-client/src/client.rs")
    ex = source("sdk/elixir/lib/ltp/connection.ex")
    assert "requireControlMacKey" in js and "isControlMessage" in js
    assert "_session_mac_key" in py and 'message_type in {"ping", "pong"}' in py
    assert "Post-handshake control frame requires negotiated session MAC key" in rust
    assert 'when type in ["handshake_ack", "handshake_reject"]' in ex
    assert "secure_control_frame" in ex


def test_resume_preserves_committed_security_namespace() -> None:
    js = source("sdk/js/src/client.ts")
    py = source("sdk/python/ltp_client/client.py")
    rust = source("sdk/rust/ltp-client/src/client.rs")
    ex = source("sdk/elixir/lib/ltp/connection.ex")
    assert "persistSecurityState" in js and "resumedSameSession" in js
    assert "_persist_security_state" in py and "resumed_same_session" in py
    assert "ReceiveSecuritySnapshot" in rust and "receive_generation" in rust
    assert "security_state_initialized" in ex and "resumed_same_session" in ex
