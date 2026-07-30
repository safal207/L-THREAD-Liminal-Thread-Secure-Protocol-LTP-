import asyncio
import time
from pathlib import Path
from unittest.mock import MagicMock

from ltp_client import LtpClient
from ltp_client.client import ThreadStorage
from ltp_client.crypto import sign_message


def _pong(key: str, nonce: str) -> dict:
    message = {
        "type": "pong", "thread_id": "thread-1", "session_id": "session-1",
        "timestamp": int(time.time() * 1000), "nonce": nonce, "payload": {},
        "meta": {"client_id": "server"}, "content_encoding": "json",
    }
    message["signature"] = sign_message(message, key)
    return message


def test_control_authentication_and_resume_state(tmp_path: Path) -> None:
    storage = ThreadStorage(str(tmp_path / "state.json"))
    client = LtpClient(
        url="ws://localhost:8080", client_id="control-client", storage=storage,
        session_mac_key="session-control-key", require_signature_verification=False,
        heartbeat_options={"enabled": False},
    )
    client.thread_id = "thread-1"; client.session_id = "session-1"
    client.is_connected = True; client.is_handshake_complete = True
    storage.set_ids(client.client_id, client.thread_id, client.session_id)
    client.on_pong = MagicMock()

    unsigned = _pong("session-control-key", f"hmac-0123456789abcdef0123456789abcdef-{int(time.time() * 1000)}")
    unsigned.pop("signature")
    asyncio.run(client._handle_message(unsigned))
    client.on_pong.assert_not_called()
    assert client._last_received_hash is None

    nonce = f"hmac-abcdef0123456789abcdef0123456789-{int(time.time() * 1000)}"
    signed = _pong("session-control-key", nonce)
    asyncio.run(client._handle_message(signed))
    client.on_pong.assert_called_once()
    committed = client._last_received_hash
    asyncio.run(client._handle_message(signed))
    client.on_pong.assert_called_once()
    assert client._last_received_hash == committed

    client._last_sent_hash = "sent-hash"
    client._persist_security_state()
    restored = LtpClient(
        url="ws://localhost:8080", client_id="control-client", storage=storage,
        session_mac_key="session-control-key", heartbeat_options={"enabled": False},
    )
    assert restored._last_sent_hash == "sent-hash"
    assert restored._last_received_hash == committed
    assert nonce in restored._seen_nonces

    asyncio.run(restored._handle_handshake_ack({
        "type": "handshake_ack", "ltp_version": "0.6", "thread_id": "thread-1",
        "session_id": "session-1", "heartbeat_interval_ms": 1000, "resumed": True,
    }))
    assert restored._last_received_hash == committed

    asyncio.run(restored._handle_handshake_ack({
        "type": "handshake_ack", "ltp_version": "0.6", "thread_id": "thread-2",
        "session_id": "session-2", "heartbeat_interval_ms": 1000, "resumed": False,
    }))
    assert restored._last_received_hash is None
    assert restored._seen_nonces == {}


def test_control_send_without_session_key_fails_closed(tmp_path: Path) -> None:
    storage = ThreadStorage(str(tmp_path / "state.json"))
    client = LtpClient(url="ws://localhost:8080", client_id="no-key", storage=storage)
    client.thread_id = "thread"; client.session_id = "session"; client.is_connected = True
    client.ws = MagicMock()
    asyncio.run(client.send_ping())
    client.ws.send.assert_not_called()
