/**
 * LTP Throughput Benchmark
 * 
 * Measures message sending throughput for different scenarios
 */

const { LtpClient } = require('../../sdk/js/dist/index');

class ThroughputBenchmark {
  constructor(url, clientId) {
    this.url = url;
    this.clientId = clientId;
    this.client = null;
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      startTime: null,
      endTime: null,
      errors: 0,
    };
  }

  async connect() {
    this.client = new LtpClient(this.url, {
      clientId: this.clientId,
    }, {
      onConnected: () => {
        console.log('✓ Connected to LTP server');
      },
      onError: (error) => {
        this.metrics.errors++;
        console.error('Error:', error.error_message);
      },
      onStateUpdate: () => {
        this.metrics.messagesReceived++;
      },
    });

    await this.client.connect();
  }

  async benchmarkSequential(count) {
    console.log(`\n--- Sequential sending: ${count} messages ---`);
    this.metrics.messagesSent = 0;
    this.metrics.startTime = performance.now();

    for (let i = 0; i < count; i++) {
      try {
        await this.client.sendStateUpdate({
          kind: 'benchmark',
          data: { index: i, timestamp: Date.now() },
        });
        this.metrics.messagesSent++;
      } catch (error) {
        this.metrics.errors++;
      }
    }

    this.metrics.endTime = performance.now();
    this.reportMetrics('Sequential');
  }

  async benchmarkBatch(count, batchSize) {
    console.log(`\n--- Batch sending: ${count} messages in batches of ${batchSize} ---`);
    this.metrics.messagesSent = 0;
    this.metrics.startTime = performance.now();

    for (let i = 0; i < count; i += batchSize) {
      const batch = Array.from({ length: Math.min(batchSize, count - i) }, (_, j) => ({
        kind: 'benchmark',
        data: { index: i + j, timestamp: Date.now() },
      }));

      const promises = batch.map(update => 
        this.client.sendStateUpdate(update).catch(() => {
          this.metrics.errors++;
        })
      );

      await Promise.all(promises);
      this.metrics.messagesSent += batch.length;
    }

    this.metrics.endTime = performance.now();
    this.reportMetrics('Batch');
  }

  async benchmarkLargePayload(size) {
    console.log(`\n--- Large payload: ${size} objects ---`);
    this.metrics.messagesSent = 0;
    this.metrics.startTime = performance.now();

    const largeData = Array.from({ length: size }, (_, i) => ({
      t: i,
      value: Math.random(),
      timestamp: Date.now() + i,
    }));

    try {
      await this.client.sendStateUpdate({
        kind: 'large_payload',
        data: largeData,
      });
      this.metrics.messagesSent = 1;
    } catch (error) {
      this.metrics.errors++;
    }

    this.metrics.endTime = performance.now();
    this.reportMetrics('Large Payload');
  }

  reportMetrics(label) {
    const duration = this.metrics.endTime - this.metrics.startTime;
    const throughput = (this.metrics.messagesSent / (duration / 1000)).toFixed(2);
    const avgLatency = (duration / this.metrics.messagesSent).toFixed(2);

    console.log(`\n${label} Results:`);
    console.log(`  Messages sent: ${this.metrics.messagesSent}`);
    console.log(`  Duration: ${duration.toFixed(2)}ms`);
    console.log(`  Throughput: ${throughput} msg/s`);
    console.log(`  Avg latency: ${avgLatency}ms`);
    console.log(`  Errors: ${this.metrics.errors}`);
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
    }
  }
}

async function main() {
  console.log('=== LTP Throughput Benchmark ===\n');
  console.log('Note: This benchmark requires a running LTP server');
  console.log('Start server: cd examples/js-minimal-server && npm start\n');

  const benchmark = new ThroughputBenchmark(
    'ws://localhost:8080',
    'throughput-benchmark'
  );

  try {
    await benchmark.connect();
    
    // Wait for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Run benchmarks
    await benchmark.benchmarkSequential(100);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await benchmark.benchmarkBatch(100, 10);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await benchmark.benchmarkLargePayload(1000);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await benchmark.disconnect();
    
    console.log('\n=== Benchmark Complete ===');
  } catch (error) {
    console.error('Benchmark failed:', error.message);
    await benchmark.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ThroughputBenchmark };

