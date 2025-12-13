import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { HeartbeatPayload, RouteResponsePayload, isLTPFrame, LTPFrame } from '../frames/frameSchema';

export interface SelfTestReport {
  ok: boolean;
  level: 'LTP-Core' | 'LTP-Flow' | 'LTP-Canonical';
  receivedFrames: number;
  processedFrames: number;
  emittedFrames: number;
  branchesCount: number;
  dedupedFrames: number;
  errors: string[];
  determinismHash: string;
  mode: SelfTestMode;
}

export interface SelfTestOptions {
  frames?: unknown[];
  mode?: SelfTestMode;
}

export type SelfTestMode = 'calm' | 'storm' | 'recovery';

interface FlowState {
  helloSeen: boolean;
  heartbeatSeqs: number[];
  orientationSeen: boolean;
  routeRequested: boolean;
  routeResponseBranches: number;
  emittedFrames: number;
  focusSnapshotSeen: boolean;
  processed: number;
  deduped: number;
  errors: string[];
}

const knownTypes: LTPFrame['type'][] = [
  'hello',
  'heartbeat',
  'orientation',
  'route_request',
  'route_response',
  'focus_snapshot',
];

const isKnownType = (value: unknown): value is LTPFrame['type'] =>
  typeof value === 'string' && knownTypes.includes(value as LTPFrame['type']);

const createInitialState = (): FlowState => ({
  helloSeen: false,
  heartbeatSeqs: [],
  orientationSeen: false,
  routeRequested: false,
  routeResponseBranches: 0,
  emittedFrames: 0,
  focusSnapshotSeen: false,
  processed: 0,
  deduped: 0,
  errors: [],
});

const CANONICAL_VECTOR_FILENAME = 'self-test-canonical.v0.1.json';

const inlineCanonicalFrames: unknown[] = [
  {
    v: '0.1',
    id: 'f-hello',
    ts: 1,
    type: 'hello',
    payload: { role: 'client', message: 'ltp-self-test' },
  },
  {
    v: '0.1',
    id: 'f-heartbeat-1',
    ts: 2,
    type: 'heartbeat',
    payload: { seq: 1, status: 'ok' },
  },
  {
    v: '0.1',
    id: 'f-heartbeat-2',
    ts: 3,
    type: 'heartbeat',
    payload: { seq: 2, status: 'ok' },
  },
  {
    v: '0.1',
    id: 'f-heartbeat-3',
    ts: 4,
    type: 'heartbeat',
    payload: { seq: 3, status: 'steady' },
  },
  {
    v: '0.1',
    id: 'f-orientation',
    ts: 5,
    type: 'orientation',
    payload: { origin: 'node-A', destination: 'node-B', mode: 'survey' },
  },
  {
    v: '0.1',
    id: 'f-route-request',
    ts: 6,
    type: 'route_request',
    payload: { goal: 'reach-destination', context: ['safety', 'speed'] },
  },
  {
    v: '0.1',
    id: 'f-route-response',
    ts: 7,
    type: 'route_response',
    payload: {
      branches: {
        primary: { path: ['alpha', 'beta'], confidence: 0.8, rationale: 'fastest' },
        recover: { path: ['alpha', 'gamma'], confidence: 0.55, rationale: 'fallback' },
        explore: { path: ['delta'], confidence: 0.35, rationale: 'discover' },
      },
      selection: 'primary',
    },
  },
  {
    v: '0.1',
    id: 'f-focus',
    ts: 8,
    type: 'focus_snapshot',
    payload: { focus: 'navigation', signal: 0.92, rationale: 'post-route' },
  },
  {
    v: '0.1',
    id: 'f-unknown',
    ts: 9,
    type: 'unknown_frame',
    payload: { note: 'ignored' },
  },
  {
    v: '0.1',
    id: 'f-heartbeat-2',
    ts: 10,
    type: 'heartbeat',
    payload: { seq: 2, status: 'duplicate' },
  },
];

