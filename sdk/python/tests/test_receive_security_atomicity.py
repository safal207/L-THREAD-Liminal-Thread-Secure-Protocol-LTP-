"""Regression tests for Python inbound security-state atomicity."""

import asyncio
from unittest.mock import MagicMock

from ltp_client import LtpClient
from ltp_client.client import LtpClient as DirectImportLtpClient
from ltp_client.crypto import decrypt_metadata, hash_envelope, verify_signature


def test_public_and_direct_imports_use_hardened_client():
    assert LtpClient is DirectImportLtpClient
    assert LtpClient.__name__ == "SecureLtpClient"


def test_rejected_frame_cannot_mutate_state_or_reach_callbacks():
    client = LtpClient(
        url="ws://localhost:8080",
        client_id="atomicity-test-client",
        session_mac_key="super-secret",
        require_signature_verification=True,
    )
    client.thread_id = "thread-123"
    client.session_id = "session-456"
    client.on_message = MagicMock()
    client.on_state_update = MagicMock()

    message = client._build_envelope(
        msg_type="state_update",
        payload={"kind": "test", "data": {"value": 1}},
    )
    nonce = message["nonce"]
    message["payload"]["data"]["value"] = 999

    asyncio.run(client._handle_message(message))

    assert client._last_received_hash is None
    assert nonce not in client._seen_nonces
    client.on_message.assert_not_called()
    client.on_state_update.assert_not_called()


def test_required_signature_without_mac_key_fails_closed():
    client = LtpClient(
        url="ws://localhost:8080",
        client_id="missing-mac-key-client",
        require_signature_verification=True,
    )
    client.on_message = MagicMock()
    client.on_state_update = MagicMock()

    message = {
        "type": "state_update",
        "thread_id": "thread-123",
        "session_id": "session-456",
        "timestamp": 1_700_000_000_000,
        "nonce": "untrusted-nonce",
        "payload": {"kind": "test", "data": {"value": 1}},
        "meta": {},
        "content_encoding": "json",
        "prev_message_hash": "",
        "signature": "attacker-controlled",
    }

    asyncio.run(client._handle_message(message))

    assert client._last_received_hash is None
    assert client._seen_nonces == {}
    client.on_message.assert_not_called()
    client.on_state_update.assert_not_called()


def test_encrypted_metadata_without_session_key_fails_closed():
    client = LtpClient(
        url="ws://localhost:8080",
        client_id="missing-encryption-key-client",
        require_signature_verification=False,
    )
    client.on_message = MagicMock()
    client.on_state_update = MagicMock()

    message = {
        "type": "state_update",
        "thread_id": "",
        "session_id": None,
        "timestamp": 0,
        "nonce": "untrusted-nonce",
        "payload": {"kind": "test", "data": {"value": 1}},
        "meta": {},
        "content_encoding": "json",
        "prev_message_hash": "",
        "encrypted_metadata": "ciphertext:iv:tag",
        "signature": "attacker-controlled",
    }

    asyncio.run(client._handle_message(message))

    assert client._last_received_hash is None
    assert client._seen_nonces == {}
    client.on_message.assert_not_called()
    client.on_state_update.assert_not_called()


def test_accepted_frame_commits_state_before_dispatch():
    client = LtpClient(
        url="ws://localhost:8080",
        client_id="atomicity-valid-client",
        session_mac_key="super-secret",
        require_signature_verification=True,
    )
    client.thread_id = "thread-123"
    client.session_id = "session-456"

    observed_hashes = []
    client.on_message = lambda _message: observed_hashes.append(client._last_received_hash)
    client.on_state_update = MagicMock()

    message = client._build_envelope(
        msg_type="state_update",
        payload={"kind": "test", "data": {"value": 1}},
    )
    expected_hash = hash_envelope(message)

    asyncio.run(client._handle_message(message))

    assert client._last_received_hash == expected_hash
    assert observed_hashes == [expected_hash]
    assert message["nonce"] in client._seen_nonces
    client.on_state_update.assert_called_once_with(
        {"kind": "test", "data": {"value": 1}}
    )


def test_encrypted_outbound_signs_logical_envelope_and_hashes_wire(tmp_path):
    mac_key = "11" * 32
    encryption_key = "22" * 32
    client = LtpClient(
        url="ws://localhost:8080",
        client_id="encrypted-outbound-client",
        session_mac_key=mac_key,
        require_signature_verification=True,
        enable_metadata_encryption=True,
        storage_path=str(tmp_path / "ltp-state.json"),
    )
    client.thread_id = "thread-encrypted"
    client.session_id = "session-encrypted"
    client._session_encryption_key = encryption_key

    wire = client._build_envelope(
        msg_type="event",
        payload={"event_type": "wp2", "data": {"scenario_id": "encrypted-signature"}},
    )

    assert wire["thread_id"] == ""
    assert wire["session_id"] == ""
    assert wire["timestamp"] == 0
    metadata = decrypt_metadata(wire["encrypted_metadata"], encryption_key)
    logical = dict(wire)
    logical.update(metadata)

    assert verify_signature(logical, mac_key)
    assert not verify_signature(wire, mac_key)
    assert client._last_sent_hash == hash_envelope(wire)
