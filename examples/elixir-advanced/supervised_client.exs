# LTP Supervised Client Example (Elixir)
#
# Demonstrates:
# - Supervision tree setup
# - Process monitoring
# - Automatic restart on failure
# - Graceful shutdown

Mix.install([
  {:ltp_elixir, path: "../../sdk/elixir"},
  {:jason, "~> 1.4"},
  {:websockex, "~> 0.4"}
])

defmodule SupervisedLtpClient do
  use GenServer
  require Logger

  defstruct [
    :client_pid,
    :url,
    :client_id,
    :restart_count
  ]

  # Public API

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts)
  end

  def send_message(pid, payload) do
    GenServer.call(pid, {:send_message, payload})
  end

  # GenServer callbacks

  @impl GenServer
  def init(opts) do
    url = Keyword.fetch!(opts, :url)
    client_id = Keyword.fetch!(opts, :client_id)

    # Start underlying LTP client
    client_opts = [
      url: url,
      client_id: client_id,
      default_context_tag: Keyword.get(opts, :default_context_tag, "supervised")
    ]

    case LTP.Client.start_link(client_opts) do
      {:ok, client_pid} ->
        Logger.info("Supervised client started", %{
          client_id: client_id,
          url: url
        })

        state = %__MODULE__{
          client_pid: client_pid,
          url: url,
          client_id: client_id,
          restart_count: 0
        }

        {:ok, state}

      {:error, reason} ->
        Logger.error("Failed to start supervised client", %{reason: inspect(reason)})
        {:stop, reason}
    end
  end

  @impl GenServer
  def handle_call({:send_message, payload}, _from, state) do
    try do
      :ok = LTP.Client.send_state_update(state.client_pid, payload)
      {:reply, :ok, state}
    rescue
      e ->
        Logger.error("Failed to send message", %{error: inspect(e)})
        {:reply, {:error, inspect(e)}, state}
    end
  end

  @impl GenServer
  def handle_info({:DOWN, _ref, :process, pid, reason}, state) do
    if pid == state.client_pid do
      Logger.warn("Client process died", %{reason: inspect(reason)})
      # In a real supervision tree, the supervisor would restart this process
      {:stop, {:shutdown, :client_died}, state}
    else
      {:noreply, state}
    end
  end

  @impl GenServer
  def handle_info(msg, state) do
    Logger.debug("Received message", %{message: inspect(msg)})
    {:noreply, state}
  end
end

defmodule LtpClientSupervisor do
  use Supervisor
  require Logger

  def start_link(opts) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl Supervisor
  def init(_opts) do
    children = [
      {
        SupervisedLtpClient,
        [
          url: "ws://localhost:8080",
          client_id: "supervised-example-001",
          default_context_tag: "supervised"
        ]
      }
    ]

    Supervisor.init(children, strategy: :one_for_one, max_restarts: 5, max_seconds: 10)
  end
end

# Example usage
defmodule Example do
  require Logger

  def run do
    Logger.info("=== Supervised LTP Client Example ===\n")

    # Start supervisor
    {:ok, supervisor_pid} = LtpClientSupervisor.start_link([])
    Logger.info("Supervisor started", %{pid: inspect(supervisor_pid)})

    # Get client PID from supervisor
    children = Supervisor.which_children(supervisor_pid)
    [{_, client_pid, _, _} | _] = children

    Process.sleep(2000)  # Wait for connection

    # Send messages
    for i <- 1..5 do
      SupervisedLtpClient.send_message(client_pid, %{
        kind: "test_message",
        data: %{index: i, timestamp: System.system_time(:second)}
      })
      Process.sleep(500)
    end

    Logger.info("Messages sent, waiting...")
    Process.sleep(3000)

    # Stop supervisor (will stop all children)
    Supervisor.stop(supervisor_pid)
    Logger.info("Supervisor stopped")
  end
end

Example.run()

