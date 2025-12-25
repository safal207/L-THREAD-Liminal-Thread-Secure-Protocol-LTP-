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
    type: "hello",
    version: "0.1",
    ts: "2024-03-15T14:00:00.000Z"
  },
  {
    type: "orientation",
    ts: "2024-03-15T14:00:01.000Z",
    payload: {
      status: "stable",
      drift: 0.01
    }
  },
  {
    type: "route_request",
    ts: "2024-03-15T14:00:02.000Z",
    payload: {
      intent: "transfer_funds",
      amount: 100
    }
  },
  {
    type: "route_response",
    ts: "2024-03-15T14:00:03.000Z",
    payload: {
      decision: "EXECUTE",
      admissible: true
    }
  },
  {
    type: "orientation",
    ts: "2024-03-15T14:00:04.000Z",
    payload: {
      status: "failed",
      error: "db_connection_lost"
    }
  },
  {
    type: "route_request",
    ts: "2024-03-15T14:00:05.000Z",
    payload: {
      intent: "transfer_funds",
      amount: 500
    }
  },
  {
    type: "route_response",
    ts: "2024-03-15T14:00:06.000Z",
    payload: {
      decision: "DEFER",
      admissible: false,
      reason: "system_state_failed"
    }
  },
  {
    type: "orientation",
    ts: "2024-03-15T14:00:07.000Z",
    payload: {
      status: "recovering"
    }
  },
  {
    type: "orientation",
    ts: "2024-03-15T14:00:08.000Z",
    payload: {
      status: "stable"
    }
  }
];

const entries = [];
let prevHash = "0000000000000000000000000000000000000000000000000000000000000000";

frames.forEach((frame, i) => {
  const frameBytes = canonicalJsonBytes(frame);
  const hasher = crypto.createHash('sha256');
  hasher.update(prevHash);
  hasher.update(frameBytes);
  const hash = hasher.digest('hex');

  entries.push({
    i: i,
    timestamp_ms: new Date(frame.ts).getTime(),
    direction: i % 2 === 0 ? "in" : "out", // Simplistic direction assignment
    session_id: "rec-123",
    frame: frame,
    prev_hash: prevHash,
    hash: hash
  });

  prevHash = hash;
});

const outputPath = process.argv[2] || path.join(__dirname, '..', 'examples', 'traces', 'failure-recovery.trace.json');
fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2) + '\n'); // Ensure newline
console.log(`Generated trace at ${outputPath}`);
