defmodule LTP.Client do
  @moduledoc """
  High-level LTP client API implemented as a GenServer.
  
  Manages connection lifecycle, provides convenient methods for sending
  state updates and events, and handles reconnection logic.
  """

  use GenServer
  require Logger

  @type options :: %{
          url: String.t(),
          client_id: String.t(),
          device_fingerprint: String.t() | nil,
          intent: String.t() | nil,
          capabilities: list(String.t()) | nil,
          metadata: map() | nil,
          default_context_tag: String.t() | nil,
          default_affect: map() | nil,
          heartbeat_interval_ms: non_neg_integer(),
          heartbeat_timeout_ms: non_neg_integer(),
          reconnect: %{
            max_retries: non_neg_integer(),
            base_delay_ms: non_neg_integer(),
            max_delay_ms: non_neg_integer()
          } | nil
        }

  defstruct [
    :connection_pid,
    :url,
    :client_id,
    :device_fingerprint,
    :intent,
    :capabilities,
    :metadata,
    :default_context_tag,
    :default_affect,
    :heartbeat_interval_ms,
    :heartbeat_timeout_ms,
    :reconnect_config,
    :thread_id,
    :session_id,
    :is_connected
  ]

  # Public API

  @spec start_link(options()) :: GenServer.on_start()
  def start_link(opts) when is_list(opts) do
    opts_map = Enum.into(opts, %{})
    start_link(opts_map)
  end

  def start_link(opts) when is_map(opts) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts[:name] || [], :name))
  end

  @spec send_state_update(pid(), map(), keyword()) :: :ok | {:error, term()}
  def send_state_update(client_pid, payload, opts \\ []) do
    GenServer.call(client_pid, {:send_state_update, payload, opts})
  end

  @spec send_event(pid(), String.t(), map(), keyword()) :: :ok | {:error, term()}
  def send_event(client_pid, event_type, data, opts \\ []) do
    GenServer.call(client_pid, {:send_event, event_type, data, opts})
  end

  @spec stop(pid()) :: :ok
  def stop(client_pid) do
    GenServer.stop(client_pid)
  end

  @spec get_thread_id(pid()) :: String.t() | nil
  def get_thread_id(client_pid) do
    GenServer.call(client_pid, :get_thread_id)
  end

  @spec get_session_id(pid()) :: String.t() | nil
  def get_session_id(client_pid) do
    GenServer.call(client_pid, :get_session_id)
  end

  # GenServer callbacks

  @impl GenServer
  def init(opts) do
    url = Map.fetch!(opts, :url)
    client_id = Map.fetch!(opts, :client_id)

    state = %__MODULE__{
      url: url,
      client_id: client_id,
      device_fingerprint: Map.get(opts, :device_fingerprint),
      intent: Map.get(opts, :intent, "resonant_link"),
      capabilities: Map.get(opts, :capabilities, ["state-update", "events", "ping-pong"]),
      metadata: Map.get(opts, :metadata, %{}),
      default_context_tag: Map.get(opts, :default_context_tag),
      default_affect: Map.get(opts, :default_affect),
      heartbeat_interval_ms: Map.get(opts, :heartbeat_interval_ms, 15_000),
      heartbeat_timeout_ms: Map.get(opts, :heartbeat_timeout_ms, 45_000),
      reconnect_config: Map.get(opts, :reconnect, %{
        max_retries: 5,
        base_delay_ms: 1_000,
        max_delay_ms: 30_000
      }),
      is_connected: false
    }

    # Start connection process
    connection_opts = [
      url: url,
      client_id: client_id,
      device_fingerprint: state.device_fingerprint,
      intent: state.intent,
      capabilities: state.capabilities,
      metadata: state.metadata,
      heartbeat_interval_ms: state.heartbeat_interval_ms,
      heartbeat_timeout_ms: state.heartbeat_timeout_ms,
      reconnect: state.reconnect_config,
      default_context_tag: state.default_context_tag,
      default_affect: state.default_affect,
      client_pid: self()
    ]

    case LTP.Connection.start_link(connection_opts) do
      {:ok, connection_pid} ->
        {:ok, %{state | connection_pid: connection_pid}}

      {:error, {:already_started, _pid}} ->
        # Connection already exists, continue with existing pid
        {:ok, state}

      {:error, reason} ->
        Logger.error("[LTP] Failed to start connection: #{inspect(reason)}")
        {:stop, reason}
    end
  end

  @impl GenServer
  def handle_call({:send_state_update, payload, opts}, _from, state) do
    if not state.is_connected do
      {:reply, {:error, :not_connected}, state}
    else
      envelope = build_state_update_envelope(state, payload, opts)
      send_envelope(state.connection_pid, envelope)
      {:reply, :ok, state}
    end
  end

  @impl GenServer
  def handle_call({:send_event, event_type, data, opts}, _from, state) do
    if not state.is_connected do
      {:reply, {:error, :not_connected}, state}
    else
      envelope = build_event_envelope(state, event_type, data, opts)
      send_envelope(state.connection_pid, envelope)
      {:reply, :ok, state}
    end
  end

  @impl GenServer
  def handle_call(:get_thread_id, _from, state) do
    {:reply, state.thread_id, state}
  end

  @impl GenServer
  def handle_call(:get_session_id, _from, state) do
    {:reply, state.session_id, state}
  end

  @impl GenServer
  def handle_info({:ltp_connected, thread_id, session_id}, state) do
    Logger.info("[LTP] Client connected", %{
      thread_id: thread_id,
      session_id: session_id
    })

    new_state = %{
      state
      | thread_id: thread_id,
        session_id: session_id,
        is_connected: true
    }

    {:noreply, new_state}
  end

  @impl GenServer
  def handle_info({:ltp_state_update, payload}, state) do
    Logger.debug("[LTP] Received state update", %{payload: payload})
    {:noreply, state}
  end

  @impl GenServer
  def handle_info({:ltp_event, payload}, state) do
    Logger.debug("[LTP] Received event", %{payload: payload})
    {:noreply, state}
  end

  @impl GenServer
  def handle_info({:ltp_error, error}, state) do
    Logger.error("[LTP] Connection error", %{error: error})
    {:noreply, %{state | is_connected: false}}
  end

  @impl GenServer
  def handle_info({:ltp_permanent_failure, reason}, state) do
    Logger.error("[LTP] Permanent failure", %{reason: reason})
    {:stop, {:shutdown, reason}, state}
  end

  @impl GenServer
  def handle_info(msg, state) do
    Logger.debug("[LTP] Unhandled message", %{message: msg})
    {:noreply, state}
  end

  # Private helpers

  defp build_state_update_envelope(state, payload, opts) do
    kind = Map.get(payload, :kind, "state_update")
    data = Map.get(payload, :data, payload)

    meta = %{
      client_id: state.client_id
    }

    meta =
      if state.default_context_tag do
        Map.put(meta, :context_tag, state.default_context_tag)
      else
        meta
      end

    meta =
      if context_tag = Keyword.get(opts, :context_tag) do
        Map.put(meta, :context_tag, context_tag)
      else
        meta
      end

    meta =
      if affect = Keyword.get(opts, :affect) || state.default_affect do
        Map.put(meta, :affect, affect)
      else
        meta
      end

    %{
      type: "state_update",
      thread_id: state.thread_id,
      session_id: state.session_id,
      timestamp: System.system_time(:second),
      content_encoding: :json,
      payload: %{
        kind: kind,
        data: data
      },
      meta: meta,
      nonce: generate_nonce(),
      signature: "v0-placeholder"
    }
  end

  defp build_event_envelope(state, event_type, data, opts) do
    meta = %{
      client_id: state.client_id
    }

    meta =
      if state.default_context_tag do
        Map.put(meta, :context_tag, state.default_context_tag)
      else
        meta
      end

    meta =
      if context_tag = Keyword.get(opts, :context_tag) do
        Map.put(meta, :context_tag, context_tag)
      else
        meta
      end

    meta =
      if affect = Keyword.get(opts, :affect) || state.default_affect do
        Map.put(meta, :affect, affect)
      else
        meta
      end

    %{
      type: "event",
      thread_id: state.thread_id,
      session_id: state.session_id,
      timestamp: System.system_time(:second),
      content_encoding: :json,
      payload: %{
        event_type: event_type,
        data: data
      },
      meta: meta,
      nonce: generate_nonce(),
      signature: "v0-placeholder"
    }
  end

  defp send_envelope(connection_pid, envelope) do
    send(connection_pid, {:send_message, envelope})
  end

  defp generate_nonce do
    :crypto.strong_rand_bytes(16)
    |> Base.encode16(case: :lower)
  end
end

