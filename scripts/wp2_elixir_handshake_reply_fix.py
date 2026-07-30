#!/usr/bin/env python3
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "sdk/elixir/lib/ltp/connection.ex"


def replace_once(old: str, new: str) -> None:
    text = PATH.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"connection.ex: expected one match, found {count}")
    PATH.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_section(start: str, end: str, replacement: str) -> None:
    text = PATH.read_text(encoding="utf-8")
    start_index = text.find(start)
    if start_index < 0:
        if replacement in text:
            return
        raise RuntimeError(f"connection.ex: missing section start {start!r}")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise RuntimeError(f"connection.ex: missing section end {end!r}")
    if text.find(start, start_index + len(start)) >= 0:
        raise RuntimeError(f"connection.ex: ambiguous section start {start!r}")
    PATH.write_text(text[:start_index] + replacement + text[end_index:], encoding="utf-8")


replace_once(
    '''  def handle_connect(_conn, state) do
    Logger.info("[LTP] WebSocket connected, initiating handshake...")

    new_state =
      if state.thread_id && state.security_state_initialized do
        send_handshake_resume(state)
      else
        send_handshake_init(state)
      end

    {:ok, new_state}
  end
''',
    '''  def handle_connect(_conn, state) do
    Logger.info("[LTP] WebSocket connected, initiating handshake...")

    result =
      if state.thread_id && state.security_state_initialized do
        build_handshake_resume(state)
      else
        build_handshake_init(state)
      end

    case result do
      {:ok, handshake, new_state} ->
        {:reply, {:text, Jason.encode!(handshake)}, new_state}

      {:error, reason, unchanged_state} ->
        Logger.error("[LTP] Failed to build handshake: #{reason}")
        {:close, unchanged_state}
    end
  end
''',
)

init_builder = '''  defp build_handshake_init(state) do
    {public_key, private_key} =
      if state.enable_ecdh_key_exchange do
        LTP.Crypto.generate_ecdh_key_pair()
      else
        {nil, nil}
      end

    state = %{state | ecdh_public_key: public_key, ecdh_private_key: private_key}

    handshake = %{
      type: "handshake_init",
      ltp_version: @ltp_version,
      client_id: state.client_id,
      device_fingerprint: state.device_fingerprint,
      intent: state.intent,
      capabilities: state.capabilities,
      metadata: Map.merge(%{sdk_version: "0.6.0-alpha.3", platform: "elixir"}, state.metadata)
    }

    handshake =
      if public_key do
        handshake
        |> Map.put(:client_ecdh_public_key, public_key)
        |> Map.put(:client_public_key, public_key)
        |> Map.put(:key_agreement, %{
          algorithm: "secp256r1",
          method: "ecdh",
          hkdf: "sha256"
        })
      else
        handshake
      end

    handshake =
      if public_key && state.secret_key do
        timestamp = System.system_time(:millisecond)

        handshake
        |> Map.put(
          :client_ecdh_signature,
          LTP.Crypto.sign_ecdh_public_key(
            public_key,
            state.client_id,
            timestamp,
            state.secret_key
          )
        )
        |> Map.put(:client_ecdh_timestamp, timestamp)
      else
        handshake
      end

    {:ok, handshake, state}
  rescue
    error -> {:error, Exception.message(error), state}
  end

'''
replace_section(
    "  defp send_handshake_init(state) do\n",
    "  defp send_handshake_resume(state) do\n",
    init_builder,
)

resume_builder = '''  defp build_handshake_resume(state) do
    {public_key, private_key} =
      if state.enable_ecdh_key_exchange do
        LTP.Crypto.generate_ecdh_key_pair()
      else
        {nil, nil}
      end

    state = %{state | ecdh_public_key: public_key, ecdh_private_key: private_key}

    handshake = %{
      type: "handshake_resume",
      ltp_version: @ltp_version,
      client_id: state.client_id,
      thread_id: state.thread_id,
      resume_reason: "automatic_reconnect"
    }

    handshake =
      if public_key do
        handshake
        |> Map.put(:client_public_key, public_key)
        |> Map.put(:client_ecdh_public_key, public_key)
        |> Map.put(:key_agreement, %{
          algorithm: "secp256r1",
          method: "ecdh",
          hkdf: "sha256"
        })
      else
        handshake
      end

    handshake =
      if public_key && state.secret_key do
        timestamp = System.system_time(:millisecond)

        handshake
        |> Map.put(
          :client_ecdh_signature,
          LTP.Crypto.sign_ecdh_public_key(
            public_key,
            state.client_id,
            timestamp,
            state.secret_key
          )
        )
        |> Map.put(:client_ecdh_timestamp, timestamp)
      else
        handshake
      end

    {:ok, handshake, state}
  rescue
    error -> {:error, Exception.message(error), state}
  end

'''
replace_section(
    "  defp send_handshake_resume(state) do\n",
    '  defp handle_message(%{"type" => "handshake_ack"} = ack, state) do\n',
    resume_builder,
)

replace_once(
    '''      send_handshake_init(new_state)
      {:ok, new_state}
''',
    '''      case build_handshake_init(new_state) do
        {:ok, handshake, reset_state} ->
          {:reply, {:text, Jason.encode!(handshake)}, reset_state}

        {:error, build_reason, unchanged_state} ->
          Logger.error("[LTP] Failed to rebuild handshake after rejection: #{build_reason}")
          {:close, unchanged_state}
      end
''',
)

subprocess.run(["git", "add", str(PATH.relative_to(ROOT))], cwd=ROOT, check=True)
print("WP2 Elixir callback-safe handshake fix applied")
