export type LtpFrame = {
  id?: string;
  ts?: string | number;
  type: string;
  payload?: any;
  continuity_token?: string;
  branches?: Record<string, unknown> | Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type BranchInsight = {
  id: string;
  confidence?: number;
  status: string;
  path?: string;
  class?: string;
};

export type InspectSummary = {
  version: string;
  orientation: {
    stable: boolean;
    drift_level: 'low' | 'medium' | 'high' | 'unknown';
  };
  continuity: {
    preserved: boolean;
    notes: string[];
  };
  branches: BranchInsight[];
  notes: string[];
};
