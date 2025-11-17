# LTP Performance Benchmarks

This directory contains performance benchmarks for the LTP SDKs, comparing different encoding strategies, throughput, and latency characteristics.

## Available Benchmarks

### JavaScript Benchmarks

#### JSON vs TOON (`js/json-vs-toon.js`)

Compares payload sizes and encoding/decoding performance for JSON vs TOON encoding of large arrays.

**What it measures:**
- Payload size reduction (bytes)
- Encoding performance (ms)
- Decoding performance (ms)

**Usage:**
```bash
cd benchmarks/js
node json-vs-toon.js
```

**Expected results:**
- TOON provides 30-60% size reduction for large arrays
- Encoding performance varies by array size
- JSON decoding is faster (TOON decode not fully implemented in stub codec)

#### Throughput (`js/throughput.js`)

Measures message sending throughput for different scenarios.

**What it measures:**
- Sequential message sending throughput
- Batch message sending throughput
- Large payload handling

**Usage:**
```bash
# Terminal 1: Start LTP server
cd examples/js-minimal-server
npm start

# Terminal 2: Run benchmark
cd benchmarks/js
node throughput.js
```

**Expected results:**
- Throughput in messages per second
- Average latency per message
- Error rates

### Python Benchmarks

#### JSON vs TOON (`python/json_vs_toon.py`)

Python version of the JSON vs TOON comparison benchmark.

**Usage:**
```bash
cd benchmarks/python
python json_vs_toon.py
```

## Benchmark Results Interpretation

### Size Reduction

TOON encoding is most effective for:
- **Large arrays** (100+ items) of similar objects
- **Repetitive data** (affect logs, event batches, telemetry)
- **LLM-centric workflows** where token count matters

### Performance Considerations

- **Encoding**: TOON encoding may be slightly slower than JSON for small arrays, but provides significant size savings for large arrays
- **Decoding**: JSON decoding is typically faster (TOON decode requires parsing)
- **Network**: Smaller payloads reduce bandwidth usage and improve transmission time

### When to Use TOON

✅ **Use TOON when:**
- Sending large arrays of similar objects (100+ items)
- Token count matters (LLM prompts, API limits)
- Bandwidth is a concern
- Data is table-like (affect logs, event batches)

❌ **Use JSON when:**
- Small payloads (< 100 items)
- Complex nested structures
- Decoding performance is critical
- Human readability is required

## Running All Benchmarks

### JavaScript

```bash
# JSON vs TOON (no server required)
cd benchmarks/js
node json-vs-toon.js

# Throughput (requires server)
# Terminal 1:
cd examples/js-minimal-server && npm start

# Terminal 2:
cd benchmarks/js && node throughput.js
```

### Python

```bash
cd benchmarks/python
python json_vs_toon.py
```

## Contributing Benchmarks

To add new benchmarks:

1. Create benchmark file in appropriate language directory
2. Follow existing patterns:
   - Use consistent naming (`benchmark-name.js/py/rs/exs`)
   - Include warmup phase
   - Report clear metrics
   - Document expected results

3. Update this README with:
   - Description of what it measures
   - Usage instructions
   - Expected results

## Future Benchmarks

Planned benchmarks:
- [ ] Cross-language SDK comparison
- [ ] Memory usage benchmarks
- [ ] Concurrent connection benchmarks
- [ ] Reconnection performance
- [ ] Heartbeat overhead
- [ ] Large-scale stress tests

## Notes

- Benchmarks use stub TOON codec implementations (not production-ready)
- Results may vary based on hardware and runtime environment
- For production decisions, run benchmarks on target infrastructure
- Consider both size reduction and encoding/decoding performance