const readJsonVectors = (): unknown[] | undefined => {
  const vectorPath = path.resolve(__dirname, '../../specs/vectors', CANONICAL_VECTOR_FILENAME);
  if (!fs.existsSync(vectorPath)) {
    return undefined;
  }

  try {
    const raw = fs.readFileSync(vectorPath, 'utf-8');
    const parsed = JSON.parse(raw) as { frames?: unknown };
    return Array.isArray(parsed.frames) ? parsed.frames : undefined;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to load canonical vectors from ${vectorPath}:`, error);
    return undefined;
  }
};

export const buildCanonicalSelfTestFrames = (): unknown[] => {
  const framesFromDisk = readJsonVectors();
  return framesFromDisk ?? inlineCanonicalFrames;
};

const cloneFrames = (frames: unknown[]): unknown[] => JSON.parse(JSON.stringify(frames));

const applyStormMode = (frames: unknown[]): unknown[] => {
  const augmented = cloneFrames(frames);

  return [
    ...augmented.map((frame) => {
      if (typeof frame !== 'object' || frame === null) return frame;
      const typed = frame as { type?: unknown; payload?: any };
      if (typed.type === 'heartbeat' && typed.payload?.status === 'ok') {
        return { ...typed, payload: { ...typed.payload, status: 'storm_warning' } };
      }
      if (typed.type === 'route_response') {
        return {
          ...typed,
          payload: {
            ...typed.payload,
            selection: 'recover',
            branches: {
              ...(typed.payload?.branches ?? {}),
              stabilize: { path: ['omega'], confidence: 0.48, rationale: 'storm-route' },
            },
          },
        };
      }
      return typed;
    }),
    {
      v: '0.1',
      id: 'f-heartbeat-4',
      ts: 11,
      type: 'heartbeat',
      payload: { seq: 4, status: 'stabilizing' },
    },
  ];
};

const applyRecoveryMode = (frames: unknown[]): unknown[] =>
  cloneFrames(frames).map((frame) => {
    if (typeof frame !== 'object' || frame === null) return frame;
    const typed = frame as { type?: unknown; payload?: any };
    if (typed.type === 'orientation') {
      return {
        ...typed,
        payload: {
          ...typed.payload,
          mode: 'recovery',
          checkpoint: 'stabilize',
        },
      };
    }
    if (typed.type === 'focus_snapshot') {
      return { ...typed, payload: { ...typed.payload, signal: 0.82, rationale: 'recovery-lock' } };
    }
    if (typed.type === 'route_response') {
      return {
        ...typed,
        payload: {
          ...typed.payload,
          selection: 'recover',
        },
      };
    }
    return typed;
  });

export const resolveSelfTestMode = (value?: string | null): SelfTestMode => {
  if (value === 'storm' || value === 'recovery' || value === 'calm') {
    return value;
  }
  return 'calm';
};

export const buildSelfTestFramesForMode = (mode: SelfTestMode = 'calm'): unknown[] => {
  const canonical = buildCanonicalSelfTestFrames();
  if (mode === 'storm') {
    return applyStormMode(canonical);
  }
  if (mode === 'recovery') {
    return applyRecoveryMode(canonical);
  }
  return cloneFrames(canonical);
};

const validateHeartbeatOrder = (
  state: FlowState,
  frame: LTPFrame & { type: 'heartbeat'; payload: HeartbeatPayload },
  index: number
): void => {
  if (!state.helloSeen) {
    state.errors.push(`heartbeat at position ${index} before hello`);
    return;
  }
  const seq = frame.payload.seq;
  const lastSeq = state.heartbeatSeqs[state.heartbeatSeqs.length - 1];
  if (typeof lastSeq === 'number' && seq <= lastSeq) {
    state.errors.push(`heartbeat sequence not increasing at position ${index}`);
  }
  state.heartbeatSeqs.push(seq);
};

const validateOrientationOrder = (state: FlowState, index: number): void => {
  if (!state.helloSeen) {
    state.errors.push(`orientation at position ${index} before hello`);
  }
};

const validateRouteRequestOrder = (state: FlowState, index: number): void => {
  if (!state.helloSeen) {
    state.errors.push(`route_request at position ${index} before hello`);
  }
};

const validateRouteResponse = (
  state: FlowState,
  frame: LTPFrame & { type: 'route_response'; payload: RouteResponsePayload },
  index: number
): void => {
  if (!state.routeRequested) {
    state.errors.push(`route_response at position ${index} without request`);
  }
  const { branches } = frame.payload;
  const branchCount = Array.isArray(branches)
    ? branches.length
    : branches && typeof branches === 'object'
      ? Object.keys(branches).length
      : 0;
  state.routeResponseBranches = branchCount;
  state.emittedFrames += 1;
  if (branchCount < 2) {
    state.errors.push('route_response must include at least two branches');
  }
};

const validateHelloGate = (state: FlowState, frame: LTPFrame, index: number): void => {
  if (index === 0) {
    if (frame.type !== 'hello') {
      state.errors.push('first frame must be hello');
    }
    return;
  }

  if (!state.helloSeen && frame.type !== 'hello') {
    state.errors.push(`frame at position ${index} received before hello`);
  }
};

const processFrame = (state: FlowState, frame: LTPFrame, index: number): void => {
  validateHelloGate(state, frame, index);

  switch (frame.type) {
    case 'hello':
      state.helloSeen = true;
      state.emittedFrames += 1;
      break;
    case 'heartbeat':
      validateHeartbeatOrder(state, frame, index);
      break;
    case 'orientation':
      validateOrientationOrder(state, index);
      state.orientationSeen = true;
      break;
    case 'route_request':
      validateRouteRequestOrder(state, index);
      state.routeRequested = true;
      break;
    case 'route_response':
      validateRouteResponse(state, frame, index);
      break;
    case 'focus_snapshot':
      state.focusSnapshotSeen = true;
      state.emittedFrames += 1;
      break;
    default:
      break;
  }
};

const hashReport = (state: FlowState, receivedFrames: number): string => {
  const payload = {
    receivedFrames,
    processedFrames: state.processed,
    dedupedFrames: state.deduped,
    heartbeatSeqs: state.heartbeatSeqs,
    orientationSeen: state.orientationSeen,
    routeRequested: state.routeRequested,
    routeResponseBranches: state.routeResponseBranches,
    focusSnapshotSeen: state.focusSnapshotSeen,
    emittedFrames: state.emittedFrames,
    errors: state.errors,
  };
  const serialized = JSON.stringify(payload);
  return createHash('sha256').update(serialized).digest('hex');
};

const determineConformanceLevel = (state: FlowState, ok: boolean): SelfTestReport['level'] => {
  if (ok) {
    return 'LTP-Canonical';
  }

  const flowEligible = state.helloSeen && state.routeRequested && state.routeResponseBranches >= 2;
  if (flowEligible) {
    return 'LTP-Flow';
  }

  return 'LTP-Core';
};

export const runSelfTest = (options: SelfTestOptions = {}): { ok: boolean; report: SelfTestReport } => {
  const mode = resolveSelfTestMode(options.mode);
  const frames = options.frames ?? buildSelfTestFramesForMode(mode);
  const seenIds = new Set<string>();
  const state = createInitialState();

  frames.forEach((frame, index) => {
    if (typeof frame === 'object' && frame !== null) {
      const typed = frame as { type?: unknown; v?: unknown; id?: unknown };
      if (isKnownType(typed.type) && typed.v !== '0.1') {
        state.errors.push(`frame ${String(typed.id ?? index)} has invalid version`);
        return;
      }
    }

    const isValid = isLTPFrame(frame);
    if (!isValid) {
      return;
    }
    if (seenIds.has(frame.id)) {
      state.deduped += 1;
      return;
    }
    seenIds.add(frame.id);
    state.processed += 1;
    processFrame(state, frame, index);
  });

  if (!state.helloSeen) {
    state.errors.push('hello frame missing');
  }
  if (state.routeRequested && state.routeResponseBranches === 0) {
    state.errors.push('route_response missing');
  }

  const determinismHash = hashReport(state, frames.length);
  const ok = state.errors.length === 0;
  const report: SelfTestReport = {
    ok,
    level: determineConformanceLevel(state, ok),
    receivedFrames: frames.length,
    processedFrames: state.processed,
    emittedFrames: state.emittedFrames,
    branchesCount: state.routeResponseBranches,
    dedupedFrames: state.deduped,
    errors: state.errors,
    determinismHash,
    mode,
  };

  return { ok: report.ok, report };
};
