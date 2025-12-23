const fs = require('fs');
const crypto = require('crypto');

const frames = [
  {
    id: "f1",
    type: "hello",
    ts: "2023-01-01T12:00:00Z",
    payload: { agent: "LTP-Demo", version: "0.1" }
  },
  {
    id: "f2",
    type: "orientation",
    ts: "2023-01-01T12:00:01Z",
    identity: "user:123",
    payload: { drift_level: "low", focus_momentum: 0.95 }
  },
  {
    id: "f3",
    type: "route_request",
    ts: "2023-01-01T12:00:02Z",
    payload: { target: "checkout" }
  },
  {
    id: "f4",
    type: "route_response",
    ts: "2023-01-01T12:00:03Z",
    payload: {
      branches: [
        { id: "b1", confidence: 0.9, status: "admissible", reason: "standard flow" },
        { id: "b2", confidence: 0.1, status: "degraded", reason: "high load" }
      ]
    }
  },
  {
    id: "f5",
    type: "focus_snapshot",
    ts: "2023-01-01T12:00:04Z",
    payload: { drift: 0.05, notes: ["stable"] }
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
  // Initial hash is 64 zeros as per LTP spec for first entry if no prior history
  let prevHash = "0".repeat(64);

  for (const frame of frames) {
    const entry = {
      ts: frame.ts,
      frame: frame,
      prev_hash: prevHash,
      // Signatures would go here, simulated for now
      signature: "simulated_sig_" + Math.random().toString(36).substring(7),
      key_id: "key-1",
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

const dir = 'artifacts/traces/fintech';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(`${dir}/golden.auditlog.jsonl`, jsonl);
console.log(`Generated ${dir}/golden.auditlog.jsonl`);
