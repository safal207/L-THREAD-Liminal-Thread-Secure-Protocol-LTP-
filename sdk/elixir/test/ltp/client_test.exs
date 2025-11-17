defmodule LTP.ClientTest do
  use ExUnit.Case, async: false

  alias LTP.Client

  setup do
    # Ensure clean state before each test
    on_exit(fn ->
      # Cleanup any remaining processes
      :ok
    end)
  end

  describe "start_link/1" do
    test "starts client with valid options" do
      opts = %{
        url: "ws://localhost:8080",
        client_id: "test-client-1-#{:rand.uniform(10000)}"
      }

      # Start client (will attempt connection but that's ok for this test)
      case Client.start_link(opts) do
        {:ok, pid} ->
          assert Process.alive?(pid)
          # Clean up
          try do
            Client.stop(pid)
            Process.sleep(100)
          rescue
            _ -> Process.exit(pid, :kill)
          end
        
        {:error, {:already_started, _}} ->
          # Process already exists, skip this test
          :ok
        
        other ->
          flunk("Unexpected result: #{inspect(other)}")
      end
    end

    test "requires url and client_id" do
      # This will fail in init/1, so we need to catch the exit
      assert catch_exit(
        Client.start_link(%{url: "ws://localhost:8080"})
      )
    end
  end

  describe "send_state_update/3" do
    test "returns error when not connected" do
      opts = %{
        url: "ws://localhost:8080",
        client_id: "test-client-2-#{:rand.uniform(10000)}"
      }

      case Client.start_link(opts) do
        {:ok, pid} ->
          # Client is not connected yet, so should return error
          result = Client.send_state_update(pid, %{kind: "test", data: %{}})
          assert result == {:error, :not_connected}
          
          # Clean up
          try do
            Client.stop(pid)
            Process.sleep(100)
          rescue
            _ -> Process.exit(pid, :kill)
          end
        
        {:error, {:already_started, _}} ->
          # Skip if process already exists
          :ok
        
        other ->
          flunk("Unexpected result: #{inspect(other)}")
      end
    end
  end

  describe "get_thread_id/1 and get_session_id/1" do
    test "returns nil when not connected" do
      opts = %{
        url: "ws://localhost:8080",
        client_id: "test-client-3-#{:rand.uniform(10000)}"
      }

      case Client.start_link(opts) do
        {:ok, pid} ->
          assert Client.get_thread_id(pid) == nil
          assert Client.get_session_id(pid) == nil
          
          # Clean up
          try do
            Client.stop(pid)
            Process.sleep(100)
          rescue
            _ -> Process.exit(pid, :kill)
          end
        
        {:error, {:already_started, _}} ->
          # Skip if process already exists
          :ok
        
        other ->
          flunk("Unexpected result: #{inspect(other)}")
      end
    end
  end

  describe "stop/1" do
    test "stops the client process" do
      opts = %{
        url: "ws://localhost:8080",
        client_id: "test-client-4-#{:rand.uniform(10000)}"
      }

      case Client.start_link(opts) do
        {:ok, pid} ->
          assert Process.alive?(pid)
          
          # Stop the client
          :ok = Client.stop(pid)
          
          # Give process time to terminate
          Process.sleep(200)
          refute Process.alive?(pid)
        
        {:error, {:already_started, _}} ->
          # Skip if process already exists
          :ok
        
        other ->
          flunk("Unexpected result: #{inspect(other)}")
      end
    end
  end
end

