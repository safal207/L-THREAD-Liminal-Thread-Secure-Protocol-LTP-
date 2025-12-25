const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Canonicalize JSON (sort keys)
function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = canonicalize(obj[key]);
    });
  return sorted;
}

function canonicalJsonBytes(frame) {
  const canon = canonicalize(frame);
  return Buffer.from(JSON.stringify(canon), 'utf8');
}

const frames = [
  {
    v: "0.1",
    type: "hello",
    ts: "2024-03-15T14:00:00.000Z"
  },
  {
    v: "0.1",
    type: "orientation",
    ts: "2024-03-15T14:00:01.000Z",
    payload: {
      status: "HEALTHY",
      drift: 0.01
    }
  },
  {
    v: "0.1",
    type: "route_request",
    ts: "2024-03-15T14:00:02.000Z",
    payload: {
      intent: "transfer_funds",
      amount: 100
    }
  },
  {
    v: "0.1",
    type: "route_response",
    ts: "2024-03-15T14:00:03.000Z",
    payload: {
      decision: "EXECUTE",
      admissible: true,
      branches: [{id: "execute", confidence: 1.0}]
    }
  },
  {
    v: "0.1",
    type: "orientation",
    ts: "2024-03-15T14:00:04.000Z",
    payload: {
      status: "FAILED",
      error: "db_connection_lost"
    }
  },
  {
    v: "0.1",
    type: "route_request",
    ts: "2024-03-15T14:00:05.000Z",
    payload: {
      intent: "transfer_funds",
      amount: 500
    }
  },
  {
    v: "0.1",
    type: "route_response",
    ts: "2024-03-15T14:00:06.000Z",
    payload: {
      decision: "DEFER",
      admissible: false,
      reason: "system_state_failed",
      branches: [{id: "defer", confidence: 1.0}]
    }
  },
  {
    v: "0.1",
    type: "orientation",
    ts: "2024-03-15T14:00:07.000Z",
    payload: {
      status: "UNSTABLE"
    }
  },
  {
    v: "0.1",
    type: "orientation",
    ts: "2024-03-15T14:00:08.000Z",
    payload: {
      status: "HEALTHY",
      identity: "recovery-test-agent"
    }
  }
];

const entries = [];
let prevHash = "0000000000000000000000000000000000000000000000000000000000000000";

// Rule-based direction assignment
function getDirection(type) {
  switch (type) {
    case 'hello':
    case 'orientation':
    case 'route_request':
      return 'out';
    case 'route_response':
      return 'in';
    default:
      return 'out';
  }
}

frames.forEach((frame, i) => {
  const frameBytes = canonicalJsonBytes(frame);
  const hasher = crypto.createHash('sha256');
  hasher.update(prevHash);
  hasher.update(frameBytes);
  const hash = hasher.digest('hex');

  entries.push({
    i: i,
    timestamp_ms: new Date(frame.ts).getTime(),
    direction: getDirection(frame.type),
    session_id: "rec-123",
    frame: frame,
    prev_hash: prevHash,
    hash: hash
  });

  prevHash = hash;
});

const outputPath = process.argv[2] || path.join(__dirname, '..', 'examples', 'traces', 'failure-recovery.trace.jsonl');
const jsonlContent = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
fs.writeFileSync(outputPath, jsonlContent);
console.log(`Generated trace at ${outputPath}`);
