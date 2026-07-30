defmodule LTP.ConnectionSecurityTest do
  use ExUnit.Case, async: true

  defp state(key) do
    %LTP.Connection{
      client_pid: self(),
      session_mac_key: key,
      seen_nonces: %{},
      max_message_age_ms: 60_000,
      last_received_hash: nil
    }
  end

  defp signed_message(key, overrides \\ %{}) do
    timestamp = System.system_time(:millisecond)

    message = %{
      "type" => "state_update",
      "thread_id" => "thread-123",
      "session_id" => "session-456",
      "timestamp" => timestamp,
      "content_encoding" => "json",
      "payload" => %{"kind" => "test", "data" => %{"value" => 1}},
      "meta" => %{"client_id" => "client-123"},
      "nonce" => "hmac-0123456789abcdef0123456789abcdef-#{timestamp}"
    }
    |> Map.merge(overrides)

    Map.put(message, "signature", LTP.Crypto.sign_message(message, key))
  end

  test "invalid signature cannot dispatch or mutate security state" do
    key = "trusted-session-key"
    message = signed_message(key) |> put_in(["payload", "data", "value"], 999)
    initial = state(key)

    assert {:ok, returned} =
             LTP.Connection.handle_frame({:text, Jason.encode!(message)}, initial)

    assert returned.last_received_hash == nil
    assert returned.seen_nonces == %{}
    refute_received {:ltp_state_update, _payload}
  end

  test "valid message commits replay and chain state before dispatch" do
    key = "trusted-session-key"
    message = signed_message(key)

    assert {:ok, returned} =
             LTP.Connection.handle_frame({:text, Jason.encode!(message)}, state(key))

    assert is_binary(returned.last_received_hash)
    assert returned.seen_nonces[message["nonce"]]
    assert_receive {:ltp_state_update, %{"kind" => "test"}}
  end

  test "active receive chain rejects a missing previous hash" do
    key = "trusted-session-key"
    initial = %{state(key) | last_received_hash: String.duplicate("a", 64)}
    message = signed_message(key)

    assert {:ok, returned} =
             LTP.Connection.handle_frame({:text, Jason.encode!(message)}, initial)

    assert returned.last_received_hash == initial.last_received_hash
    assert returned.seen_nonces == %{}
    refute_received {:ltp_state_update, _payload}
  end
end
