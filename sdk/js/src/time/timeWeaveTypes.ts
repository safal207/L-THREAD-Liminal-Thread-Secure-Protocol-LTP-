export type ThreadId = string;

export type TimeTick = number | string;

export type TimePhase = 'emerging' | 'stable' | 'declining' | 'dormant';

export interface TimeNode {
  id: string;
  tick: TimeTick;
  intensity: number;
  phase: TimePhase;
}

export interface TimeBranch {
  threadId: ThreadId;
  nodes: TimeNode[];
}

export interface TimeWeave {
  branches: TimeBranch[];
}

export interface TimeWeaveTrendSummary {
  branchCount: number;
  activeBranches: number;
  globalTrend: 'rising' | 'falling' | 'mixed' | 'plateau';
}

export type TimeWeaveAsymmetryShape =
  | 'balanced'
  | 'single-dominant'
  | 'bi-modal'
  | 'scattered';

export type TimeWeaveAsymmetryDirection = 'forward' | 'backward' | 'balanced';

export interface TimeWeaveAsymmetry {
  /** Share of total branch weight held by the dominant branch. Range: 0..1. */
  concentration: number;
  /** Qualitative label for how the branch weights are distributed. */
  shape: TimeWeaveAsymmetryShape;
  /** Number of active branches considered in the snapshot. */
  branchCount: number;
}

export interface TimeWeaveAsymmetryMeta {
  rawAsymmetry: number;
  direction: TimeWeaveAsymmetryDirection;
  depthScore: number;
  softAsymmetryIndex: number;
  depthWeightedAsymmetry: number;
  tenderness: number;
  posture: TemporalPosture;
}

export type TemporalPosture =
  | 'steady_forward'
  | 'steady_backward'
  | 'gentle_recovery'
  | 'storm_shift'
  | 'neutral_plateau';

export interface TimeWeaveHistorySegment {
  bias: number;
  timestampMs?: number;
  stepCount?: number;
  asymmetryMagnitude?: number;
}

export interface TimeWeaveHistory {
  segments: TimeWeaveHistorySegment[];
}

export interface BranchCollapseSignal {
  hasCollapsed: boolean;
  mode: 'none' | 'soft-merge' | 'hard-collapse';
  /** Optional ID of the branch holding the dominant weight, when known. */
  dominantBranchId?: string;
  /** Optional human-readable reason for explainability. */
  reason?: string;
}

export interface TimeWeaveSummary {
  /**
   * Normalized measure of how “deep” / complex the weave is.
   * Range: 0..1
   */
  depthScore: number;

  /**
   * Number of branches in the weave.
   */
  branchesCount: number;

  /**
   * Total number of events (nodes) observed across all branches.
   */
  eventsCount: number;

  /**
   * Time span between earliest and latest event in ms, if timestamps exist.
   * If timestamps are missing or invalid, this may be 0.
   */
  timeSpanMs: number;

  /** Branch weight distribution at the current snapshot. */
  asymmetry?: TimeWeaveAsymmetry;

  /** Signal describing whether futures have collapsed into one dominant branch. */
  collapse?: BranchCollapseSignal;
}

export interface TimeWeaveDepth {
  totalDepth: number;
  branchCount: number;
  avgBranchLength: number;
  maxBranchLength: number;
  complexityScore: number;
  /**
   * Strength of directional change in the most active, recent segments.
   * Range: 0..1 (0 = stagnant, 1 = strong coordinated drift)
   */
  focusMomentum?: number;
}

export interface TimeWeaveMeta {
  depth: TimeWeaveDepth;
}
