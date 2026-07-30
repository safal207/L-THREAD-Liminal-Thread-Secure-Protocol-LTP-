defmodule LTP.ClientTest do
  use ExUnit.Case, async: true

  alias LTP.Client

  defmodule StoppableProcess do
    use GenServer

    def start_link, do: GenServer.start_link(__MODULE__, :ok)
    @impl GenServer
    def init(:ok), do: {:ok, %{}}
  end

  describe "start_link/1" do
    test "requires url and client_id" do
      result = Client.start_link(%{url: "ws://localhost:8080"})
      assert {:error, {{:badkey, :client_id}, _stacktrace}} = result
    end

    test "reports a connection error when the endpoint is unavailable" do
      previous = Process.flag(:trap_exit, true)
      on_exit(fn -> Process.flag(:trap_exit, previous) end)

      opts = %{
        url: "ws://127.0.0.1:1",
        client_id: "unavailable-endpoint-client"
      }

      assert {:error, %WebSockex.ConnError{original: :econnrefused}} = Client.start_link(opts)
    end
  end

  describe "send_state_update/3 callback" do
    test "returns error when not connected" do
      state = %Client{is_connected: false}

      assert {:reply, {:error, :not_connected}, ^state} =
               Client.handle_call(
                 {:send_state_update, %{kind: "test", data: %{}}, []},
                 {self(), make_ref()},
                 state
               )
    end
  end

  describe "thread and session ID callbacks" do
    test "return nil before a connection is established" do
      state = %Client{thread_id: nil, session_id: nil, is_connected: false}

      assert {:reply, nil, ^state} =
               Client.handle_call(:get_thread_id, {self(), make_ref()}, state)

      assert {:reply, nil, ^state} =
               Client.handle_call(:get_session_id, {self(), make_ref()}, state)
    end
  end

  describe "stop/1" do
    test "stops a GenServer process" do
      {:ok, pid} = StoppableProcess.start_link()
      monitor = Process.monitor(pid)

      assert :ok = Client.stop(pid)
      assert_receive {:DOWN, ^monitor, :process, ^pid, :normal}
      refute Process.alive?(pid)
    end
  end
end
