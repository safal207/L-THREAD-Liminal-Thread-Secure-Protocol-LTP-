export type LtpFrame = {
  id?: string;
  ts?: string | number;
  type: string;
  payload?: any;
  continuity_token?: string;
  branches?: Record<string, unknown> | Array<Record<string, unknown>>;
  constraints?: Record<string, unknown>;
  [key: string]: unknown;
};

export type TraceEntry = {
  i: number;
  timestamp_ms: number;
  direction: string;
  session_id: string;
  frame: LtpFrame;
  prev_hash: string;
  hash: string;
  signature?: string;
  alg?: string;
};

export type DriftSnapshot = {
  id?: string;
  ts?: string | number;
  value: number | string;
  note?: string;
};

export type BranchInsight = {
  id: string;
  confidence?: number;
  status: string;
  path?: string;
  class?: string;
  reason?: string;
  constraints?: string[];
};

export type ComplianceReport = {
  profile: string;
  trace_integrity: 'verified' | 'broken' | 'unchecked';
  first_violation_index?: number;
  identity_binding: 'ok' | 'violated' | 'unchecked';
  continuity: {
    breaks: number;
  };
  replay_determinism: 'ok' | 'failed' | 'unchecked';
  determinism_details?: string;
  protocol: string;
  node: string;
};

export type InspectSummary = {
  contract: {
    name: string;
    version: string;
    schema: string;
  };
  generated_at: string;
  tool: {
    name: string;
    build: string;
  };
  input: {
    source: 'stdin' | 'file';
    path?: string;
    frames: number;
    format: 'jsonl' | 'json';
    type: 'raw' | 'audit_log';
  };
  orientation: {
    identity: string;
    stable: boolean;
    drift_level: 'low' | 'medium' | 'high' | 'unknown';
    focus_momentum?: number;
    drift_history: DriftSnapshot[];
  };
  continuity: {
    preserved: boolean;
    notes: string[];
    token?: string;
  };
  branches: BranchInsight[];
  futures: {
    admissible: BranchInsight[];
    degraded: BranchInsight[];
    blocked: BranchInsight[];
  };
  compliance?: ComplianceReport;
  notes: string[];
};
