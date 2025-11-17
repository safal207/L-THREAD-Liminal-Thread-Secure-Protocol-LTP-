# LTP Elixir Server Example

Example LTP server implementation in Elixir using WebSockex and GenServer.

## Features

- Handshake init/resume support
- Thread and session management
- Ping/pong heartbeat handling
- State update and event processing
- TOON payload preview

## Running

```bash
cd examples/elixir-server
mix deps.get
mix run --no-halt
```

Server will start on `ws://localhost:8080`

## Usage

Connect with any LTP client:

```elixir
# Using Elixir client
{:ok, pid} = LTP.Client.start_link(%{
  url: "ws://localhost:8080",
  client_id: "test-client"
})
```

