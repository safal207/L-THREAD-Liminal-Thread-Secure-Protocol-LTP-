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

export interface TimeWeaveSummary {
  branchCount: number;
  activeBranches: number;
  globalTrend: 'rising' | 'falling' | 'mixed' | 'plateau';
}
