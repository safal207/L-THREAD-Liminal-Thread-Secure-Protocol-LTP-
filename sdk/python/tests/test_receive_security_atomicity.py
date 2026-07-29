"""Regression tests for Python inbound security-state atomicity."""

import asyncio
from unittest.mock import MagicMock

from ltp_client import LtpClient
from ltp_client.client import LtpClient as DirectImportLtpClient
from ltp_client.crypto import hash_envelope


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
