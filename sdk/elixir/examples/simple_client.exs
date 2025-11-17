#!/usr/bin/env elixir

Mix.install([
  {:ltp_elixir, path: Path.expand("../", __DIR__)}
])

defmodule SimpleClientExample do
  require Logger

  def run do
    Logger.info("=== LTP Elixir Client Example ===\n")

    # Start LTP client
    {:ok, pid} =
      LTP.Client.start_link(%{
        url: "ws://localhost:8080",
        client_id: "elixir-example-1",
        device_fingerprint: "elixir-example",
        intent: "resonant_link",
        capabilities: ["state-update", "events", "ping-pong"],
        default_context_tag: "evening_reflection",
        heartbeat_interval_ms: 15_000,
        heartbeat_timeout_ms: 45_000,
        reconnect: %{
          max_retries: 5,
          base_delay_ms: 1_000,
          max_delay_ms: 30_000
        }
      })

    Logger.info("Client started, waiting for connection...\n")

    # Wait for connection
    :timer.sleep(2_000)

    # Send initial state update
    Logger.info("→ Sending initial state update...")
    :ok = LTP.Client.send_state_update(pid, %{
      kind: "minimal",
      data: %{
        mood: "curious",
        focus: "exploration",
        energy_level: 0.8
      }
    }, affect: %{valence: 0.2, arousal: -0.1})

    :timer.sleep(1_000)

    # Send affect log
    Logger.info("→ Sending affect log...")
    :ok = LTP.Client.send_state_update(pid, %{
      kind: "affect_log_v1",
      data: [
        %{t: 1, valence: 0.2, arousal: -0.1},
        %{t: 2, valence: 0.3, arousal: -0.2},
        %{t: 3, valence: 0.1, arousal: 0.0}
      ]
    })

    :timer.sleep(1_000)

    # Send event
    Logger.info("→ Sending event...")
    :ok = LTP.Client.send_event(pid, "user_action", %{
      action: "button_click",
      target: "explore_mode",
      screen: "home"
    }, context_tag: "focus_session")

    :timer.sleep(2_000)

    # Get thread and session IDs
    thread_id = LTP.Client.get_thread_id(pid)
    session_id = LTP.Client.get_session_id(pid)

    Logger.info("Thread ID: #{inspect(thread_id)}")
    Logger.info("Session ID: #{inspect(session_id)}\n")

    Logger.info("Example completed. Press Ctrl+C to exit.")
    Process.sleep(:infinity)
  end
end

SimpleClientExample.run()

