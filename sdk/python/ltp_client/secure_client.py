"""Security-hardened receive pipeline for the Python LTP client.

This module keeps the public client API stable while making inbound security-state
transitions atomic. It can be folded into ``client.py`` when that module is split
into smaller protocol components.
"""

import hmac
from typing import Any, Dict, Optional

from .client import LtpClient as _BaseLtpClient
from .crypto import decrypt_metadata, hash_envelope


class SecureLtpClient(_BaseLtpClient):
    """LTP client whose inbound state changes occur only after validation."""

    async def _handle_message(self, data: Dict[str, Any]) -> None:
        message_type = data.get("type")
        is_handshake_message = message_type in {"handshake_ack", "handshake_reject"}

        # Decryption does not mutate replay or chain state. A failure rejects the
        # frame before it can become application-visible.
        if data.get("encrypted_metadata") and self._session_encryption_key:
            try:
                decrypted_metadata = decrypt_metadata(
                    data["encrypted_metadata"],
                    self._session_encryption_key,
                )
                data["thread_id"] = decrypted_metadata.get("thread_id", "")
                data["session_id"] = decrypted_metadata.get("session_id", "")
                data["timestamp"] = decrypted_metadata.get("timestamp", 0)
            except Exception as error:
                print(f"[LTP] Failed to decrypt metadata: {error}")
                return

        requires_authentication = (
            not is_handshake_message
            and self.require_signature_verification
            and bool(self._mac_key)
        )

        # Authenticate and establish freshness before reading or mutating chain
        # and replay state.
        if requires_authentication:
            if not self._validate_signature(data):
                return
            if not self._validate_timestamp(data):
                return

        candidate_hash: Optional[str] = None
        if not is_handshake_message:
            incoming_prev_hash = data.get("prev_message_hash")

            # Once a chain exists, omitting its pointer is a chain reset attempt.
            if self._last_received_hash:
                if not isinstance(incoming_prev_hash, str) or not incoming_prev_hash:
                    print("[LTP] Missing previous hash for an active message chain")
                    return
                if not hmac.compare_digest(incoming_prev_hash, self._last_received_hash):
                    print("[LTP] Hash chain mismatch - message tampering detected!")
                    return

            # Compute the prospective state without committing it. Hash failures
            # are fail-closed because accepting would desynchronise the chain.
            try:
                candidate_hash = hash_envelope(data)
            except Exception as error:
                print(f"[LTP] Failed to compute received message hash: {error}")
                return

            # _validate_nonce records the nonce on success. It is intentionally the
            # first stateful operation, and no fallible security check follows it.
            if requires_authentication and not self._validate_nonce(data):
                return

            self._last_received_hash = candidate_hash

        # Callbacks and business dispatch are outside the untrusted boundary.
        if self.on_message:
            self.on_message(data)

        if message_type == "handshake_ack":
            await self._handle_handshake_ack(data)
        elif message_type == "handshake_reject":
            await self._handle_handshake_reject(data)
        elif message_type == "pong":
            self._pong_event.set()
            if self.on_pong:
                self.on_pong()
        elif message_type == "state_update" and self.on_state_update:
            self.on_state_update(data.get("payload", {}))
        elif message_type == "event" and self.on_event:
            self.on_event(data.get("payload", {}))
        elif message_type == "error":
            await self._handle_error(data.get("payload", {}))
