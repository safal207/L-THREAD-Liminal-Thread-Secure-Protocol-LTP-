# LTP Production-Ready Client Example (Elixir)
#
# Demonstrates:
# - GenServer-based client with supervision
# - Metrics collection
# - Batch operations
# - Error handling and recovery
# - Structured logging

Mix.install([
  {:ltp_elixir, path: "../../sdk/elixir"},
  {:jason, "~> 1.4"},
  {:websockex, "~> 0.4"}
])

defmodule ProductionLtpClient do
  use GenServer
  require Logger

  defstruct [
    :client_pid,
    :url,
    :client_id,
    :metrics,
    :logger
  ]

  # Public API

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts, :name))
  end

  def send_batch(pid, updates) when is_list(updates) do
    GenServer.call(pid, {:send_batch, updates})
  end

  def send_affect_log_batch(pid, logs) when is_list(logs) do
    GenServer.call(pid, {:send_affect_log_batch, logs})
  end

  def get_metrics(pid) do
    GenServer.call(pid, :get_metrics)
  end

  def stop(pid) do
    GenServer.stop(pid)
  end

  # GenServer callbacks

  @impl GenServer
  def init(opts) do
    url = Keyword.fetch!(opts, :url)
    client_id = Keyword.fetch!(opts, :client_id)
    logger = Keyword.get(opts, :logger, Logger)

    metrics = %{
      messages_sent: 0,
      messages_received: 0,
      errors: 0,
      reconnects: 0,
      start_time: System.system_time(:second)
    }

    # Start underlying LTP client
    client_opts = [
      url: url,
      client_id: client_id,
      default_context_tag: Keyword.get(opts, :default_context_tag, "production"),
      heartbeat_interval_ms: Keyword.get(opts, :heartbeat_interval_ms, 15_000),
      heartbeat_timeout_ms: Keyword.get(opts, :heartbeat_timeout_ms, 45_000),
      reconnect: Keyword.get(opts, :reconnect, %{
        max_retries: 10,
        base_delay_ms: 1_000,
        max_delay_ms: 60_000
      })
    ]

    case LTP.Client.start_link(client_opts) do
      {:ok, client_pid} ->
        logger.info("Production client started", %{
          client_id: client_id,
          url: url
        })

        state = %__MODULE__{
          client_pid: client_pid,
          url: url,
          client_id: client_id,
          metrics: metrics,
          logger: logger
        }

        {:ok, state}

      {:error, reason} ->
        logger.error("Failed to start production client", %{reason: inspect(reason)})
        {:stop, reason}
    end
  end

  @impl GenServer
  def handle_call({:send_batch, updates}, _from, state) do
    results = Enum.map(updates, fn update ->
      try do
        :ok = LTP.Client.send_state_update(state.client_pid, update)
        state.logger.debug("Sent state update", %{kind: update[:kind]})
        %{success: true, update: update}
      rescue
        e ->
          state.logger.error("Failed to send state update", %{
            error: inspect(e),
            update: update
          })
          %{success: false, update: update, error: inspect(e)}
      end
    end)

    new_metrics = %{
      state.metrics
      | messages_sent: state.metrics.messages_sent + length(updates)
    }

    {:reply, results, %{state | metrics: new_metrics}}
  end

  @impl GenServer
  def handle_call({:send_affect_log_batch, logs}, _from, state) do
    state.logger.info("Sending affect log batch", %{count: length(logs)})

    try do
      :ok = LTP.Client.send_state_update(state.client_pid, %{
        kind: "affect_log_batch",
        data: logs
      })

      new_metrics = %{
        state.metrics
        | messages_sent: state.metrics.messages_sent + 1
      }

      {:reply, {:ok, :sent}, %{state | metrics: new_metrics}}
    rescue
      e ->
        new_metrics = %{
          state.metrics
          | errors: state.metrics.errors + 1
        }

        state.logger.error("Failed to send affect log batch", %{error: inspect(e)})
        {:reply, {:error, inspect(e)}, %{state | metrics: new_metrics}}
    end
  end

  @impl GenServer
  def handle_call(:get_metrics, _from, state) do
    uptime = System.system_time(:second) - state.metrics.start_time
    metrics = Map.put(state.metrics, :uptime_seconds, uptime)
    {:reply, metrics, state}
  end

  @impl GenServer
  def handle_info(msg, state) do
    state.logger.debug("Received message", %{message: inspect(msg)})
    {:noreply, state}
  end
end

# Example usage
defmodule Example do
  require Logger

  def run do
    Logger.info("=== Production LTP Client Example ===\n")

    # Start production client
    {:ok, pid} = ProductionLtpClient.start_link([
      url: "ws://localhost:8080",
      client_id: "prod-elixir-example-001",
      default_context_tag: "production_monitoring"
    ])

    Process.sleep(2000)  # Wait for connection

    # Send affect log batch
    affect_logs = Enum.map(1..100, fn i ->
      %{
        t: i,
        valence: 0.5 * (1 + (rem(i, 10)) / 10),
        arousal: 0.3 * (1 - (rem(i, 10)) / 10),
        timestamp: System.system_time(:second) + i
      }
    end)

    case ProductionLtpClient.send_affect_log_batch(pid, affect_logs) do
      {:ok, _} -> Logger.info("Affect log batch sent successfully")
      {:error, reason} -> Logger.error("Failed to send batch", %{reason: reason})
    end

    # Send batch state updates
    updates = [
      %{kind: "system_status", data: %{cpu: 0.5, memory: 0.7}},
      %{kind: "user_activity", data: %{action: "login", userId: "user123"}},
      %{kind: "performance_metric", data: %{latency: 120, throughput: 1000}}
    ]

    results = ProductionLtpClient.send_batch(pid, updates)
    successful = Enum.count(results, & &1[:success])
    Logger.info("Batch updates", %{successful: successful, total: length(results)})

    # Get metrics
    Process.sleep(2000)
    metrics = ProductionLtpClient.get_metrics(pid)
    Logger.info("Final metrics", metrics)

    # Stop client
    ProductionLtpClient.stop(pid)
    Logger.info("Client stopped")
  end
end

Example.run()

