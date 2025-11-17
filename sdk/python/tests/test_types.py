"""
Tests for LTP Python SDK types
"""

import pytest
from ltp_client.types import (
    HandshakeInit,
    HandshakeAck,
    LtpEnvelope,
    LtpMeta,
    StateUpdatePayload,
    EventPayload,
    ErrorPayload,
)


class TestHandshakeInit:
    def test_create_handshake_init(self):
        init = HandshakeInit(
            client_id="test-client",
            ltp_version="0.3",
            intent="resonant_link",
            capabilities=["state-update", "events"]
        )
        assert init.type == "handshake_init"
        assert init.client_id == "test-client"
        assert init.ltp_version == "0.3"

    def test_handshake_init_to_dict(self):
        init = HandshakeInit(
            client_id="test-client",
            device_fingerprint="test-device"
        )
        data = init.to_dict()
        assert data["type"] == "handshake_init"
        assert data["client_id"] == "test-client"
        assert data["device_fingerprint"] == "test-device"


class TestHandshakeAck:
    def test_handshake_ack_from_dict(self):
        data = {
            "type": "handshake_ack",
            "ltp_version": "0.3",
            "thread_id": "thread-123",
            "session_id": "session-456",
            "heartbeat_interval_ms": 15000
        }
        ack = HandshakeAck.from_dict(data)
        assert ack.type == "handshake_ack"
        assert ack.thread_id == "thread-123"
        assert ack.session_id == "session-456"
        assert ack.heartbeat_interval_ms == 15000


class TestLtpEnvelope:
    def test_create_envelope(self):
        envelope = LtpEnvelope(
            type="state_update",
            thread_id="thread-123",
            session_id="session-456",
            timestamp=1234567890,
            payload={"kind": "test", "data": {}}
        )
        assert envelope.type == "state_update"
        assert envelope.thread_id == "thread-123"
        assert envelope.content_encoding is None  # Defaults to None (JSON)

    def test_envelope_with_content_encoding(self):
        envelope = LtpEnvelope(
            type="state_update",
            thread_id="thread-123",
            session_id="session-456",
            timestamp=1234567890,
            payload={"kind": "test", "data": {}},
            content_encoding="toon"
        )
        assert envelope.content_encoding == "toon"

    def test_envelope_to_dict(self):
        envelope = LtpEnvelope(
            type="state_update",
            thread_id="thread-123",
            session_id="session-456",
            timestamp=1234567890,
            payload={"kind": "test", "data": {}},
            content_encoding="toon"
        )
        data = envelope.to_dict()
        assert data["type"] == "state_update"
        assert data["content_encoding"] == "toon"
        assert "nonce" not in data  # None values excluded

    def test_envelope_from_dict(self):
        data = {
            "type": "state_update",
            "thread_id": "thread-123",
            "session_id": "session-456",
            "timestamp": 1234567890,
            "payload": {"kind": "test", "data": {}},
            "content_encoding": "toon"
        }
        envelope = LtpEnvelope.from_dict(data)
        assert envelope.type == "state_update"
        assert envelope.content_encoding == "toon"


class TestLtpMeta:
    def test_meta_to_dict(self):
        meta = LtpMeta(
            client_id="test-client",
            context_tag="test-context",
            affect={"valence": 0.2, "arousal": -0.1}
        )
        data = meta.to_dict()
        assert data["client_id"] == "test-client"
        assert data["context_tag"] == "test-context"
        assert data["affect"]["valence"] == 0.2

    def test_meta_excludes_none(self):
        meta = LtpMeta(client_id="test-client")
        data = meta.to_dict()
        assert "trace_id" not in data
        assert "context_tag" not in data


class TestPayloads:
    def test_state_update_payload(self):
        payload = StateUpdatePayload(
            kind="minimal",
            data={"mood": "curious"}
        )
        data = payload.to_dict()
        assert data["kind"] == "minimal"
        assert data["data"]["mood"] == "curious"

    def test_event_payload(self):
        payload = EventPayload(
            event_type="user_action",
            data={"action": "click"}
        )
        data = payload.to_dict()
        assert data["event_type"] == "user_action"
        assert data["data"]["action"] == "click"

    def test_error_payload(self):
        payload = ErrorPayload.from_dict({
            "error_code": "INVALID_REQUEST",
            "error_message": "Invalid request",
            "details": {"field": "thread_id"}
        })
        assert payload.error_code == "INVALID_REQUEST"
        assert payload.error_message == "Invalid request"
        assert payload.details["field"] == "thread_id"

