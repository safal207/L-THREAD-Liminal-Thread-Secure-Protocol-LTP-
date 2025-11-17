# Advanced Elixir LTP Examples

Production-ready Elixir examples demonstrating advanced patterns and best practices for the LTP Elixir SDK.

## Examples

### 1. Production Client (`production_client.exs`)

A production-ready client wrapper with:
- **GenServer-based**: Leverages BEAM's process model
- **Metrics collection**: Track messages, errors, uptime
- **Batch operations**: Efficient batch sending
- **Structured logging**: Integration with Elixir Logger
- **Error handling**: Comprehensive error tracking

**Usage:**
```bash
cd examples/elixir-advanced
elixir production_client.exs
```

**Features:**
- GenServer-based architecture
- Metrics collection and reporting
- Batch state update sending
- Large affect log batches
- Production-grade logging

### 2. Supervised Client (`supervised_client.exs`)

Demonstrates supervision tree pattern:
- **Supervision tree**: Automatic restart on failure
- **Process monitoring**: Monitor child processes
- **Graceful shutdown**: Clean shutdown of supervision tree
- **Restart strategies**: Configurable restart policies

**Usage:**
```bash
cd examples/elixir-advanced
elixir supervised_client.exs
```

**Features:**
- Supervisor integration
- Process monitoring
- Automatic restart
- Graceful shutdown

## Running Examples

1. **Start an LTP server** (see `examples/js-minimal-server`):
   ```bash
   cd examples/js-minimal-server
   npm install
   node index.js
   ```

2. **Run an example**:
   ```bash
   cd examples/elixir-advanced
   elixir production_client.exs
   # or
   elixir supervised_client.exs
   ```

## Best Practices Demonstrated

### GenServer Pattern
- Use GenServer for stateful clients
- Proper init/1, handle_call/3, handle_info/2 callbacks
- Clean state management

### Supervision
- Use Supervisor for process management
- Configure restart strategies
- Monitor child processes

### Error Handling
- Use try/rescue for error handling
- Log errors with context
- Track error metrics

### Logging
- Use Elixir Logger module
- Include structured metadata
- Set appropriate log levels

## Integration Patterns

### With Phoenix/Web Applications
```elixir
defmodule MyApp.Application do
  use Application

  def start(_type, _args) do
    children = [
      {ProductionLtpClient, [
        url: System.get_env("LTP_URL"),
        client_id: System.get_env("LTP_CLIENT_ID")
      ]}
    ]

    Supervisor.start_link(children, strategy: :one_for_one)
  end
end
```

### With GenStage/Flow
```elixir
defmodule LtpProducer do
  use GenStage

  def init(opts) do
    {:ok, client_pid} = ProductionLtpClient.start_link(opts)
    {:producer, client_pid}
  end

  def handle_demand(demand, client_pid) do
    events = fetch_events(client_pid, demand)
    {:noreply, events, client_pid}
  end
end
```

### With OTP Applications
```elixir
# In mix.exs
def application do
  [
    mod: {MyApp.Application, []},
    extra_applications: [:logger]
  ]
end

# In lib/my_app/application.ex
defmodule MyApp.Application do
  use Application

  def start(_type, _args) do
    children = [
      {ProductionLtpClient, client_opts()}
    ]

    Supervisor.start_link(children, strategy: :one_for_one)
  end
end
```

## Next Steps

- Add custom storage backends
- Integrate with monitoring systems (Telemetry, Prometheus)
- Implement custom reconnection strategies
- Add authentication/authorization

