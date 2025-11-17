defmodule LTP do
  @moduledoc """
  LTP (Liminal Thread Protocol) client SDK for Elixir/Erlang.
  
  Provides a high-level API for connecting to LTP servers and sending
  state updates and events over WebSocket connections.
  
  ## Example
  
      {:ok, pid} = LTP.Client.start_link(%{
        url: "ws://localhost:8080",
        client_id: "elixir-example-1",
        default_context_tag: "evening_reflection"
      })
      
      :ok = LTP.Client.send_state_update(pid, %{
        kind: "affect_log_v1",
        data: [
          %{t: 1, valence: 0.2, arousal: -0.1},
          %{t: 2, valence: 0.3, arousal: -0.2}
        ]
      })
  """

  @version "0.1.0"

  @doc """
  Returns the SDK version.
  """
  def version, do: @version
end

