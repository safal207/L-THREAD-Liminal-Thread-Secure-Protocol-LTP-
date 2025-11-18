"""
Tests for LTP Python SDK client
"""

import asyncio

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from ltp_client import LtpClient
from ltp_client.crypto import sign_message
from ltp_client.types import HandshakeAck


class TestLtpClient:
    def test_client_initialization(self):
        client = LtpClient(
            url="ws://localhost:8080",
            client_id="test-client"
        )
        assert client.url == "ws://localhost:8080"
        assert client.client_id == "test-client"
        assert client.intent == "resonant_link"
        assert client.capabilities == ["state-update", "events", "ping-pong"]

    def test_client_with_options(self):
        client = LtpClient(
            url="ws://localhost:8080",
            client_id="test-client",
            intent="custom_intent",
            capabilities=["custom-capability"],
            default_context_tag="test-context"
        )
        assert client.intent == "custom_intent"
        assert client.capabilities == ["custom-capability"]
        assert client.default_context_tag == "test-context"

    def test_handshake_ack_handling(self):
        client = LtpClient(
            url="ws://localhost:8080",
            client_id="test-client"
        )
        
        ack_data = {
            "type": "handshake_ack",
            "ltp_version": "0.3",
            "thread_id": "thread-123",
            "session_id": "session-456",
            "heartbeat_interval_ms": 15000
        }
        
        # Mock the storage
        async def run_test():
            with patch.object(client.storage, 'set_ids') as mock_set_ids:
                await client._handle_handshake_ack(ack_data)

                assert client.thread_id == "thread-123"
                assert client.session_id == "session-456"
                assert client.heartbeat_interval_ms == 15000
                assert client.is_connected is True
                assert client.is_handshake_complete is True
                mock_set_ids.assert_called_once_with("test-client", "thread-123", "session-456")

        asyncio.run(run_test())

    def test_generate_client_id(self):
        client = LtpClient(url="ws://localhost:8080")
        assert client.client_id is not None
        assert len(client.client_id) > 0

    def test_build_envelope(self):
        client = LtpClient(
            url="ws://localhost:8080",
            client_id="test-client",
            default_context_tag="test-context"
        )
        client.thread_id = "thread-123"
        client.session_id = "session-456"

        envelope = client._build_envelope(
            msg_type="state_update",
            payload={"kind": "test", "data": {}}
        )
        
        assert envelope["type"] == "state_update"
        assert envelope["thread_id"] == "thread-123"
        assert envelope["session_id"] == "session-456"
        assert envelope.get("content_encoding", "json") == "json"
        assert envelope["meta"]["client_id"] == "test-client"
        assert envelope["meta"]["context_tag"] == "test-context"

    def test_signature_verification_blocks_tampering(self):
        client = LtpClient(
            url="ws://localhost:8080",
            client_id="test-client",
            session_mac_key="super-secret",
            require_signature_verification=True,
        )
        client.thread_id = "thread-123"
        client.session_id = "session-456"
        client.on_state_update = MagicMock()

        message = client._build_envelope(
            msg_type="state_update",
            payload={"kind": "test", "data": {"value": 1}},
        )

        # Tamper with the payload to invalidate the signature
        message["payload"]["value"] = 999

        async def run_test():
            await client._handle_message(message)

            client.on_state_update.assert_not_called()

        asyncio.run(run_test())

    def test_replay_detection_rejects_duplicate_nonce(self):
        client = LtpClient(
            url="ws://localhost:8080",
            client_id="test-client",
            session_mac_key="super-secret",
            require_signature_verification=True,
        )
        client.thread_id = "thread-123"
        client.session_id = "session-456"
        client.on_state_update = MagicMock()

        message = client._build_envelope(
            msg_type="state_update",
            payload={"kind": "test", "data": {"value": 1}},
        )

        async def run_test():
            # First message should be accepted
            await client._handle_message(message)
            client.on_state_update.assert_called_once()

            # Replaying the exact same message should be rejected
            await client._handle_message(message)
            client.on_state_update.assert_called_once()

        asyncio.run(run_test())

    def test_valid_signature_allows_message_processing(self):
        client = LtpClient(
            url="ws://localhost:8080",
            client_id="test-client",
            session_mac_key="super-secret",
            require_signature_verification=True,
        )
        client.thread_id = "thread-123"
        client.session_id = "session-456"
        client.on_state_update = MagicMock()

        message = client._build_envelope(
            msg_type="state_update",
            payload={"kind": "test", "data": {"value": 1}},
        )

        # Ensure signature matches message by regenerating explicitly
        message["signature"] = sign_message(message, "super-secret")

        async def run_test():
            await client._handle_message(message)

            client.on_state_update.assert_called_once()

        asyncio.run(run_test())

