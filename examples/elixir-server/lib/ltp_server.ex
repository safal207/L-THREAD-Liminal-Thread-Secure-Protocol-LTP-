defmodule LTPServer do
  @moduledoc """
  LTP Server implementation in Elixir.
  Demonstrates how to build an LTP-compatible server using BEAM processes.
  """

  use GenServer
  require Logger

  @ltp_version "0.3"
  @port 8080

  defstruct [
    :port,
    :listener,
    :threads,
    :sessions,
    :heartbeat_interval_ms
  ]

  # Public API

  def start_link(opts \\ []) do
    port = Keyword.get(opts, :port, @port)
    GenServer.start_link(__MODULE__, %{port: port}, name: __MODULE__)
  end

  # GenServer callbacks

  @impl GenServer
  def init(state) do
    port = state.port
    Logger.info("[LTP Server] Starting on port #{port}")

    case :ranch.start_listener(
           :ltp_server,
           :ranch_tcp,
           %{socket_opts: [{:port, port}]},
           LTPServer.Connection,
           []
         ) do
      {:ok, _} ->
        Logger.info("[LTP Server] Listening on ws://localhost:#{port}")
        {:ok, %{state | threads: %{}, sessions: %{}, heartbeat_interval_ms: 15_000}}

      {:error, reason} ->
        Logger.error("[LTP Server] Failed to start: #{inspect(reason)}")
        {:stop, reason}
    end
  end

  @impl GenServer
  def handle_call({:register_thread, thread_id, session_id, client_id}, _from, state) do
    threads = Map.put(state.threads, thread_id, %{
      thread_id: thread_id,
      last_session_id: session_id,
      client_id: client_id,
      last_seen: System.system_time(:millisecond)
    })

    sessions = Map.put(state.sessions, session_id, %{
      session_id: session_id,
      thread_id: thread_id,
      client_id: client_id,
      connected_at: System.system_time(:millisecond)
    })

    {:reply, :ok, %{state | threads: threads, sessions: sessions}}
  end

  @impl GenServer
  def handle_call({:get_thread, thread_id}, _from, state) do
    thread = Map.get(state.threads, thread_id)
    {:reply, thread, state}
  end

  @impl GenServer
  def handle_info(_msg, state) do
    {:noreply, state}
  end

  # Helper functions

  def create_handshake_ack(thread_id, session_id, resumed \\ false) do
    %{
      type: "handshake_ack",
      ltp_version: @ltp_version,
      thread_id: thread_id,
      session_id: session_id,
      resumed: resumed,
      server_capabilities: ["state-update", "ping-pong", "events"],
      heartbeat_interval_ms: 15_000,
      metadata: %{
        server_version: "0.1.0",
        region: "local"
      }
    }
  end

  def create_handshake_reject(reason) do
    %{
      type: "handshake_reject",
      ltp_version: @ltp_version,
      reason: reason,
      suggest_new: true
    }
  end
end

defmodule LTPServer.Connection do
  @moduledoc """
  Handles individual WebSocket connections for LTP protocol.
  """

  use WebSockex
  require Logger

  defstruct [
    :server_pid,
    :thread_id,
    :session_id,
    :client_id,
    :last_pong_time
  ]

  @impl WebSockex
  def init(state) do
    {:ok, state}
  end

  @impl WebSockex
  def handle_connect(_conn, state) do
    Logger.info("[LTP Server] New connection")
    {:ok, state}
  end

  @impl WebSockex
  def handle_frame({:text, json}, state) do
    case Jason.decode(json) do
      {:ok, message} ->
        handle_message(message, state)

      {:error, error} ->
        Logger.error("[LTP Server] Failed to parse message: #{inspect(error)}")
        {:ok, state}
    end
  end

  @impl WebSockex
  def handle_frame(_frame, state) do
    {:ok, state}
  end

  @impl WebSockex
  def handle_disconnect(%{reason: reason}, state) do
    Logger.info("[LTP Server] Connection closed: #{inspect(reason)}")
    {:ok, state}
  end

  defp handle_message(%{"type" => "handshake_init"} = msg, state) do
    thread_id = UUID.uuid4()
    session_id = UUID.uuid4()
    client_id = msg["client_id"]

    # Register with server
    if state.server_pid do
      GenServer.call(state.server_pid, {:register_thread, thread_id, session_id, client_id})
    end

    ack = LTPServer.create_handshake_ack(thread_id, session_id, false)
    json = Jason.encode!(ack)
    WebSockex.send_frame(self(), {:text, json})

    new_state = %{
      state
      | thread_id: thread_id,
        session_id: session_id,
        client_id: client_id,
        last_pong_time: System.system_time(:millisecond)
    }

    Logger.info("[LTP Server] Handshake completed", %{
      thread_id: thread_id,
      session_id: session_id,
      client_id: client_id
    })

    {:ok, new_state}
  end

  defp handle_message(%{"type" => "handshake_resume"} = msg, state) do
    thread_id = msg["thread_id"]
    client_id = msg["client_id"]

    # Check if thread exists
    if state.server_pid do
      case GenServer.call(state.server_pid, {:get_thread, thread_id}) do
        nil ->
          # Thread not found, reject
          reject = LTPServer.create_handshake_reject("Thread not found")
          json = Jason.encode!(reject)
          WebSockex.send_frame(self(), {:text, json})
          {:ok, state}

        _thread ->
          # Thread found, resume
          session_id = UUID.uuid4()
          GenServer.call(state.server_pid, {:register_thread, thread_id, session_id, client_id})

          ack = LTPServer.create_handshake_ack(thread_id, session_id, true)
          json = Jason.encode!(ack)
          WebSockex.send_frame(self(), {:text, json})

          new_state = %{
            state
            | thread_id: thread_id,
              session_id: session_id,
              client_id: client_id,
              last_pong_time: System.system_time(:millisecond)
          }

          Logger.info("[LTP Server] Handshake resumed", %{
            thread_id: thread_id,
            session_id: session_id
          })

          {:ok, new_state}
      end
    else
      {:ok, state}
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

    new_state = %{state | last_pong_time: System.system_time(:millisecond)}
    {:ok, new_state}
  end

  defp handle_message(%{"type" => "state_update"} = msg, state) do
    payload = msg["payload"] || %{}
    content_encoding = msg["content_encoding"] || "json"

    Logger.info("[LTP Server] Received state_update", %{
      thread_id: state.thread_id,
      kind: payload["kind"],
      content_encoding: content_encoding,
      data_preview: preview_data(payload["data"], content_encoding)
    })

    {:ok, state}
  end

  defp handle_message(%{"type" => "event"} = msg, state) do
    payload = msg["payload"] || %{}

    Logger.info("[LTP Server] Received event", %{
      thread_id: state.thread_id,
      event_type: payload["event_type"]
    })

    {:ok, state}
  end

  defp handle_message(msg, state) do
    Logger.debug("[LTP Server] Received message", %{type: msg["type"]})
    {:ok, state}
  end

  defp preview_data(data, "toon") when is_binary(data) do
    # Show first few lines of TOON
    data
    |> String.split("\n")
    |> Enum.take(3)
    |> Enum.join("\n")
  end

  defp preview_data(data, _encoding) when is_map(data) or is_list(data) do
    # Show JSON preview
    data
    |> Jason.encode!()
    |> String.slice(0, 100)
  end

  defp preview_data(data, _encoding), do: inspect(data)
end

