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

export interface TimeWeaveAsymmetry {
  asymmetry: number; // 0..1
  direction: -1 | 0 | 1;
  confidence: number; // 0..1
}
