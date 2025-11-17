# LTP Elixir SDK

Elixir client SDK for LTP (Liminal Thread Protocol) v0.1.

## Overview

LTP (Liminal Thread Protocol) is a transport protocol built on top of WebSocket/TCP, designed to maintain context, intent, and inner state across communication sessions. This SDK provides a convenient Elixir/Erlang client implementation.

## Features

- ✅ WebSocket connection management
- ✅ Handshake init/resume support
- ✅ Automatic heartbeat (ping/pong)
- ✅ Automatic reconnection with exponential backoff
- ✅ State updates and events
- ✅ Thread and session continuity
- ✅ GenServer-based architecture leveraging BEAM processes

## Installation

Add to your `mix.exs`:

```elixir
def deps do
  [
    {:ltp_elixir, path: "../sdk/elixir"}
  ]
end
```

Or if published to Hex:

```elixir
{:ltp_elixir, "~> 0.1.0"}
```

## Quick Start

```elixir
# Start the client
{:ok, pid} = LTP.Client.start_link(%{
  url: "ws://localhost:8080",
  client_id: "my-client-1",
  default_context_tag: "evening_reflection",
  heartbeat_interval_ms: 15_000,
  heartbeat_timeout_ms: 45_000,
  reconnect: %{
    max_retries: 5,
    base_delay_ms: 1_000,
    max_delay_ms: 30_000
  }
})

# Send a state update
:ok = LTP.Client.send_state_update(pid, %{
  kind: "affect_log_v1",
  data: [
    %{t: 1, valence: 0.2, arousal: -0.1},
    %{t: 2, valence: 0.3, arousal: -0.2}
  ]
})

# Send an event
:ok = LTP.Client.send_event(pid, "user_action", %{
  action: "button_click",
  target: "explore_mode"
})

# Get connection info
thread_id = LTP.Client.get_thread_id(pid)
session_id = LTP.Client.get_session_id(pid)
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `String.t()` | **required** | WebSocket URL (ws:// or wss://) |
| `client_id` | `String.t()` | **required** | Unique client identifier |
| `device_fingerprint` | `String.t() \| nil` | `nil` | Device fingerprint |
| `intent` | `String.t()` | `"resonant_link"` | Connection intent |
| `capabilities` | `list(String.t())` | `["state-update", "events", "ping-pong"]` | Client capabilities |
| `metadata` | `map()` | `%{}` | Additional metadata |
| `default_context_tag` | `String.t() \| nil` | `nil` | Default context tag for all messages |
| `default_affect` | `map() \| nil` | `nil` | Default affect metadata |
| `heartbeat_interval_ms` | `non_neg_integer()` | `15_000` | Heartbeat ping interval |
| `heartbeat_timeout_ms` | `non_neg_integer()` | `45_000` | Heartbeat timeout |
| `reconnect` | `map()` | See below | Reconnection configuration |

### Reconnect Configuration

```elixir
reconnect: %{
  max_retries: 5,        # Maximum reconnection attempts
  base_delay_ms: 1_000,   # Base delay for exponential backoff
  max_delay_ms: 30_000    # Maximum delay between attempts
}
```

## Architecture

The SDK is built on BEAM's process model:

- **`LTP.Client`**: GenServer providing the high-level API
- **`LTP.Connection`**: WebSockex process managing the WebSocket connection
- **`LTP.Types`**: Type definitions and structures

The client automatically handles:
- Connection lifecycle
- Handshake negotiation (init/resume)
- Heartbeat management
- Automatic reconnection
- Message routing

## Examples

See `examples/simple_client.exs` for a complete example.

Run it with:

```bash
cd sdk/elixir
elixir examples/simple_client.exs
```

## Testing

```bash
cd sdk/elixir
mix test
```

## Version

Current version: **0.1.0**

## License

MIT

## Links

- [LTP Protocol Specification](../../specs/)
- [JavaScript SDK](../js/)
- [Python SDK](../python/)

