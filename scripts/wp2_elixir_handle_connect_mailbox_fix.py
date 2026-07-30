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

subprocess.run(["git", "add", str(PATH.relative_to(ROOT))], cwd=ROOT, check=True)
print("WP2 WebSockex mailbox handshake fix applied")
