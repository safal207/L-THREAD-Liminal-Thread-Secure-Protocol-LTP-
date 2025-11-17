defmodule LTP.Connection do
  @moduledoc """
  Low-level WebSocket connection handler for LTP protocol.
  
  Manages WebSocket lifecycle, handshake, heartbeat, and message routing.
  Uses websockex library for WebSocket communication.
  """

  use WebSockex
  require Logger

  @ltp_version "0.3"

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
    :client_pid
  ]

  # Public API

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
      reconnect_config: Keyword.get(opts, :reconnect, %{
        max_retries: 5,
        base_delay_ms: 1_000,
        max_delay_ms: 30_000
      }),
      default_context_tag: Keyword.get(opts, :default_context_tag),
      default_affect: Keyword.get(opts, :default_affect),
      reconnect_attempts: 0,
      is_handshake_complete: false,
      client_pid: Keyword.get(opts, :client_pid)
    }

    WebSockex.start_link(state.url, __MODULE__, state, name: Keyword.get(opts, :name))
  end

  # WebSockex callbacks

  def init(state) do
    {:ok, state}
  end

  @impl WebSockex
  def handle_connect(_conn, state) do
    Logger.info("[LTP] WebSocket connected, initiating handshake...")

    # Try resume if we have thread_id, otherwise init
    if state.thread_id do
      send_handshake_resume(state)
    else
      send_handshake_init(state)
    end

    {:ok, state}
  end

  @impl WebSockex
  def handle_frame({:text, json}, state) do
    case Jason.decode(json) do
      {:ok, message} ->
        handle_message(message, state)

      {:error, error} ->
        Logger.error("[LTP] Failed to parse message: #{inspect(error)}")
        {:ok, state}
    end
  end

  @impl WebSockex
  def handle_frame(_frame, state) do
    {:ok, state}
  end

  @impl WebSockex
  def handle_disconnect(%{reason: reason}, state) do
    Logger.warn("[LTP] WebSocket disconnected: #{inspect(reason)}")
    clear_heartbeat_timers(state)
    schedule_reconnect(state, "disconnected")
  end

  @impl WebSockex
  def handle_info(:heartbeat, state) do
    if state.is_handshake_complete do
      send_ping(state)
      schedule_heartbeat(state)
    end

    {:ok, state}
  end

  @impl WebSockex
  def handle_info({:send_message, envelope}, state) do
    json = Jason.encode!(envelope)
    {:reply, {:text, json}, state}
  end

  @impl WebSockex
  def handle_info({:reconnect}, state) do
    Logger.info("[LTP] Attempting reconnect...")
    {:reconnect, state}
  end

  @impl WebSockex
  def handle_info(_msg, state) do
    {:ok, state}
  end

  # Private helpers

  defp send_handshake_init(state) do
    handshake = %{
      type: "handshake_init",
      ltp_version: @ltp_version,
      client_id: state.client_id,
      device_fingerprint: state.device_fingerprint,
      intent: state.intent,
      capabilities: state.capabilities,
      metadata: Map.merge(%{sdk_version: "0.1.0", platform: "elixir"}, state.metadata)
    }

    json = Jason.encode!(handshake)
    WebSockex.send_frame(self(), {:text, json})
  end

  defp send_handshake_resume(state) do
    handshake = %{
      type: "handshake_resume",
      ltp_version: @ltp_version,
      client_id: state.client_id,
      thread_id: state.thread_id,
      resume_reason: "automatic_reconnect"
    }

    json = Jason.encode!(handshake)
    WebSockex.send_frame(self(), {:text, json})
  end

  defp handle_message(%{"type" => "handshake_ack"} = ack, state) do
    thread_id = ack["thread_id"]
    session_id = ack["session_id"]
    resumed = ack["resumed"] || false
    heartbeat_interval = ack["heartbeat_interval_ms"] || state.heartbeat_interval_ms

    Logger.info("[LTP] Handshake acknowledged", %{
      thread_id: thread_id,
      session_id: session_id,
      resumed: resumed
    })

    new_state = %{
      state
      | thread_id: thread_id,
        session_id: session_id,
        is_handshake_complete: true,
        reconnect_attempts: 0,
        last_pong_time: System.system_time(:millisecond)
    }

    # Notify client process
    if state.client_pid do
      send(state.client_pid, {:ltp_connected, thread_id, session_id})
    end

    start_heartbeat(new_state, heartbeat_interval)
  end

  defp handle_message(%{"type" => "handshake_reject"} = reject, state) do
    reason = reject["reason"]
    Logger.warn("[LTP] Handshake rejected", %{reason: reason})

    # If resume was rejected, try init
    if state.thread_id do
      new_state = %{state | thread_id: nil, session_id: nil}
      send_handshake_init(new_state)
      {:ok, new_state}
    else
      # Permanent failure
      if state.client_pid do
        send(state.client_pid, {:ltp_error, "Handshake rejected: #{reason}"})
      end
      {:close, state}
    end
  end

  defp handle_message(%{"type" => "ping"} = ping, state) do
    pong = %{
      type: "pong",
      thread_id: ping["thread_id"],
      session_id: ping["session_id"],
      timestamp: System.system_time(:second)
    }

    json = Jason.encode!(pong)
    WebSockex.send_frame(self(), {:text, json})
    {:ok, state}
  end

  defp handle_message(%{"type" => "pong"} = _pong, state) do
    new_state = %{state | last_pong_time: System.system_time(:millisecond)}
    clear_heartbeat_timeout(new_state)
    {:ok, new_state}
  end

  defp handle_message(%{"type" => "state_update"} = message, state) do
    if state.client_pid do
      send(state.client_pid, {:ltp_state_update, message["payload"]})
    end
    {:ok, state}
  end

  defp handle_message(%{"type" => "event"} = message, state) do
    if state.client_pid do
      send(state.client_pid, {:ltp_event, message["payload"]})
    end
    {:ok, state}
  end

  defp handle_message(%{"type" => "error"} = message, state) do
    payload = message["payload"] || %{}
    Logger.error("[LTP] Server error", %{
      error_code: payload["error_code"],
      error_message: payload["error_message"]
    })

    if state.client_pid do
      send(state.client_pid, {:ltp_error, payload})
    end

    {:ok, state}
  end

  defp handle_message(message, state) do
    Logger.debug("[LTP] Received message", %{type: message["type"]})
    {:ok, state}
  end

  defp send_ping(state) do
    ping = %{
      type: "ping",
      thread_id: state.thread_id,
      session_id: state.session_id,
      timestamp: System.system_time(:second)
    }

    json = Jason.encode!(ping)
    WebSockex.send_frame(self(), {:text, json})
  end

  defp start_heartbeat(state, _interval_ms) do
    clear_heartbeat_timers(state)
    schedule_heartbeat(state)
    schedule_heartbeat_timeout(state)
    {:ok, state}
  end

  defp schedule_heartbeat(state) do
    timer = Process.send_after(self(), :heartbeat, state.heartbeat_interval_ms)
    %{state | heartbeat_timer: timer}
  end

  defp schedule_heartbeat_timeout(state) do
    timer =
      Process.send_after(self(), :heartbeat_timeout, state.heartbeat_timeout_ms)

    %{state | heartbeat_timeout_timer: timer}
  end

  defp clear_heartbeat_timers(state) do
    if state.heartbeat_timer do
      Process.cancel_timer(state.heartbeat_timer)
    end

    if state.heartbeat_timeout_timer do
      Process.cancel_timer(state.heartbeat_timeout_timer)
    end

    %{state | heartbeat_timer: nil, heartbeat_timeout_timer: nil}
  end

  defp clear_heartbeat_timeout(state) do
    if state.heartbeat_timeout_timer do
      Process.cancel_timer(state.heartbeat_timeout_timer)
    end

    schedule_heartbeat_timeout(state)
  end

  defp schedule_reconnect(state, reason) do
    config = state.reconnect_config
    max_retries = Map.get(config, :max_retries, 5)

    if state.reconnect_attempts >= max_retries do
      Logger.error("[LTP] Max reconnect attempts reached")
      if state.client_pid do
        send(state.client_pid, {:ltp_permanent_failure, "Max reconnect attempts reached"})
      end
      {:close, state}
    else
      base_delay = Map.get(config, :base_delay_ms, 1_000)
      max_delay = Map.get(config, :max_delay_ms, 30_000)

      delay =
        min(
          base_delay * :math.pow(2, state.reconnect_attempts) |> trunc(),
          max_delay
        )

      Logger.warn("[LTP] Scheduling reconnect", %{delay_ms: delay, reason: reason})

      timer = Process.send_after(self(), {:reconnect}, delay)

      new_state = %{
        state
        | reconnect_timer: timer,
          reconnect_attempts: state.reconnect_attempts + 1
      }

      {:ok, new_state}
    end
  end
end

