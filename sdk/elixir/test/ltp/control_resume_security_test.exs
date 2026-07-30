defmodule LTP.ControlResumeSecurityTest do
  use ExUnit.Case, async: true

  defp state(overrides \\ %{}) do
    defaults = %{
      client_id: "control-client",
      client_pid: self(),
      thread_id: "thread-1",
      session_id: "session-1",
      session_mac_key: "session-control-key",
      secret_key: "long-term-key",
      session_encryption_key: nil,
      enable_metadata_encryption: false,
      heartbeat_interval_ms: 1_000,
      heartbeat_timeout_ms: 1_000,
      heartbeat_timer: nil,
      heartbeat_timeout_timer: nil,
      last_pong_time: nil,
      last_sent_hash: nil,
      last_received_hash: nil,
      seen_nonces: %{},
      security_state_initialized: true,
      max_message_age_ms: 60_000,
      is_handshake_complete: true,
      reconnect_attempts: 0,
      reconnect_config: %{max_retries: 1, base_delay_ms: 1, max_delay_ms: 1}
    }

    struct(LTP.Connection, Map.merge(defaults, overrides))
  end

  defp signed_control(type, key, overrides \\ %{}) do
    timestamp = System.system_time(:millisecond)

    message =
      %{
        "type" => type,
        "thread_id" => "thread-1",
        "session_id" => "session-1",
        "timestamp" => timestamp,
        "nonce" => "hmac-0123456789abcdef0123456789abcdef-#{timestamp}",
        "payload" => %{},
        "meta" => %{"client_id" => "server"},
        "content_encoding" => "json"
      }
      |> Map.merge(overrides)

    Map.put(message, "signature", LTP.Crypto.sign_message(message, key))
  end

  test "unsigned pong cannot mutate heartbeat state" do
    message = signed_control("pong", "session-control-key") |> Map.delete("signature")
    initial = state(%{last_pong_time: 123})
    assert {:ok, returned} = LTP.Connection.handle_frame({:text, Jason.encode!(message)}, initial)
    assert returned.last_pong_time == 123
    assert returned.last_received_hash == nil
  end

  test "authenticated pong commits chain and liveness" do
    message = signed_control("pong", "session-control-key")
    assert {:ok, returned} = LTP.Connection.handle_frame({:text, Jason.encode!(message)}, state())
    assert returned.last_pong_time
    assert returned.last_received_hash
    assert returned.security_state_initialized
  end

  test "same-session resume state is representable and new state defaults fail closed" do
    restored =
      state(%{
        last_sent_hash: "sent",
        last_received_hash: "received",
        seen_nonces: %{"nonce" => 1},
        security_state_initialized: true
      })

    assert restored.last_received_hash == "received"

    fresh =
      state(%{
        last_sent_hash: nil,
        last_received_hash: nil,
        seen_nonces: %{},
        security_state_initialized: false
      })

    refute fresh.security_state_initialized
  end

  test "outbound ping without negotiated session key fails closed" do
    initial = state(%{session_mac_key: nil, secret_key: "long-term"})
    assert {:ok, returned} = LTP.Connection.handle_info(:heartbeat, initial)
    assert returned.last_sent_hash == nil
  end
end
