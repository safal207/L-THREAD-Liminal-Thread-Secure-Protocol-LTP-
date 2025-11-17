defmodule LTP.ClientTest do
  use ExUnit.Case, async: true
  doctest LTP.Client

  alias LTP.Client

  describe "start_link/1" do
    test "starts client with valid options" do
      opts = %{
        url: "ws://localhost:8080",
        client_id: "test-client-1"
      }

      assert {:ok, pid} = Client.start_link(opts)
      assert Process.alive?(pid)
      Process.exit(pid, :normal)
    end

    test "requires url and client_id" do
      assert_raise KeyError, fn ->
        Client.start_link(%{url: "ws://localhost:8080"})
      end
    end
  end

  describe "send_state_update/3" do
    setup do
      # Mock connection would be set up here
      # For now, we'll test the API structure
      :ok
    end

    test "returns error when not connected" do
      opts = %{
        url: "ws://localhost:8080",
        client_id: "test-client-2"
      }

      {:ok, pid} = Client.start_link(opts)
      # Client is not connected yet, so should return error
      result = Client.send_state_update(pid, %{kind: "test", data: %{}})
      assert result == {:error, :not_connected}
      Process.exit(pid, :normal)
    end
  end

  describe "get_thread_id/1 and get_session_id/1" do
    test "returns nil when not connected" do
      opts = %{
        url: "ws://localhost:8080",
        client_id: "test-client-3"
      }

      {:ok, pid} = Client.start_link(opts)
      assert Client.get_thread_id(pid) == nil
      assert Client.get_session_id(pid) == nil
      Process.exit(pid, :normal)
    end
  end

  describe "stop/1" do
    test "stops the client process" do
      opts = %{
        url: "ws://localhost:8080",
        client_id: "test-client-4"
      }

      {:ok, pid} = Client.start_link(opts)
      assert Process.alive?(pid)
      :ok = Client.stop(pid)
      # Give process time to terminate
      Process.sleep(100)
      refute Process.alive?(pid)
    end
  end
end

