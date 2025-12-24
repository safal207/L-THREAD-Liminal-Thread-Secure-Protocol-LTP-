const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const frames = [
  // 1. Initial State: STABLE
  {
    id: "f1",
    v: "0.1",
    type: "hello",
    ts: "2024-05-20T14:29:00.000Z",
    payload: { agent: "LTP-Infra-Node", version: "0.1", mode: "infrastructure" }
  },
  {
    id: "f2",
    v: "0.1",
    type: "orientation",
    ts: "2024-05-20T14:29:01.000Z",
    identity: "infra:node-1",
    payload: {
        state: "STABLE",
        drift_level: "low",
        focus_momentum: 1.0,
        resources: { db: "connected", latency: 20 }
    }
  },
  // 2. Normal Action
  {
    id: "f3",
    v: "0.1",
    type: "route_request",
    ts: "2024-05-20T14:29:05.000Z",
    payload: { action: "place_order", id: "req-100", amount: 50.00 }
  },
  {
    id: "f4",
    v: "0.1",
    type: "route_response",
    ts: "2024-05-20T14:29:06.000Z",
    payload: {
      admissible: true,
      decision: "EXECUTE",
      reason: "OK",
      branches: [
        { id: "primary", confidence: 1.0, status: "admissible", path: "db_write" }
      ]
    }
  },
  // 3. Degradation Event (DB Flicker)
  {
    id: "f5",
    v: "0.1",
    type: "orientation",
    ts: "2024-05-20T14:30:05.000Z",
    payload: {
        state: "UNSTABLE",
        drift_level: "high",
        reason: "DB Connection Timeout",
        resources: { db: "disconnected", latency: 5000 }
    }
  },
  // 4. Action during Instability (Deferred)
  {
    id: "f6",
    v: "0.1",
    type: "route_request",
    ts: "2024-05-20T14:30:10.000Z",
    payload: { action: "place_order", id: "req-101", amount: 120.00 }
  },
  {
    id: "f7",
    v: "0.1",
    type: "route_response",
    ts: "2024-05-20T14:30:11.000Z",
    payload: {
      admissible: false,
      decision: "DEFER",
      reason: "SYSTEM_UNSTABLE",
      retry_condition: "state == STABLE",
      branches: [
         { id: "deferred", confidence: 1.0, status: "deferred", reason: "Infrastructure unstable" }
      ]
    }
  },
  // 5. Recovery
  {
    id: "f8",
    v: "0.1",
    type: "orientation",
    ts: "2024-05-20T14:31:00.000Z",
    payload: {
        state: "RECOVERING",
        drift_level: "medium",
        reason: "DB Connection Restored",
        resources: { db: "reconnecting", latency: 100 }
    }
  },
  // 6. Replay of Deferred Action
  {
    id: "f9",
    v: "0.1",
    type: "route_request",
    ts: "2024-05-20T14:31:05.000Z",
    payload: {
        action: "place_order",
        id: "req-101",
        amount: 120.00,
        replay_context: { original_frame_id: "f6", deferred_reason: "SYSTEM_UNSTABLE" }
    }
  },
  {
    id: "f10",
    v: "0.1",
    type: "route_response",
    ts: "2024-05-20T14:31:06.000Z",
    payload: {
      admissible: true,
      decision: "EXECUTE",
      reason: "RECOVERY_CONFIRMED",
      branches: [
        { id: "primary", confidence: 1.0, status: "admissible", path: "db_write_replay" }
      ]
    }
  },
  // 7. Back to Stable
  {
    id: "f11",
    v: "0.1",
    type: "orientation",
    ts: "2024-05-20T14:32:00.000Z",
    payload: {
        state: "STABLE",
        drift_level: "low",
        resources: { db: "connected", latency: 15 }
    }
  },
  {
      id: "f12",
      v: "0.1",
      type: "focus_snapshot",
      ts: "2024-05-20T14:32:01.000Z",
      payload: { drift: 0.01, note: "Recovery complete" }
  }
];

function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  const sorted = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = canonicalize(obj[key]);
  });
  return sorted;
}

function generateAuditLog() {
  const entries = [];
  let prevHash = "0".repeat(64);

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const entry = {
      i: i,
      ts: new Date(frame.ts).getTime(),
      direction: frame.type.includes('response') || frame.type === 'orientation' || frame.type === 'focus_snapshot' ? 'out' : 'in',
      session_id: "infra-recovery-session-1",
      frame: frame,
      prev_hash: prevHash,
      signature: "simulated_sig_" + i,
      key_id: "infra-key-1",
      alg: "ed25519"
    };

    const frameBytes = Buffer.from(JSON.stringify(canonicalize(frame)), 'utf8');
    const hasher = crypto.createHash('sha256');
    hasher.update(prevHash);
    hasher.update(frameBytes);
    const hash = hasher.digest('hex');

    entry.hash = hash;
    entries.push(entry);
    prevHash = hash;
  }

  return entries;
}

const log = generateAuditLog();
const jsonl = log.map(e => JSON.stringify(e)).join('\n');

const dir = 'examples/traces';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

const outFile = path.join(dir, 'failure-recovery.trace.json');
fs.writeFileSync(outFile, jsonl);
console.log(`Generated ${outFile}`);
