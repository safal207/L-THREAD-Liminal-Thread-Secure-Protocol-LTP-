defmodule LTP.ClientTest do
  use ExUnit.Case, async: false

  alias LTP.Client

  describe "start_link/1" do
    test "starts client with valid options" do
      opts = %{
        url: "ws://localhost:8080",
        client_id: "test-client-1-#{:rand.uniform(100000)}"
      }

      assert {:ok, pid} = Client.start_link(opts)
      assert Process.alive?(pid)
      :ok = Client.stop(pid)
      Process.sleep(100)
      refute Process.alive?(pid)
    end

    test "requires url and client_id" do
      # Missing client_id triggers KeyError inside GenServer init.
      # GenServer.start_link catches the exception and returns {:error, {reason, stacktrace}}
      result = Client.start_link(%{url: "ws://localhost:8080"})
      assert {:error, {{:badkey, :client_id}, _stacktrace}} = result
    end
  end

  describe "send_state_update/3" do
    test "returns error when not connected" do
      opts = %{
        url: "ws://localhost:8080",
        client_id: "test-client-2-#{:rand.uniform(100000)}"
      }

      {:ok, pid} = Client.start_link(opts)
      assert Client.send_state_update(pid, %{kind: "test", data: %{}}) == {:error, :not_connected}
      :ok = Client.stop(pid)
    end
  end

  describe "get_thread_id/1 and get_session_id/1" do
    test "returns nil when not connected" do
      opts = %{
        url: "ws://localhost:8080",
        client_id: "test-client-3-#{:rand.uniform(100000)}"
      }

      {:ok, pid} = Client.start_link(opts)
      assert Client.get_thread_id(pid) == nil
      assert Client.get_session_id(pid) == nil
      :ok = Client.stop(pid)
    end
  end

  describe "stop/1" do
    test "stops the client process" do
      opts = %{
        url: "ws://localhost:8080",
        client_id: "test-client-4-#{:rand.uniform(100000)}"
      }

      {:ok, pid} = Client.start_link(opts)
      assert Process.alive?(pid)
      :ok = Client.stop(pid)
      Process.sleep(200)
      refute Process.alive?(pid)
    end
  end
end
