defmodule LTP.WP6CanonicalRegressionTest do
  use ExUnit.Case, async: true

  defp envelope(payload) do
    %{
      "type" => "state_update",
      "thread_id" => "wp6-thread",
      "session_id" => "wp6-session",
      "timestamp" => 1_700_000_000_000,
      "nonce" => "hmac-00000000000000000000000000000000-1700000000000",
      "payload" => payload,
      "prev_message_hash" => "",
      "meta" => %{},
      "content_encoding" => "json"
    }
  end

  test "preserves explicit null and false payloads" do
    assert LTP.Crypto.serialize_canonical(envelope(nil)) =~ ~s("payload":null)
    assert LTP.Crypto.serialize_canonical(envelope(false)) =~ ~s("payload":false)
  end

  test "uses lowercase hexadecimal in JSON unicode escapes" do
    canonical = LTP.Crypto.serialize_canonical(envelope(%{"\u000F-key" => true}))

    assert canonical =~ "\\u000f-key"
    refute canonical =~ "\\u000F-key"
  end
end
