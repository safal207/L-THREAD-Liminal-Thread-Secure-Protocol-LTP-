url = System.fetch_env!("LTP_REFERENCE_URL")
output_path = System.fetch_env!("LTP_ADAPTER_OUTPUT")
secret = System.get_env("LTP_REFERENCE_SECRET") || "ltp-reference-long-term-secret"
sdk = "elixir"
client_id = "wp2-#{sdk}"

wait_for = fn matcher, label ->
  receive do
    message ->
      case matcher.(message) do
        {:ok, value} -> value
        :skip ->
          receive do
            next ->
              case matcher.(next) do
                {:ok, value} -> value
                :skip -> raise "unexpected messages while waiting for #{label}: #{inspect([message, next])}"
              end
          after
            8_000 -> raise "timeout waiting for #{label}"
          end
      end
  after
    8_000 -> raise "timeout waiting for #{label}"
  end
end

connected = fn ->
  wait_for.(fn
    {:ltp_connected, thread_id, session_id} -> {:ok, {thread_id, session_id}}
    _ -> :skip
  end, "connected")
end

state_update = fn ->
  wait_for.(fn
    {:ltp_state_update, payload} -> {:ok, payload}
    _ -> :skip
  end, "state update")
end

server_error = fn ->
  wait_for.(fn
    {:ltp_error, %{"error_code" => code}} -> {:ok, code}
    {:ltp_error, %{error_code: code}} -> {:ok, code}
    _ -> :skip
  end, "server error")
end

start_connection = fn restored ->
  opts = [
    url: url,
    client_id: client_id,
    client_pid: self(),
    enable_ecdh_key_exchange: true,
    enable_metadata_encryption: false,
    secret_key: secret,
    heartbeat_interval_ms: 60_000,
    heartbeat_timeout_ms: 60_000,
    reconnect: %{max_retries: 0, base_delay_ms: 50, max_delay_ms: 50}
  ] ++ restored

  {:ok, pid} = LTP.Connection.start_link(opts)
  Process.unlink(pid)
  pid
end

build_event = fn state, scenario_id, overrides ->
  timestamp = Map.get(overrides, :timestamp, System.system_time(:millisecond))
  nonce = Map.get(overrides, :nonce, "wp2-#{scenario_id}-#{System.unique_integer([:positive])}")
  prev = Map.get(overrides, :prev, state.last_sent_hash)

  frame = %{
    "type" => "event",
    "thread_id" => state.thread_id,
    "session_id" => state.session_id,
    "timestamp" => timestamp,
    "nonce" => nonce,
    "payload" => %{"event_type" => "wp2", "data" => %{"scenario_id" => scenario_id}},
    "prev_message_hash" => prev,
    "meta" => %{"client_id" => client_id},
    "content_encoding" => "json"
  }

  signature =
    if Map.get(overrides, :invalid_signature, false) do
      String.duplicate("00", 32)
    else
      LTP.Crypto.sign_message(frame, state.session_mac_key)
    end

  Map.put(frame, "signature", signature)
end

actions = []
pid = start_connection.([])
{thread_id, session_id} = connected.()
actions = actions ++ ["fresh-handshake"]

send(pid, {:send_message, %{
  type: "event",
  thread_id: thread_id,
  session_id: session_id,
  timestamp: System.system_time(:millisecond),
  payload: %{event_type: "wp2", data: %{scenario_id: "#{sdk}:business", value: 1}},
  meta: %{client_id: client_id},
  content_encoding: "json"
}})
state_update.()
actions = actions ++ ["business"]

send(pid, :heartbeat)
Process.sleep(250)
actions = actions ++ ["ping-pong"]

:sys.replace_state(pid, fn state -> %{state | enable_metadata_encryption: true} end)
send(pid, {:send_message, %{
  type: "event",
  thread_id: thread_id,
  session_id: session_id,
  timestamp: System.system_time(:millisecond),
  payload: %{event_type: "wp2", data: %{scenario_id: "#{sdk}:encrypted", value: 2}},
  meta: %{client_id: client_id},
  content_encoding: "json"
}})
state_update.()
:sys.replace_state(pid, fn state -> %{state | enable_metadata_encryption: false} end)
actions = actions ++ ["encrypted"]

state = :sys.get_state(pid)
invalid = build_event.(state, "#{sdk}:invalid-signature", %{invalid_signature: true})
WebSockex.send_frame(pid, {:text, Jason.encode!(invalid)})
server_error.()
actions = actions ++ ["invalid-signature"]

state = :sys.get_state(pid)
stale = build_event.(state, "#{sdk}:stale-timestamp", %{
  timestamp: System.system_time(:millisecond) - 120_000
})
WebSockex.send_frame(pid, {:text, Jason.encode!(stale)})
server_error.()
actions = actions ++ ["stale-timestamp"]

state = :sys.get_state(pid)
replay_seed = build_event.(state, "#{sdk}:replay-seed", %{})
WebSockex.send_frame(pid, {:text, Jason.encode!(replay_seed)})
:sys.replace_state(pid, fn current ->
  %{current | last_sent_hash: LTP.Crypto.hash_envelope(replay_seed), security_state_initialized: true}
end)
state_update.()

state = :sys.get_state(pid)
replay = build_event.(state, "#{sdk}:replayed-nonce", %{nonce: replay_seed["nonce"]})
WebSockex.send_frame(pid, {:text, Jason.encode!(replay)})
server_error.()
actions = actions ++ ["replayed-nonce"]

state = :sys.get_state(pid)
broken = build_event.(state, "#{sdk}:broken-chain", %{prev: "deadbeef"})
WebSockex.send_frame(pid, {:text, Jason.encode!(broken)})
server_error.()
actions = actions ++ ["broken-chain"]

snapshot = :sys.get_state(pid)
GenServer.stop(pid, :normal)

pid = start_connection.([
  thread_id: snapshot.thread_id,
  session_id: snapshot.session_id,
  last_sent_hash: snapshot.last_sent_hash,
  last_received_hash: snapshot.last_received_hash,
  seen_nonces: snapshot.seen_nonces,
  security_state_initialized: true,
  session_mac_key: snapshot.session_mac_key,
  session_encryption_key: snapshot.session_encryption_key
])
{resumed_thread_id, resumed_session_id} = connected.()

if resumed_thread_id != thread_id or resumed_session_id != session_id do
  raise "Elixir resume changed the session namespace"
end

actions = actions ++ ["same-session-resume"]

send(pid, {:send_message, %{
  type: "event",
  thread_id: resumed_thread_id,
  session_id: resumed_session_id,
  timestamp: System.system_time(:millisecond),
  payload: %{event_type: "wp2", data: %{scenario_id: "#{sdk}:post-resume", value: 3}},
  meta: %{client_id: client_id},
  content_encoding: "json"
}})
state_update.()
actions = actions ++ ["post-resume"]

GenServer.stop(pid, :normal)
File.mkdir_p!(Path.dirname(output_path))
File.write!(output_path, Jason.encode!(%{
  schema_version: 1,
  sdk: sdk,
  client_id: client_id,
  protocol_version: "0.6",
  thread_id: resumed_thread_id,
  session_id: resumed_session_id,
  actions: actions
}, pretty: true) <> "\n")
