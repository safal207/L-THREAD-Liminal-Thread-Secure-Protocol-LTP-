"""Executable regression contracts for confirmed LTP protocol security gaps.

These tests describe secure behavior. Do not mark them xfail, skip them, or weaken
their assertions: a failure means an SDK boundary has diverged again.
"""

from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path

import pytest

from ltp_client import LtpClient
from ltp_client.client import ThreadStorage
from ltp_client.crypto import _serialize_canonical


ROOT = Path(__file__).resolve().parents[3]


def _javascript_canonical(message: dict) -> str:
    """Return the actual canonical bytes produced by the built JS SDK."""

    script = r"""
const fs = require('fs');
const { serializeCanonical } = require('./sdk/js/dist/crypto');
const message = JSON.parse(fs.readFileSync(0, 'utf8'));
process.stdout.write(serializeCanonical(message));
"""
    result = subprocess.run(
        ["node", "-e", script],
        cwd=ROOT,
        input=json.dumps(message, ensure_ascii=False),
        text=True,
        capture_output=True,
        check=True,
    )
    return result.stdout


def _envelope(payload: dict) -> dict:
    return {
        "type": "state_update",
        "thread_id": "thread-123",
        "session_id": "session-456",
        "timestamp": 1_700_000_000_000,
        "nonce": "hmac-0123456789abcdef0123456789abcdef-1700000000000",
        "payload": payload,
        "prev_message_hash": "ab" * 32,
        "meta": {"client_id": "client-123"},
        "content_encoding": "json",
    }


def test_p0_cross_sdk_canonical_bytes_are_identical() -> None:
    """JS and Python must sign exactly the same bytes for every legal envelope."""

    envelope = _envelope(
        {
            "integer_looking_float": 1.0,
            "negative_zero": -0.0,
            "small_exponent": 1e-7,
            "unicode": "Лиминальный поток 🌌",
        }
    )

    python_bytes = _serialize_canonical(envelope)
    javascript_bytes = _javascript_canonical(envelope)

    assert javascript_bytes == python_bytes, (
        "P0: JS and Python produced different canonical bytes. A protocol message "
        "signed by one SDK can fail verification in another SDK. Adopt one normative "
        "canonical format and shared golden vectors before weakening this assertion.\n"
        f"Python:    {python_bytes}\n"
        f"JavaScript:{javascript_bytes}"
    )


@pytest.mark.parametrize(
    "payload",
    [
        {
            "fixed_lower_boundary": 1e-6,
            "exponent_below_boundary": 1e-7,
            "fixed_upper_value": 1e20,
            "exponent_upper_boundary": 1e21,
            "large_exponent": 1e30,
            "small_exponent": 1e-27,
        },
        {
            "rounding_case": 333333333.33333329,
            "simple_fraction": 4.5,
            "small_fixed": 2e-3,
            "nested": [1.0, -0.0, {"again": -0.0, "tiny": 1e-7}],
        },
        {
            # UTF-16 orders the supplementary key by its leading surrogate, before
            # U+E000; Unicode code-point ordering would put U+E000 first.
            "key_order": {"\ue000": "bmp-private-use", "😀": "supplementary"},
            "unicode": "ключ 🔐",
        },
    ],
)
def test_canonical_differential_edge_matrix(payload: dict) -> None:
    envelope = _envelope(payload)
    assert _javascript_canonical(envelope) == _serialize_canonical(envelope)


@pytest.mark.asyncio
async def test_p0_rejected_python_message_cannot_mutate_hash_chain(tmp_path: Path) -> None:
    """An unauthenticated frame must not poison the committed receive-chain state."""

    client = LtpClient(
        url="ws://localhost:8080",
        client_id="security-regression-client",
        storage=ThreadStorage(str(tmp_path / "thread-storage.json")),
        session_mac_key="trusted-session-key",
        require_signature_verification=True,
    )
    client.thread_id = "thread-123"
    client.session_id = "session-456"
    client._last_received_hash = None

    forged = {
        "type": "state_update",
        "thread_id": "thread-123",
        "session_id": "session-456",
        "timestamp": int(time.time() * 1000),
        "nonce": "hmac-0123456789abcdef0123456789abcdef-1700000000000",
        "payload": {"kind": "forged", "data": {"value": 999}},
        "meta": {"client_id": "attacker"},
        "content_encoding": "json",
        "signature": "00" * 32,
    }

    await client._handle_message(forged)

    assert client._last_received_hash is None, (
        "P0: Python committed last_received_hash before authenticating the frame. "
        "A forged frame can poison chain state and deny the next valid message. Move "
        "all state mutation after signature, freshness, replay, and chain validation."
    )


def test_p0_rust_receive_loop_enforces_security_pipeline() -> None:
    """The live Rust receive loop must call the security checks it advertises."""

    source = (ROOT / "sdk/rust/ltp-client/src/client.rs").read_text(encoding="utf-8")
    start = source.index("tokio::spawn(async move")
    end = source.index("        Ok(())", start)
    receive_loop = source[start:end]

    assert "TODO: Parse and process LTP messages with security features" not in receive_loop, (
        "P0: Rust still contains a placeholder receive path instead of enforcing the "
        "advertised protocol security properties."
    )
    assert "verify_signature" in receive_loop, (
        "P0: the live Rust receive loop does not verify message authentication."
    )
    assert "verify_hash_chain" in receive_loop, (
        "P0: the live Rust receive loop does not verify the receive hash chain."
    )
    assert ("validate_nonce" in receive_loop or "seen_nonces" in receive_loop), (
        "P0: the live Rust receive loop does not enforce replay protection."
    )
    assert "let wire_message = message.clone();" in receive_loop, (
        "P0: encrypted Rust frames must commit the original wire envelope to the hash chain."
    )
    assert "verify_hash_chain(\n                            &wire_message" in receive_loop, (
        "P0: Rust is hashing the decrypted logical envelope instead of the transmitted bytes."
    )


def test_p0_elixir_authenticates_before_application_dispatch() -> None:
    """Elixir must authenticate and validate chain state before handle_message/2."""

    source = (ROOT / "sdk/elixir/lib/ltp/connection.ex").read_text(encoding="utf-8")
    start = source.index("def handle_frame({:text, json}, state)")
    end = source.index("  @impl WebSockex", start + 1)
    inbound = source[start:end]

    assert "LTP.Crypto.verify_signature" in inbound, (
        "P0: Elixir dispatches inbound protocol messages without verifying the HMAC "
        "signature on the real receive path."
    )
    assert ("verify_hash_chain" in inbound or "last_received_hash" in inbound), (
        "P0: Elixir dispatches inbound protocol messages without validating and "
        "atomically committing the receive hash chain."
    )

    dispatch_index = inbound.index("handle_message")
    signature_index = inbound.index("LTP.Crypto.verify_signature")
    assert signature_index < dispatch_index, (
        "P0: Elixir application dispatch occurs before authentication."
    )
