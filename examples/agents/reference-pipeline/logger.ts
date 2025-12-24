
import * as crypto from 'crypto';

export interface LogEntry {
  traceId: string;
  type: 'EVENT' | 'PROPOSAL' | 'CHECK' | 'ACTION';
  timestamp: number;
  payload: any;
  previousHash: string;
  hash: string;
}

export class HashChainLogger {
  private log: LogEntry[] = [];

  getLastHash(): string {
    if (this.log.length === 0) return '0000000000000000000000000000000000000000000000000000000000000000'; // Genesis
    return this.log[this.log.length - 1].hash;
  }

  append(type: LogEntry['type'], payload: any, traceId: string) {
    const previousHash = this.getLastHash();
    const timestamp = Date.now();

    // Canonicalize payload for hashing (simple version)
    const payloadStr = JSON.stringify(payload);

    const dataToHash = `${previousHash}|${timestamp}|${type}|${traceId}|${payloadStr}`;
    const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

    const entry: LogEntry = {
      traceId,
      type,
      timestamp,
      payload,
      previousHash,
      hash
    };

    this.log.push(entry);
    // console.log(`[LOG] ${type} appended. Hash: ${hash.substring(0, 8)}...`);
  }

  getLog() {
    return this.log;
  }

  verifyIntegrity(): boolean {
    let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
    for (const entry of this.log) {
      if (entry.previousHash !== prevHash) return false;
      const payloadStr = JSON.stringify(entry.payload);
      const dataToHash = `${prevHash}|${entry.timestamp}|${entry.type}|${entry.traceId}|${payloadStr}`;
      const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');
      if (hash !== entry.hash) return false;
      prevHash = hash;
    }
    return true;
  }

  hasProcessed(traceId: string): boolean {
    return this.log.some(e => e.traceId === traceId && e.type === 'ACTION'); // Simple replay check
  }
}
