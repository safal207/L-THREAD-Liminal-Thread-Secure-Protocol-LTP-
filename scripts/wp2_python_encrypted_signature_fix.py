#!/usr/bin/env python3
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


# Remove the old signing stage that ran after routing metadata had already been
# replaced by its encrypted wire representation.
replace_once(
    "sdk/python/ltp_client/client.py",
    '''            except Exception as e:
                print(f"[LTP] Warning: Failed to encrypt metadata: {e}")
                # Continue without encryption

        # Post-handshake control frames are bound only to the negotiated session key.
        signing_key = self._session_mac_key if msg_type in {"ping", "pong"} else self._mac_key
        if signing_key:
            message_dict["signature"] = sign_message(message_dict, signing_key)
        elif msg_type in {"ping", "pong"}:
            raise RuntimeError("post-handshake control frame requires a session MAC key")

        # Compute hash for next message's prev_message_hash (v0.5+ hash chaining)
''',
    '''            except Exception as e:
                print(f"[LTP] Warning: Failed to encrypt metadata: {e}")
                # Continue without encryption

        # Compute hash for next message's prev_message_hash (v0.5+ hash chaining)
''',
)

# Sign the logical envelope before masking thread/session/timestamp. The server
# decrypts those routing fields before signature verification, while the hash
# chain below still commits the final transmitted wire representation.
replace_once(
    "sdk/python/ltp_client/client.py",
    '''        message_dict = envelope.to_dict()

        # Metadata encryption (v0.6+) - encrypt thread_id, session_id, timestamp
''',
    '''        message_dict = envelope.to_dict()

        # Post-handshake control frames are bound only to the negotiated session key.
        # Sign before routing metadata is encrypted: peers verify the decrypted
        # logical envelope, while the hash-chain commits the final wire envelope.
        signing_key = self._session_mac_key if msg_type in {"ping", "pong"} else self._mac_key
        if signing_key:
            message_dict["signature"] = sign_message(message_dict, signing_key)
        elif msg_type in {"ping", "pong"}:
            raise RuntimeError("post-handshake control frame requires a session MAC key")

        # Metadata encryption (v0.6+) - encrypt thread_id, session_id, timestamp
''',
)

replace_once(
    "sdk/python/tests/test_receive_security_atomicity.py",
    "from ltp_client.crypto import hash_envelope\n",
    "from ltp_client.crypto import decrypt_metadata, hash_envelope, verify_signature\n",
)

replace_once(
    "sdk/python/tests/test_receive_security_atomicity.py",
    '''    client.on_state_update.assert_called_once_with(
        {"kind": "test", "data": {"value": 1}}
    )
''',
    '''    client.on_state_update.assert_called_once_with(
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
''',
)

# The PR workflow only publishes these files after the complete 40-cell matrix
# succeeds, but stage them now because its original explicit add-list predates
# this cross-SDK discovery.
subprocess.run(
    [
        "git",
        "add",
        "sdk/python/ltp_client/client.py",
        "sdk/python/tests/test_receive_security_atomicity.py",
    ],
    cwd=ROOT,
    check=True,
)

print("WP2 Python encrypted-signature ordering fix applied")
