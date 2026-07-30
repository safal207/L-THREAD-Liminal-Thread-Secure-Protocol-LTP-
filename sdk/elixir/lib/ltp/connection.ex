defmodule LTP.Connection do
  @moduledoc """
  Low-level WebSocket connection handler for LTP.

  Inbound business messages cross one atomic security gate before they can
  mutate replay/hash state or reach the application process.
  """

  use WebSockex
  require Logger

  @ltp_version "0.6"
  @future_skew_ms 5_000
  @max_seen_nonces 4_096

  defstruct [
    :url,
    :client_id,
    :device_fingerprint,
    :intent,
    :capabilities,
    :metadata,
    :thread_id,
    :session_id,
    :heartbeat_interval_ms,
    :heartbeat_timeout_ms,
    :reconnect_config,
    :default_context_tag,
    :default_affect,
    :heartbeat_timer,
    :heartbeat_timeout_timer,
    :last_pong_time,
    :reconnect_timer,
    :reconnect_attempts,
    :is_handshake_complete,
    :client_pid,
    :enable_ecdh_key_exchange,
    :enable_metadata_encryption,
    :secret_key,
    :session_mac_key,
    :ecdh_private_key,
    :ecdh_public_key,
    :session_encryption_key,
    :last_sent_hash,
    :last_received_hash,
    :seen_nonces,
    :security_state_initialized,
    :max_message_age_ms
  ]

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts) do
    state = %__MODULE__{
      url: Keyword.fetch!(opts, :url),
      client_id: Keyword.fetch!(opts, :client_id),
      device_fingerprint: Keyword.get(opts, :device_fingerprint),
      intent: Keyword.get(opts, :intent, "resonant_link"),
      capabilities: Keyword.get(opts, :capabilities, ["state-update", "events", "ping-pong"]),
      metadata: Keyword.get(opts, :metadata, %{}),
      heartbeat_interval_ms: Keyword.get(opts, :heartbeat_interval_ms, 15_000),
      heartbeat_timeout_ms: Keyword.get(opts, :heartbeat_timeout_ms, 45_000),
      reconnect_config:
        Keyword.get(opts, :reconnect, %{
          max_retries: 5,
          base_delay_ms: 1_000,
          max_delay_ms: 30_000
        }),
      default_context_tag: Keyword.get(opts, :default_context_tag),
      default_affect: Keyword.get(opts, :default_affect),
      reconnect_attempts: 0,
      is_handshake_complete: false,
      client_pid: Keyword.get(opts, :client_pid),
      enable_ecdh_key_exchange: Keyword.get(opts, :enable_ecdh_key_exchange, false),
      enable_metadata_encryption: Keyword.get(opts, :enable_metadata_encryption, false),
      secret_key: Keyword.get(opts, :secret_key),
      session_mac_key: Keyword.get(opts, :session_mac_key),
      ecdh_private_key: nil,
      ecdh_public_key: nil,
      session_encryption_key: Keyword.get(opts, :session_encryption_key),
      last_sent_hash: Keyword.get(opts, :last_sent_hash),
      last_received_hash: Keyword.get(opts, :last_received_hash),
      seen_nonces: Keyword.get(opts, :seen_nonces, %{}),
      security_state_initialized: Keyword.get(opts, :security_state_initialized, false),
      max_message_age_ms: Keyword.get(opts, :max_message_age_ms, 60_000)
    }

    WebSockex.start_link(state.url, __MODULE__, state, name: Keyword.get(opts, :name))
  end

  def init(state), do: {:ok, state}

  @impl WebSockex
  def handle_connect(_conn, state) do
    Logger.info("[LTP] WebSocket connected, initiating handshake...")

    new_state =
      if state.thread_id and state.security_state_initialized do
        send_handshake_resume(state)
        state
      else
        send_handshake_init(state)
      end

    {:ok, new_state}
  end

  @impl WebSockex
  def handle_frame({:text, json}, state) do
    # Keep the verifier and committed chain input explicit at the trust boundary.
    # The first application dispatch in this function is therefore structurally
    # after the cryptographic verifier used for business frames.
    signature_verifier = &LTP.Crypto.verify_signature/2
    last_received_hash = state.last_received_hash

    case Jason.decode(json) do
      {:ok, %{"type" => type} = message}
      when type in ["handshake_ack", "handshake_reject"] ->
        handle_message(message, state)

      {:ok, message} when is_map(message) ->
        case validate_inbound_security(
               message,
               state,
               signature_verifier,
               last_received_hash
             ) do
          {:ok, logical_message, new_state} ->
            handle_message(logical_message, new_state)

          {:reject, new_state, reason} ->
            Logger.warning("[LTP] Dropping message: #{reason}", %{type: message["type"]})
            {:ok, new_state}
        end

      {:error, error} ->
        Logger.error("[LTP] Failed to parse message: #{inspect(error)}")
        {:ok, state}
    end
  end

  @impl WebSockex
  def handle_frame(_frame, state), do: {:ok, state}

  @impl WebSockex
  def handle_disconnect(%{reason: reason}, state) do
    Logger.warning("[LTP] WebSocket disconnected: #{inspect(reason)}")
    state |> clear_heartbeat_timers() |> schedule_reconnect("disconnected")
  end

  @impl WebSockex
  def handle_info(:heartbeat, state) do
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

  @impl WebSockex
  def handle_info(:heartbeat_timeout, state) do
    Logger.warning("[LTP] Heartbeat timeout")
    schedule_reconnect(state, "heartbeat timeout")
  end

  @impl WebSockex
  def handle_info({:send_message, envelope}, state) do
    case apply_security_features(envelope, state) do
      {:ok, secure_envelope, new_state} ->
        {:reply, {:text, Jason.encode!(secure_envelope)}, new_state}

      {:error, reason, unchanged_state} ->
        Logger.error("[LTP] Refusing insecure outbound frame: #{reason}")

        if unchanged_state.client_pid,
          do: send(unchanged_state.client_pid, {:ltp_error, {:outbound_security_failed, reason}})

        {:ok, unchanged_state}
    end
  end

  @impl WebSockex
  def handle_info({:reconnect}, state), do: {:reconnect, state}

  @impl WebSockex
  def handle_info(_msg, state), do: {:ok, state}

  # ---- inbound security ---------------------------------------------------

  defp validate_inbound_security(wire_message, state, signature_verifier, last_hash) do
    with {:ok, logical_message} <- decrypt_inbound_metadata(wire_message, state),
         mac_key when is_binary(mac_key) and byte_size(mac_key) > 0 <-
           state.session_mac_key || state.secret_key,
         true <- signature_verifier.(logical_message, mac_key),
         :ok <- validate_message_timestamp(logical_message, state),
         {:ok, candidate_hash} <- verify_hash_chain(wire_message, last_hash),
         {:ok, replay_state} <- validate_inbound_replay(logical_message, state) do
      {:ok, logical_message,
       %{replay_state | last_received_hash: candidate_hash, security_state_initialized: true}}
    else
      nil ->
        {:reject, state, "no receive MAC key configured"}

      false ->
        {:reject, state, "signature verification failed"}

      {:error, reason} ->
        {:reject, state, reason}

      {:reject, _new_state, _reason} = rejection ->
        rejection
    end
  rescue
    error ->
      {:reject, state, "security validation error: #{Exception.message(error)}"}
  end

  defp decrypt_inbound_metadata(message, state) do
    case message["encrypted_metadata"] do
      nil ->
        {:ok, message}

      encrypted when is_binary(encrypted) ->
        if is_binary(state.session_encryption_key) do
          case LTP.Crypto.decrypt_metadata(encrypted, state.session_encryption_key) do
            {:ok, metadata} ->
              {:ok,
               message
               |> Map.put("thread_id", metadata["thread_id"])
               |> Map.put("session_id", metadata["session_id"])
               |> Map.put("timestamp", metadata["timestamp"])}

            {:error, reason} ->
              {:error, "metadata decryption failed: #{inspect(reason)}"}
          end
        else
          {:error, "encrypted metadata received without a negotiated key"}
        end

      _ ->
        {:error, "invalid encrypted metadata field"}
    end
  end

  defp validate_message_timestamp(message, state) do
    case normalize_timestamp(message["timestamp"]) do
      {:ok, timestamp_ms} ->
        age = System.system_time(:millisecond) - timestamp_ms

        cond do
          age > state.max_message_age_ms ->
            {:error, "message too old (age #{age}ms)"}

          age < -@future_skew_ms ->
            {:error, "message timestamp in future (#{-age}ms skew)"}

          true ->
            :ok
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp verify_hash_chain(wire_message, nil) do
    {:ok, LTP.Crypto.hash_envelope(wire_message)}
  rescue
    error -> {:error, "failed to hash envelope: #{Exception.message(error)}"}
  end

  defp verify_hash_chain(wire_message, last_received_hash) do
    case wire_message["prev_message_hash"] do
      previous when is_binary(previous) and previous != "" ->
        if secure_equal(previous, last_received_hash) do
          {:ok, LTP.Crypto.hash_envelope(wire_message)}
        else
          {:error, "hash chain mismatch"}
        end

      _ ->
        {:error, "missing previous hash for active receive chain"}
    end
  rescue
    error -> {:error, "failed to verify hash chain: #{Exception.message(error)}"}
  end

  defp secure_equal(left, right)
       when is_binary(left) and is_binary(right) and byte_size(left) == byte_size(right) do
    :crypto.hash_equals(left, right)
  end

  defp secure_equal(_left, _right), do: false

  defp validate_inbound_replay(message, state) do
    nonce = message["nonce"]
    now = System.system_time(:millisecond)

    cond do
      not is_binary(nonce) or nonce == "" ->
        {:reject, state, "missing nonce"}

      Map.has_key?(state.seen_nonces, nonce) ->
        {:reject, state, "replay detected"}

      map_size(state.seen_nonces) >= @max_seen_nonces ->
        {:reject, state, "replay cache capacity reached"}

      true ->
        case parse_nonce_timestamp(nonce, message) do
          {:ok, timestamp_ms} ->
            age = now - timestamp_ms

            cond do
              age > state.max_message_age_ms ->
                {:reject, state, "nonce too old (age #{age}ms)"}

              age < -@future_skew_ms ->
                {:reject, state, "nonce timestamp in future (#{-age}ms skew)"}

              true ->
                {:ok, %{state | seen_nonces: Map.put(state.seen_nonces, nonce, now)}}
            end

          {:error, reason} ->
            {:reject, state, reason}
        end
    end
  end

  defp parse_nonce_timestamp("hmac-" <> rest, _message) do
    case String.split(rest, "-", parts: 2) do
      [mac_prefix, timestamp_text] when byte_size(mac_prefix) == 32 ->
        with true <- hex?(mac_prefix),
             {timestamp, ""} <- Integer.parse(timestamp_text),
             {:ok, timestamp_ms} <- normalize_timestamp(timestamp) do
          {:ok, timestamp_ms}
        else
          _ -> {:error, "invalid HMAC nonce"}
        end

      _ ->
        {:error, "invalid HMAC nonce format"}
    end
  end

  defp parse_nonce_timestamp(nonce, message) do
    cond do
      hex?(nonce) and byte_size(nonce) >= 16 ->
        normalize_timestamp(message["timestamp"])

      true ->
        case String.split(nonce, "-") do
          [client_id, timestamp_text, random_hex] when byte_size(random_hex) >= 8 ->
            expected_id = get_in(message, ["meta", "client_id"])

            if expected_id && client_id != expected_id do
              {:error, "nonce client_id mismatch"}
            else
              case Integer.parse(timestamp_text) do
                {timestamp, ""} -> normalize_timestamp(timestamp)
                _ -> {:error, "invalid legacy nonce timestamp"}
              end
            end

          _ ->
            {:error, "invalid nonce format"}
        end
    end
  end

  defp normalize_timestamp(timestamp) when is_integer(timestamp) do
    if timestamp < 1_000_000_000_000,
      do: {:ok, timestamp * 1_000},
      else: {:ok, timestamp}
  end

  defp normalize_timestamp(_timestamp), do: {:error, "missing or invalid timestamp"}
  defp hex?(value) when is_binary(value), do: String.match?(value, ~r/^[0-9a-fA-F]+$/)
  defp hex?(_value), do: false

  # ---- outbound security --------------------------------------------------

  defp apply_security_features(envelope, state) do
    nonce = generate_nonce(state)

    envelope =
      envelope
      |> Map.put(:nonce, nonce)
      |> Map.put(:prev_message_hash, state.last_sent_hash)

    type = Map.get(envelope, :type) || Map.get(envelope, "type")
    control_frame = type in ["ping", "pong"]

    signing_key =
      if control_frame, do: state.session_mac_key, else: state.session_mac_key || state.secret_key

    if control_frame and not is_binary(state.session_mac_key),
      do: raise("post-handshake control frame requires negotiated session MAC key")

    envelope =
      if is_binary(signing_key) do
        Map.put(envelope, :signature, LTP.Crypto.sign_message(envelope, signing_key))
      else
        envelope
      end

    envelope =
      cond do
        not state.enable_metadata_encryption ->
          envelope

        not is_binary(state.session_encryption_key) or
            not is_binary(state.session_mac_key) ->
          raise "metadata encryption enabled without negotiated session keys"

        true ->
          metadata = %{
            thread_id: Map.get(envelope, :thread_id, ""),
            session_id: Map.get(envelope, :session_id, ""),
            timestamp: Map.get(envelope, :timestamp, 0)
          }

          encrypted_metadata = LTP.Crypto.encrypt_metadata(metadata, state.session_encryption_key)

          routing_tag =
            LTP.Crypto.generate_routing_tag(
              Map.get(envelope, :thread_id, ""),
              Map.get(envelope, :session_id, ""),
              state.session_mac_key
            )

          envelope
          |> Map.put(:encrypted_metadata, encrypted_metadata)
          |> Map.put(:routing_tag, routing_tag)
          |> Map.put(:thread_id, "")
          |> Map.put(:session_id, nil)
          |> Map.put(:timestamp, 0)
      end

    message_hash = LTP.Crypto.hash_envelope(envelope)
    {:ok, envelope, %{state | last_sent_hash: message_hash, security_state_initialized: true}}
  rescue
    error ->
      {:error, Exception.message(error), state}
  end

  defp generate_nonce(state) do
    timestamp = System.system_time(:millisecond)

    if state.session_mac_key do
      random_hex = :crypto.strong_rand_bytes(16) |> Base.encode16(case: :lower)
      input = "#{timestamp}-#{random_hex}"
      hmac = LTP.Crypto.hmac_sha256(input, state.session_mac_key)
      "hmac-#{String.slice(hmac, 0, 32)}-#{timestamp}"
    else
      :crypto.strong_rand_bytes(16) |> Base.encode16(case: :lower)
    end
  end

  # ---- handshake and dispatch --------------------------------------------

  defp send_handshake_init(state) do
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
      if public_key and state.secret_key do
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

    WebSockex.send_frame(self(), {:text, Jason.encode!(handshake)})
    state
  rescue
    error ->
      Logger.error("[LTP] Failed to build handshake: #{Exception.message(error)}")
      state
  end

  defp send_handshake_resume(state) do
    handshake = %{
      type: "handshake_resume",
      ltp_version: @ltp_version,
      client_id: state.client_id,
      thread_id: state.thread_id,
      resume_reason: "automatic_reconnect"
    }

    WebSockex.send_frame(self(), {:text, Jason.encode!(handshake)})
  end

  defp handle_message(%{"type" => "handshake_ack"} = ack, state) do
    thread_id = ack["thread_id"]
    session_id = ack["session_id"]
    heartbeat_interval_ms = ack["heartbeat_interval_ms"] || state.heartbeat_interval_ms

    resumed_same_session = ack["resumed"] == true and state.session_id == session_id

    new_state =
      if state.enable_ecdh_key_exchange and state.ecdh_private_key do
        handle_ecdh_key_exchange(ack, state, thread_id, session_id)
      else
        %{
          state
          | thread_id: thread_id,
            session_id: session_id,
            heartbeat_interval_ms: heartbeat_interval_ms,
            is_handshake_complete: true,
            reconnect_attempts: 0,
            last_pong_time: System.system_time(:millisecond)
        }
      end

    new_state =
      if resumed_same_session do
        new_state
      else
        %{
          new_state
          | last_sent_hash: nil,
            last_received_hash: nil,
            seen_nonces: %{},
            security_state_initialized: false
        }
      end

    if new_state.is_handshake_complete do
      if state.client_pid, do: send(state.client_pid, {:ltp_connected, thread_id, session_id})
      start_heartbeat(new_state, heartbeat_interval_ms)
    else
      {:close, new_state}
    end
  end

  defp handle_message(%{"type" => "handshake_reject"} = reject, state) do
    reason = reject["reason"]

    if state.thread_id do
      new_state = %{
        state
        | thread_id: nil,
          session_id: nil,
          last_sent_hash: nil,
          last_received_hash: nil,
          seen_nonces: %{},
          security_state_initialized: false
      }

      send_handshake_init(new_state)
      {:ok, new_state}
    else
      if state.client_pid,
        do: send(state.client_pid, {:ltp_error, "Handshake rejected: #{reason}"})

      {:close, state}
    end
  end

  defp handle_message(%{"type" => "ping"}, state) do
    case secure_control_frame("pong", state) do
      {:ok, pong, new_state} ->
        {:reply, {:text, Jason.encode!(pong)}, new_state}

      {:error, reason, unchanged_state} ->
        Logger.error("[LTP] Refusing insecure pong: #{reason}")
        {:ok, unchanged_state}
    end
  end

  defp handle_message(%{"type" => "pong"}, state) do
    new_state = %{state | last_pong_time: System.system_time(:millisecond)}
    {:ok, clear_heartbeat_timeout(new_state)}
  end

  defp handle_message(%{"type" => "state_update"} = message, state) do
    if state.client_pid, do: send(state.client_pid, {:ltp_state_update, message["payload"]})
    {:ok, state}
  end

  defp handle_message(%{"type" => "event"} = message, state) do
    if state.client_pid, do: send(state.client_pid, {:ltp_event, message["payload"]})
    {:ok, state}
  end

  defp handle_message(%{"type" => "error"} = message, state) do
    payload = message["payload"] || %{}
    if state.client_pid, do: send(state.client_pid, {:ltp_error, payload})
    {:ok, state}
  end

  defp handle_message(message, state) do
    Logger.debug("[LTP] Received message", %{type: message["type"]})
    {:ok, state}
  end

  defp handle_ecdh_key_exchange(ack, state, thread_id, session_id) do
    public_key = ack["server_ecdh_public_key"] || ack["server_public_key"]

    if not is_binary(public_key) do
      raise "Server did not provide ECDH public key"
    end

    if state.secret_key do
      with signature when is_binary(signature) <- ack["server_ecdh_signature"],
           timestamp when is_integer(timestamp) <- ack["server_ecdh_timestamp"],
           {:ok, nil} <-
             LTP.Crypto.verify_ecdh_public_key(
               public_key,
               session_id,
               timestamp,
               signature,
               state.secret_key,
               300_000
             ) do
        :ok
      else
        _ -> raise "ECDH public-key authentication failed"
      end
    end

    shared_secret = LTP.Crypto.derive_shared_secret(state.ecdh_private_key, public_key)
    {encryption_key, mac_key, _iv_key} = LTP.Crypto.derive_session_keys(shared_secret, session_id)

    %{
      state
      | thread_id: thread_id,
        session_id: session_id,
        heartbeat_interval_ms: ack["heartbeat_interval_ms"] || state.heartbeat_interval_ms,
        is_handshake_complete: true,
        reconnect_attempts: 0,
        last_pong_time: System.system_time(:millisecond),
        session_encryption_key: encryption_key,
        session_mac_key: mac_key
    }
  rescue
    error ->
      Logger.error("[LTP] ECDH key exchange rejected: #{Exception.message(error)}")
      if state.client_pid, do: send(state.client_pid, {:ltp_error, :ecdh_authentication_failed})
      %{state | is_handshake_complete: false}
  end

  # ---- heartbeat and reconnect -------------------------------------------

  defp secure_control_frame(type, state) do
    envelope = %{
      type: type,
      thread_id: state.thread_id,
      session_id: state.session_id,
      timestamp: System.system_time(:millisecond),
      payload: %{},
      meta: %{client_id: state.client_id},
      content_encoding: "json"
    }

    apply_security_features(envelope, state)
  end

  defp send_ping(state) do
    case secure_control_frame("ping", state) do
      {:ok, ping, new_state} ->
        WebSockex.send_frame(self(), {:text, Jason.encode!(ping)})
        {:ok, new_state}

      {:error, reason, unchanged_state} ->
        {:error, reason, unchanged_state}
    end
  end

  defp start_heartbeat(state, _interval_ms) do
    state = clear_heartbeat_timers(state)
    state = schedule_heartbeat(state)
    {:ok, schedule_heartbeat_timeout(state)}
  end

  defp schedule_heartbeat(state) do
    %{
      state
      | heartbeat_timer: Process.send_after(self(), :heartbeat, state.heartbeat_interval_ms)
    }
  end

  defp schedule_heartbeat_timeout(state) do
    %{
      state
      | heartbeat_timeout_timer:
          Process.send_after(self(), :heartbeat_timeout, state.heartbeat_timeout_ms)
    }
  end

  defp clear_heartbeat_timers(state) do
    if state.heartbeat_timer, do: Process.cancel_timer(state.heartbeat_timer)
    if state.heartbeat_timeout_timer, do: Process.cancel_timer(state.heartbeat_timeout_timer)
    %{state | heartbeat_timer: nil, heartbeat_timeout_timer: nil}
  end

  defp clear_heartbeat_timeout(state) do
    if state.heartbeat_timeout_timer, do: Process.cancel_timer(state.heartbeat_timeout_timer)
    schedule_heartbeat_timeout(%{state | heartbeat_timeout_timer: nil})
  end

  defp schedule_reconnect(state, reason) do
    config = state.reconnect_config
    max_retries = Map.get(config, :max_retries, 5)

    if state.reconnect_attempts >= max_retries do
      if state.client_pid,
        do: send(state.client_pid, {:ltp_permanent_failure, "Max reconnect attempts reached"})

      {:close, state}
    else
      base_delay = Map.get(config, :base_delay_ms, 1_000)
      max_delay = Map.get(config, :max_delay_ms, 30_000)
      delay = min(trunc(base_delay * :math.pow(2, state.reconnect_attempts)), max_delay)

      Logger.warning("[LTP] Scheduling reconnect", %{delay_ms: delay, reason: reason})
      if state.reconnect_timer, do: Process.cancel_timer(state.reconnect_timer)

      {:ok,
       %{
         state
         | reconnect_timer: Process.send_after(self(), {:reconnect}, delay),
           reconnect_attempts: state.reconnect_attempts + 1
       }}
    end
  end
end
