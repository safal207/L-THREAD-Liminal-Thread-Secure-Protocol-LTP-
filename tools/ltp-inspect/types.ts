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
  confidence?: number;
  status: string;
  path?: string;
  class?: string;
};

export type InspectSummary = {
  orientationStable: boolean;
  driftLevel: 'low' | 'medium' | 'high' | 'unknown';
  continuityPreserved: boolean;
  continuityNotes: string[];
  branches: Record<string, BranchInsight>;
  notes: string[];
};
