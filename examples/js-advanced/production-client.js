/**
 * LTP Production-Ready Client Example
 * 
 * Demonstrates:
 * - Robust error handling and reconnection
 * - Structured logging
 * - Metrics collection
 * - Graceful shutdown
 * - Batch operations with TOON
 */

const { LtpClient } = require('../../sdk/js/dist/index');
const { simpleToonCodec } = require('../shared/simpleToonCodec');

class ProductionLtpClient {
  constructor(url, options = {}) {
    this.url = url;
    this.clientId = options.clientId || `prod-client-${Date.now()}`;
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      reconnects: 0,
      startTime: Date.now(),
    };
    
    this.logger = options.logger || {
      info: (msg, meta) => console.log(`[INFO] ${msg}`, meta || ''),
      error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || ''),
      warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta || ''),
      debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta || ''),
    };

    this.client = new LtpClient(url, {
      clientId: this.clientId,
      defaultContextTag: options.defaultContextTag || 'production',
      codec: simpleToonCodec,
      preferredEncoding: options.preferredEncoding || 'toon',
      reconnect: {
        maxRetries: options.maxRetries || 10,
        baseDelayMs: options.baseDelayMs || 1000,
        maxDelayMs: options.maxDelayMs || 60000,
      },
      heartbeat: {
        enabled: true,
        intervalMs: 15000,
        timeoutMs: 45000,
      },
      logger: this.logger,
    }, {
      onConnected: (threadId, sessionId) => {
        this.logger.info('Connected to LTP server', { threadId, sessionId });
        this.metrics.lastConnectTime = Date.now();
      },
      
      onDisconnected: () => {
        this.logger.warn('Disconnected from LTP server');
      },
      
      onError: (error) => {
        this.metrics.errors++;
        this.logger.error('LTP error', {
          code: error.error_code,
          message: error.error_message,
          details: error.details,
        });
      },
      
      onStateUpdate: (payload) => {
        this.metrics.messagesReceived++;
        this.handleStateUpdate(payload);
      },
      
      onEvent: (payload) => {
        this.metrics.messagesReceived++;
        this.handleEvent(payload);
      },
    });
  }

  async connect() {
    try {
      await this.client.connect();
      this.logger.info('Production client initialized', {
        clientId: this.clientId,
        url: this.url,
      });
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Failed to connect', { error: error.message });
      throw error;
    }
  }

  async sendBatchStateUpdates(updates) {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('Updates must be a non-empty array');
    }

    this.logger.debug(`Sending batch of ${updates.length} state updates`);
    
    const results = [];
    for (const update of updates) {
      try {
        await this.client.sendStateUpdate(update);
        this.metrics.messagesSent++;
        results.push({ success: true, update });
      } catch (error) {
        this.metrics.errors++;
        results.push({ success: false, update, error: error.message });
        this.logger.error('Failed to send state update', { error: error.message });
      }
    }

    return results;
  }

  async sendAffectLogBatch(affectLogs) {
    // Large batch of affect logs - perfect for TOON encoding
    this.logger.info(`Sending affect log batch (${affectLogs.length} entries)`);
    
    try {
      await this.client.sendStateUpdate({
        kind: 'affect_log_batch',
        data: affectLogs, // Will be TOON-encoded automatically
      });
      this.metrics.messagesSent++;
      return { success: true };
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Failed to send affect log batch', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  handleStateUpdate(payload) {
    // Custom business logic for handling state updates
    this.logger.debug('Received state update', { kind: payload.kind });
    
    // Example: Process affect logs
    if (payload.kind === 'affect_log_batch') {
      this.processAffectLogs(payload.data);
    }
  }

  handleEvent(payload) {
    // Custom business logic for handling events
    this.logger.debug('Received event', { eventType: payload.event_type });
  }

  processAffectLogs(data) {
    // Decode TOON if needed, or process JSON directly
    const logs = Array.isArray(data) ? data : JSON.parse(data);
    this.logger.info(`Processing ${logs.length} affect log entries`);
    
    // Example: Calculate average valence
    if (logs.length > 0 && logs[0].valence !== undefined) {
      const avgValence = logs.reduce((sum, log) => sum + log.valence, 0) / logs.length;
      this.logger.info('Average valence', { avgValence });
    }
  }

  getMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    return {
      ...this.metrics,
      uptimeMs: uptime,
      uptimeSeconds: Math.floor(uptime / 1000),
      messagesPerSecond: this.metrics.messagesSent / (uptime / 1000),
    };
  }

  async disconnect() {
    this.logger.info('Disconnecting production client');
    const metrics = this.getMetrics();
    this.logger.info('Final metrics', metrics);
    await this.client.disconnect();
  }
}

// Example usage
async function main() {
  const client = new ProductionLtpClient('ws://localhost:8080', {
    clientId: 'prod-example-001',
    defaultContextTag: 'production_monitoring',
    preferredEncoding: 'toon',
  });

  try {
    await client.connect();

    // Send a large batch of affect logs (TOON-encoded)
    const affectLogs = Array.from({ length: 100 }, (_, i) => ({
      t: i + 1,
      valence: Math.sin(i / 10) * 0.5,
      arousal: Math.cos(i / 10) * 0.5,
      timestamp: Date.now() + i * 1000,
    }));

    await client.sendAffectLogBatch(affectLogs);

    // Send multiple state updates
    await client.sendBatchStateUpdates([
      { kind: 'system_status', data: { cpu: 0.5, memory: 0.7 } },
      { kind: 'user_activity', data: { action: 'login', userId: 'user123' } },
      { kind: 'performance_metric', data: { latency: 120, throughput: 1000 } },
    ]);

    // Wait a bit, then show metrics
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const metrics = client.getMetrics();
    console.log('\n=== Production Client Metrics ===');
    console.log(JSON.stringify(metrics, null, 2));

    await client.disconnect();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ProductionLtpClient };

