defmodule LTP.ConnectionFailClosedTest do
  use ExUnit.Case, async: true

  defp connection_state(overrides \\ %{}) do
    defaults = %{
      client_id: "security-test-client",
      capabilities: [],
      metadata: %{},
      heartbeat_interval_ms: 15_000,
      heartbeat_timeout_ms: 45_000,
      reconnect_config: %{max_retries: 1, base_delay_ms: 1, max_delay_ms: 1},
      reconnect_attempts: 0,
      is_handshake_complete: false,
      client_pid: self(),
      enable_ecdh_key_exchange: false,
      enable_metadata_encryption: false,
      secret_key: nil,
      session_mac_key: nil,
      ecdh_private_key: nil,
      session_encryption_key: nil,
      last_sent_hash: nil,
      last_received_hash: nil,
      seen_nonces: %{},
      max_message_age_ms: 60_000
    }

    struct(LTP.Connection, Map.merge(defaults, overrides))
  end

  test "metadata encryption without negotiated keys refuses to send plaintext" do
    state =
      connection_state(%{
        enable_metadata_encryption: true,
        secret_key: "long-term-secret"
      })

    envelope = %{
      type: "state_update",
      thread_id: "thread-123",
      session_id: "session-456",
      timestamp: System.system_time(:second),
      content_encoding: "json",
      payload: %{kind: "test", data: %{value: 1}},
      meta: %{client_id: "security-test-client"}
    }

    assert {:ok, returned_state} =
             LTP.Connection.handle_info({:send_message, envelope}, state)

    assert returned_state.last_sent_hash == nil

    assert_receive {:ltp_error, {:outbound_security_failed, reason}}
    assert reason =~ "metadata encryption enabled without negotiated session keys"
  end

  test "failed authenticated ECDH never announces a connected session" do
    state =
      connection_state(%{
        enable_ecdh_key_exchange: true,
        ecdh_private_key: "00",
        secret_key: "long-term-secret"
      })

    ack = %{
      "type" => "handshake_ack",
      "thread_id" => "thread-123",
      "session_id" => "session-456",
      "heartbeat_interval_ms" => 15_000,
      "server_ecdh_public_key" => "04deadbeef"
    }

    assert {:close, returned_state} =
             LTP.Connection.handle_frame({:text, Jason.encode!(ack)}, state)

    refute returned_state.is_handshake_complete
    assert_receive {:ltp_error, :ecdh_authentication_failed}
    refute_receive {:ltp_connected, "thread-123", "session-456"}
  end
end
