export type LtpFrame = {
  id?: string;
  ts?: string | number;
  type: string;
  payload?: any;
  continuity_token?: string;
  branches?: Record<string, unknown> | Array<Record<string, unknown>>;
  [key: string]: unknown;
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
    path: string;
    frames: number;
    format: 'jsonl' | 'json';
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
  notes: string[];
};
