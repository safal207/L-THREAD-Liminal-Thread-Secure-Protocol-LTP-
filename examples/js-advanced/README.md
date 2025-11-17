# Advanced JavaScript LTP Examples

This directory contains production-ready examples demonstrating advanced patterns and best practices for using the LTP JavaScript SDK.

## Examples

### 1. Production Client (`production-client.js`)

A production-ready client wrapper that demonstrates:
- **Robust error handling**: Comprehensive error tracking and recovery
- **Structured logging**: Custom logger integration
- **Metrics collection**: Message counts, uptime, error rates
- **Batch operations**: Efficient batch sending with TOON encoding
- **Graceful shutdown**: Clean disconnection with metrics reporting

**Usage:**
```bash
node production-client.js
```

**Features:**
- Automatic reconnection with exponential backoff
- Metrics collection and reporting
- Batch state update sending
- Large affect log batches with TOON encoding
- Production-grade logging

### 2. Event-Driven Architecture (`event-driven.js`)

Demonstrates event-driven patterns with LTP:
- **Event emitter pattern**: Custom event handling system
- **Message routing**: Route messages by type/kind
- **State machine integration**: Example state machine with LTP events
- **Event aggregation**: Collect and process events

**Usage:**
```bash
node event-driven.js
```

**Features:**
- Custom event emitter implementation
- Message routing by payload kind
- State machine integration example
- Event-driven state transitions

## Running Examples

1. **Start an LTP server** (see `examples/js-minimal-server`):
   ```bash
   cd examples/js-minimal-server
   npm install
   node index.js
   ```

2. **Run an example**:
   ```bash
   cd examples/js-advanced
   node production-client.js
   # or
   node event-driven.js
   ```

## Best Practices Demonstrated

### Error Handling
- Always wrap connection attempts in try-catch
- Track error metrics for monitoring
- Implement retry logic with exponential backoff

### Logging
- Use structured logging with metadata
- Include context (thread_id, session_id) in logs
- Log at appropriate levels (debug, info, warn, error)

### Performance
- Use TOON encoding for large arrays of similar objects
- Batch operations when possible
- Monitor message throughput

### Reliability
- Implement graceful shutdown
- Handle reconnection scenarios
- Track connection state

## Integration Patterns

### With Monitoring Systems
```javascript
const client = new ProductionLtpClient(url, {
  logger: {
    info: (msg, meta) => monitoring.log('info', msg, meta),
    error: (msg, meta) => monitoring.log('error', msg, meta),
    // ...
  },
});
```

### With State Management
```javascript
const client = new EventDrivenLtpClient(url);
client.on('state_update:user_activity', (payload) => {
  stateManager.updateUserActivity(payload.data);
});
```

### With Message Queues
```javascript
// Send messages to queue, then process via LTP
queue.subscribe('ltp_messages', async (message) => {
  await client.sendStateUpdate(message.payload);
});
```

## Next Steps

- Add custom codec implementations for your data structures
- Integrate with your monitoring/observability stack
- Implement custom reconnection strategies
- Add authentication/authorization layers

