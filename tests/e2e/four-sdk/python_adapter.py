#!/usr/bin/env python3
import asyncio
import json
import os
import time
from pathlib import Path
from typing import Any

from ltp_client import LtpClient
from ltp_client.crypto import hash_envelope, sign_message

SDK = "python"
CLIENT_ID = f"wp2-{SDK}"
URL = os.environ.get("LTP_REFERENCE_URL")
OUTPUT = os.environ.get("LTP_ADAPTER_OUTPUT")
SECRET = os.environ.get("LTP_REFERENCE_SECRET", "ltp-reference-long-term-secret")

if not URL or not OUTPUT:
    raise RuntimeError("LTP_REFERENCE_URL and LTP_ADAPTER_OUTPUT are required")


async def wait_queue(queue: asyncio.Queue[Any], label: str, timeout: float = 8.0) -> Any:
    try:
        return await asyncio.wait_for(queue.get(), timeout)
    except asyncio.TimeoutError as exc:
        raise RuntimeError(f"timeout waiting for {label}") from exc


async def main() -> None:
    connected: asyncio.Queue[tuple[str, str]] = asyncio.Queue()
    updates: asyncio.Queue[Any] = asyncio.Queue()
    pongs: asyncio.Queue[bool] = asyncio.Queue()
    errors: asyncio.Queue[str] = asyncio.Queue()

    client = LtpClient(
        url=URL,
        client_id=CLIENT_ID,
        secret_key=SECRET,
        enable_ecdh_key_exchange=True,
        enable_metadata_encryption=False,
        require_signature_verification=True,
        heartbeat_options={"enabled": False, "interval_ms": 60_000, "timeout_ms": 60_000},
        reconnect_strategy={"enabled": False, "max_retries": 0, "base_delay_ms": 50, "max_delay_ms": 50},
    )
    client.on_connected = lambda thread_id, session_id: connected.put_nowait((thread_id, session_id))
    client.on_state_update = lambda payload: updates.put_nowait(payload)
    client.on_pong = lambda: pongs.put_nowait(True)
    client.on_error = lambda error: errors.put_nowait(error.error_code)

    actions: list[str] = []
    await client.connect()
    fresh = await wait_queue(connected, "fresh handshake")
    actions.append("fresh-handshake")

    await client.send_event("wp2", {"scenario_id": f"{SDK}:business", "value": 1})
    await wait_queue(updates, "business acknowledgement")
    actions.append("business")

    await client.send_ping()
    await wait_queue(pongs, "authenticated pong")
    actions.append("ping-pong")

    client.enable_metadata_encryption = True
    await client.send_event("wp2", {"scenario_id": f"{SDK}:encrypted", "value": 2})
    await wait_queue(updates, "encrypted acknowledgement")
    actions.append("encrypted")
    client.enable_metadata_encryption = False

    def build_raw(
        scenario_id: str,
        *,
        timestamp: int | None = None,
        nonce: str | None = None,
        prev: str | None | object = ...,  # Ellipsis means current committed hash.
        invalid_signature: bool = False,
        commit: bool = False,
    ) -> dict[str, Any]:
        frame_timestamp = timestamp if timestamp is not None else int(time.time() * 1000)
        frame_nonce = nonce or client._generate_nonce()
        previous_hash = client._last_sent_hash if prev is ... else prev
        frame: dict[str, Any] = {
            "type": "event",
            "thread_id": client.thread_id,
            "session_id": client.session_id,
            "timestamp": frame_timestamp,
            "nonce": frame_nonce,
            "payload": {"event_type": "wp2", "data": {"scenario_id": scenario_id}},
            "prev_message_hash": previous_hash,
            "meta": {"client_id": CLIENT_ID},
            "content_encoding": "json",
        }
        frame["signature"] = "00" * 32 if invalid_signature else sign_message(frame, client._session_mac_key)
        if commit:
            client._last_sent_hash = hash_envelope(frame)
            client._persist_security_state()
        return frame

    invalid = build_raw(f"{SDK}:invalid-signature", invalid_signature=True)
    await client._send_raw(invalid)
    await wait_queue(errors, "invalid-signature error")
    actions.append("invalid-signature")

    stale = build_raw(f"{SDK}:stale-timestamp", timestamp=int(time.time() * 1000) - 120_000)
    await client._send_raw(stale)
    await wait_queue(errors, "stale-timestamp error")
    actions.append("stale-timestamp")

    replay_seed = build_raw(f"{SDK}:replay-seed", commit=True)
    await client._send_raw(replay_seed)
    await wait_queue(updates, "replay seed acknowledgement")

    replay = build_raw(f"{SDK}:replayed-nonce", nonce=replay_seed["nonce"])
    await client._send_raw(replay)
    await wait_queue(errors, "replay error")
    actions.append("replayed-nonce")

    broken = build_raw(f"{SDK}:broken-chain", prev="deadbeef")
    await client._send_raw(broken)
    await wait_queue(errors, "broken-chain error")
    actions.append("broken-chain")

    before_resume = fresh
    await client.disconnect()
    await asyncio.sleep(0.1)
    await client.connect()
    resumed = await wait_queue(connected, "same-session resume")
    if resumed != before_resume:
        raise RuntimeError("Python resume changed the session namespace")
    actions.append("same-session-resume")

    await client.send_event("wp2", {"scenario_id": f"{SDK}:post-resume", "value": 3})
    await wait_queue(updates, "post-resume acknowledgement")
    actions.append("post-resume")

    await client.disconnect()
    output = Path(OUTPUT)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "sdk": SDK,
                "client_id": CLIENT_ID,
                "protocol_version": "0.3",
                "thread_id": resumed[0],
                "session_id": resumed[1],
                "actions": actions,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    asyncio.run(main())
