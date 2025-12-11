import type {
  BranchCollapseSignal,
  TimeBranch,
  TimeWeaveAsymmetry,
  TimeWeaveSummary,
} from './timeWeaveTypes';

export interface AsymmetryInput {
  branches: TimeBranch[];
}

interface WeightedBranch {
  branch: TimeBranch;
  weight: number;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function computeBranchWeight(branch: TimeBranch): number {
  if (branch.nodes.length === 0) {
    return 0;
  }

  // Branch is non-empty due to the guard above; non-null assertion keeps strict
  // null checks satisfied in stricter configurations.
  const last = branch.nodes[branch.nodes.length - 1]!;
  const average =
    branch.nodes.reduce((sum, node) => sum + clamp01(node.intensity), 0) /
    branch.nodes.length;

  // Favor recent signal while keeping the branch history in play.
  const recentIntensity = clamp01(last.intensity);
  return Number((recentIntensity * 0.7 + average * 0.3).toFixed(4));
}

function rankBranches(branches: TimeBranch[]): WeightedBranch[] {
  return branches
    .map((branch) => ({ branch, weight: computeBranchWeight(branch) }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Compute concentration and qualitative shape of the TimeWeave branch distribution.
 */
export function computeTimeWeaveAsymmetry(input: AsymmetryInput): TimeWeaveAsymmetry {
  const { branches } = input;
  const branchCount = branches.length;

  if (branchCount === 0) {
    return { concentration: 0, shape: 'balanced', branchCount };
  }

  const ranked = rankBranches(branches);
  const weights = ranked.map((item) => item.weight);

  // Guard against undefined access when strict array index checks are enabled.
  const top = weights[0] ?? 0;
  const second = weights[1] ?? 0;

  const total = weights.reduce((sum, weight) => sum + weight, 0);

  if (branchCount === 1) {
    return { concentration: 1, shape: 'single-dominant', branchCount };
  }

  if (total <= 0) {
    return { concentration: 0, shape: 'balanced', branchCount };
  }

  const concentration = top / total;
  const topShare = concentration;
  const secondShare = second / total;

  let shape: TimeWeaveAsymmetry['shape'] = 'scattered';

  if (topShare >= 0.7) {
    shape = 'single-dominant';
  } else if (topShare <= 0.4) {
    shape = 'balanced';
  } else if (topShare >= 0.3 && secondShare >= 0.3) {
    shape = 'bi-modal';
  } else {
    shape = 'scattered';
  }

  return {
    concentration: Number(concentration.toFixed(4)),
    shape,
    branchCount,
  };
}

export interface CollapseContext {
  asymmetry: TimeWeaveAsymmetry;
  branches: TimeBranch[];
  previousSummary?: TimeWeaveSummary;
}

function findDominantBranch(branches: TimeBranch[]): TimeBranch | undefined {
  return rankBranches(branches)[0]?.branch;
}

/**
 * Decide whether the weave has effectively collapsed into a dominant branch.
 */
export function detectBranchCollapse(ctx: CollapseContext): BranchCollapseSignal {
  const { asymmetry, branches, previousSummary } = ctx;
  const branchCount = asymmetry.branchCount;
  const dominantBranch = findDominantBranch(branches);
  const previousAsymmetry = previousSummary?.asymmetry;

  if (branchCount <= 0) {
    return {
      hasCollapsed: true,
      mode: 'hard-collapse',
      reason: 'no active branches present',
    };
  }

  if (branchCount === 1) {
    return {
      hasCollapsed: true,
      mode: 'hard-collapse',
      dominantBranchId: dominantBranch?.threadId,
      reason: 'single branch present',
    };
  }

  const concentration = asymmetry.concentration;
  const previousConcentration = previousAsymmetry?.concentration;
  const previousBranchCount = previousAsymmetry?.branchCount;

  if (concentration >= 0.8) {
    return {
      hasCollapsed: true,
      mode: 'hard-collapse',
      dominantBranchId: dominantBranch?.threadId,
      reason: 'single branch dominates probability mass',
    };
  }

  const concentrationRise =
    typeof previousConcentration === 'number' ? concentration - previousConcentration : 0;
  const branchDrop = typeof previousBranchCount === 'number' && previousBranchCount > branchCount;

  if (concentration >= 0.6 && concentration < 0.8 && (concentrationRise > 0.15 || branchDrop)) {
    return {
      hasCollapsed: true,
      mode: 'soft-merge',
      dominantBranchId: dominantBranch?.threadId,
      reason: branchDrop
        ? 'branches merged into a dominant path'
        : 'dominant branch gaining rapid concentration',
    };
  }

  return {
    hasCollapsed: false,
    mode: 'none',
    reason: 'no collapse — distribution still balanced',
  };
}
