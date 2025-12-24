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
  key_id?: string;
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

export type ComplianceViolation = {
  rule_id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  frame_index: number;
  source: string;
  action: string;
  evidence: string;
};

export type AuditSummary = {
  verdict: 'PASS' | 'FAIL';
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  failed_checks: string[];
  violations: ComplianceViolation[];
  violations_count_by_severity: Record<string, number>;
  regulator_ready: boolean;
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
  signatures?: {
    present: boolean;
    valid: boolean; // simplistic check if we can't verify crypto without keys
    key_ids: string[];
    algorithm?: string;
  };
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
    hash?: string; // toolchain hash
  };
  input: {
    source: 'stdin' | 'file';
    path?: string;
    frames: number;
    format: 'jsonl' | 'json';
    type: 'raw' | 'audit_log';
    hash_root?: string; // The last hash in the chain
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
  audit_summary?: AuditSummary;
  continuity_routing?: {
    checked: boolean;
    system_remained_coherent: boolean;
    first_unsafe_transition_index: number | null;
    state_transitions: number;
  };
  notes: string[];
};
