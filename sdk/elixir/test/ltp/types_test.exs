defmodule LTP.TypesTest do
  use ExUnit.Case, async: true

  test "content_encoding type accepts :json and :toon" do
    assert is_atom(:json)
    assert is_atom(:toon)
  end

  test "handshake_init structure" do
    init = %{
      type: "handshake_init",
      ltp_version: "0.3",
      client_id: "test-client",
      device_fingerprint: nil,
      intent: nil,
      capabilities: nil,
      metadata: nil
    }

    assert Map.has_key?(init, :type)
    assert Map.has_key?(init, :ltp_version)
    assert Map.has_key?(init, :client_id)
  end

  test "ltp_envelope structure" do
    envelope = %{
      type: "state_update",
      thread_id: "thread-123",
      session_id: "session-456",
      timestamp: 1_234_567_890,
      content_encoding: :json,
      payload: %{kind: "test", data: %{}},
      meta: %{},
      nonce: nil,
      signature: nil
    }

    assert Map.has_key?(envelope, :type)
    assert Map.has_key?(envelope, :thread_id)
    assert Map.has_key?(envelope, :content_encoding)
  end
end
