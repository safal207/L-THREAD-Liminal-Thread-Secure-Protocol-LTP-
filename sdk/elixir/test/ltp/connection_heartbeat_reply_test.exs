defmodule LTP.ConnectionHeartbeatReplyTest do
  use ExUnit.Case, async: true

  test "authenticated heartbeat returns a WebSockex reply without self-calling" do
    state = %LTP.Connection{
      client_id: "heartbeat-client",
      thread_id: "thread-heartbeat",
      session_id: "session-heartbeat",
      is_handshake_complete: true,
      session_mac_key: String.duplicate("11", 32),
      last_sent_hash: nil,
      heartbeat_interval_ms: 60_000,
      heartbeat_timeout_ms: 60_000,
      enable_metadata_encryption: false
    }

    assert {:reply, {:text, encoded}, new_state} =
             LTP.Connection.handle_info(:heartbeat, state)

    ping = Jason.decode!(encoded)
    assert ping["type"] == "ping"
    assert ping["thread_id"] == "thread-heartbeat"
    assert ping["session_id"] == "session-heartbeat"
    assert is_binary(ping["nonce"])
    assert is_binary(ping["signature"])
    assert is_binary(new_state.last_sent_hash)
    assert is_reference(new_state.heartbeat_timer)
  end
end
