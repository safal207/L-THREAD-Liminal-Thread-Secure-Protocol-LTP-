# Advanced Python LTP Examples

Production-ready Python examples demonstrating advanced patterns and best practices for the LTP Python SDK.

## Examples

### 1. Production Client (`production_client.py`)

A production-ready client wrapper with:
- **Structured logging**: Integration with Python's logging module
- **Metrics collection**: Track messages, errors, uptime
- **Batch operations**: Efficient batch sending
- **Error handling**: Comprehensive error tracking and recovery
- **Graceful shutdown**: Clean disconnection with metrics

**Usage:**
```bash
cd examples/python-advanced
python production_client.py
```

**Features:**
- Metrics collection and reporting
- Batch state update sending
- Large affect log batches
- Production-grade logging
- Error tracking

### 2. Async Worker (`async_worker.py`)

Demonstrates async worker pool pattern:
- **Worker pool**: Multiple concurrent workers processing tasks
- **Task queue**: Async queue for task distribution
- **Concurrent operations**: Handle multiple operations simultaneously
- **Error handling**: Per-task error handling

**Usage:**
```bash
cd examples/python-advanced
python async_worker.py
```

**Features:**
- Async/await patterns
- Worker pool implementation
- Task queue management
- Concurrent message sending
- Callback support

## Running Examples

1. **Start an LTP server** (see `examples/js-minimal-server` or create Python server):
   ```bash
   # Use JS server for now
   cd examples/js-minimal-server
   npm install
   node index.js
   ```

2. **Run an example**:
   ```bash
   cd examples/python-advanced
   python production_client.py
   # or
   python async_worker.py
   ```

## Best Practices Demonstrated

### Async/Await
- Use `async`/`await` for all I/O operations
- Properly handle exceptions in async contexts
- Use `asyncio.gather()` for concurrent operations

### Logging
- Use Python's `logging` module
- Include structured metadata
- Set appropriate log levels

### Error Handling
- Wrap async operations in try-except
- Track errors in metrics
- Implement retry logic where appropriate

### Resource Management
- Use context managers where possible
- Clean up resources in finally blocks
- Graceful shutdown of async tasks

## Integration Patterns

### With asyncio
```python
async def process_messages():
    client = ProductionLtpClient(url)
    await client.connect()
    
    # Process messages concurrently
    tasks = [
        client.send_state_update(update)
        for update in updates
    ]
    await asyncio.gather(*tasks)
```

### With FastAPI/Web Frameworks
```python
from fastapi import FastAPI
from production_client import ProductionLtpClient

app = FastAPI()
ltp_client = None

@app.on_event("startup")
async def startup():
    global ltp_client
    ltp_client = ProductionLtpClient(url)
    await ltp_client.connect()

@app.post("/events")
async def send_event(event: dict):
    await ltp_client.send_state_update(event)
```

### With Message Queues
```python
import asyncio
from async_worker import AsyncLtpWorker

async def process_queue():
    worker = AsyncLtpWorker(url, client_id, worker_id)
    await worker.start()
    
    # Subscribe to queue and submit tasks
    async for message in queue.subscribe():
        await worker.submit_task('state_update', message.payload)
```

## Next Steps

- Add custom storage backends
- Integrate with monitoring systems (Prometheus, Datadog)
- Implement custom reconnection strategies
- Add authentication/authorization

