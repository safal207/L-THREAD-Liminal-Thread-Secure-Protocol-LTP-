import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Types (simplified from tools/ltp-inspect/types.ts)
interface LtpFrame {
  v: string;
  id: string;
  type: string;
  ts: string;
  continuity_token?: string;
  payload?: any;
}

interface TraceEntry {
  i: number;
  ts: string;
  direction: 'in' | 'out';
  session_id: string;
  frame: LtpFrame;
  prev_hash: string;
  hash: string;
  signature?: string;
  key_id?: string;
  alg?: string;
}

const DETERMINISTIC_TS = '2024-01-01T00:00:00.000Z';
const SESSION_ID = 'sess-agent-demo-01';

// Helpers
function canonicalize(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  const sorted: Record<string, any> = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = canonicalize(obj[key]);
    });
  return sorted;
}

function canonicalJsonBytes(frame: any): Buffer {
  const canon = canonicalize(frame);
  return Buffer.from(JSON.stringify(canon), 'utf8');
}

function createEntry(
  index: number,
  frame: LtpFrame,
  prevHash: string,
  direction: 'in' | 'out' = 'out'
): TraceEntry {
  const frameBytes = canonicalJsonBytes(frame);
  const hasher = crypto.createHash('sha256');
  hasher.update(prevHash);
  hasher.update(frameBytes);
  const hash = hasher.digest('hex');

  return {
    i: index,
    ts: frame.ts,
    direction,
    session_id: SESSION_ID,
    frame,
    prev_hash: prevHash,
    hash,
    // Demo signature (not real, but present to pass "presence" checks if any)
    signature: 'sig_demo_' + hash.substring(0, 8),
    key_id: 'key_demo_01',
    alg: 'ed25519'
  };
}

function generateTrace(frames: LtpFrame[], outputPath: string) {
  let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
  const entries: TraceEntry[] = [];

  frames.forEach((frame, idx) => {
    // Alternate direction for realism (Request=in, Response=out)
    const direction = frame.type === 'route_request' ? 'in' : 'out';
    const entry = createEntry(idx, frame, prevHash, direction);
    entries.push(entry);
    prevHash = entry.hash;
  });

  // Join with newlines and add a trailing newline
  const content = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`Generated ${outputPath}`);
}

// Scenarios

// 1. Unsafe Agent (Allowed Critical): WEB context requests critical action, allowed without capability check -> FAIL
const allowedCriticalFrames: LtpFrame[] = [
  { v: '0.1', id: '1', ts: DETERMINISTIC_TS, type: 'hello', payload: { agent: 'unsafe-demo-agent' } },
  { v: '0.1', id: '2', ts: DETERMINISTIC_TS, type: 'orientation', continuity_token: 'ct-1', payload: { drift: 0.0, identity: 'web-visitor', status: 'healthy' } },
  { v: '0.1', id: '3', ts: DETERMINISTIC_TS, type: 'route_request', payload: { goal: 'execute remote code', params: { cmd: 'rm -rf /' } } },
  {
    v: '0.1', id: '4', ts: DETERMINISTIC_TS, type: 'route_response',
    payload: {
      context: 'WEB',
      targetState: 'execute_code',
      admissible: true,
      branches: [
        { id: 'b1', confidence: 0.9, status: 'admissible', reason: 'User asked nicely' }
      ]
    }
  }
];

// 2. Safe Agent (Blocked Critical): WEB context requests critical action, BLOCKED -> PASS
const blockedCriticalFrames: LtpFrame[] = [
  { v: '0.1', id: '1', ts: DETERMINISTIC_TS, type: 'hello', payload: { agent: 'safe-demo-agent' } },
  { v: '0.1', id: '2', ts: DETERMINISTIC_TS, type: 'orientation', continuity_token: 'ct-1', payload: { drift: 0.0, identity: 'web-visitor', status: 'healthy' } },
  { v: '0.1', id: '3', ts: DETERMINISTIC_TS, type: 'route_request', payload: { goal: 'execute remote code' } },
  {
    v: '0.1', id: '4', ts: DETERMINISTIC_TS, type: 'route_response',
    payload: {
      context: 'WEB',
      targetState: 'execute_code',
      admissible: false,
      branches: [
        { id: 'b1', confidence: 0.0, status: 'blocked', reason: 'WEB_ORIGIN_FORBIDDEN_FOR_CRITICAL_ACTION' }
      ]
    }
  }
];

// Execute
const agentsDir = path.join(process.cwd(), 'examples', 'agents');
if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });

// Using new naming convention and extension
generateTrace(allowedCriticalFrames, path.join(agentsDir, 'allowed-critical.trace.jsonl'));
generateTrace(blockedCriticalFrames, path.join(agentsDir, 'blocked-critical.trace.jsonl'));
