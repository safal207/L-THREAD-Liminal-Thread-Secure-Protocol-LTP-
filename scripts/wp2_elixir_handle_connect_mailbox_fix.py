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


# WebSockex 0.5 handle_connect only accepts {:ok, state}. Schedule the first
# protocol frame into the process mailbox and send it from handle_info, where
# {:reply, frame, state} is a supported callback return.
replace_once(
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
    '''  def handle_connect(_conn, state) do
    Logger.info("[LTP] WebSocket connected, initiating handshake...")
    send(self(), :send_handshake)
    {:ok, state}
  end
''',
)

replace_once(
    '''  @impl WebSockex
  def handle_info(:heartbeat, state) do
''',
    '''  @impl WebSockex
  def handle_info(:send_handshake, state) do
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

  @impl WebSockex
  def handle_info(:heartbeat, state) do
''',
)

# Heartbeats are also emitted from a WebSockex callback. Returning the frame is
# required; calling WebSockex.send_frame(self(), ...) synchronously kills the
# connection process with a self-call error.
replace_once(
    '''  def handle_info(:heartbeat, state) do
    new_state =
      if state.is_handshake_complete do
        case send_ping(state) do
          {:ok, sent_state} ->
            schedule_heartbeat(sent_state)

          {:error, reason, unchanged_state} ->
            Logger.error("[LTP] Heartbeat send failed closed: #{reason}")
            unchanged_state
        end
      else
        state
      end

    {:ok, new_state}
  end
''',
    '''  def handle_info(:heartbeat, state) do
    if state.is_handshake_complete do
      case secure_control_frame("ping", state) do
        {:ok, ping, sent_state} ->
          {:reply, {:text, Jason.encode!(ping)}, schedule_heartbeat(sent_state)}

        {:error, reason, unchanged_state} ->
          Logger.error("[LTP] Heartbeat send failed closed: #{reason}")
          {:ok, unchanged_state}
      end
    else
      {:ok, state}
    end
  end
''',
)

replace_once(
    '''  defp send_ping(state) do
    case secure_control_frame("ping", state) do
      {:ok, ping, new_state} ->
        WebSockex.send_frame(self(), {:text, Jason.encode!(ping)})
        {:ok, new_state}

      {:error, reason, unchanged_state} ->
        {:error, reason, unchanged_state}
    end
  end

''',
    '',
)

subprocess.run(
    [
        "git",
        "add",
        str(PATH.relative_to(ROOT)),
        "sdk/elixir/test/ltp/connection_heartbeat_reply_test.exs",
    ],
    cwd=ROOT,
    check=True,
)
print("WP2 WebSockex mailbox handshake/heartbeat fix applied")
