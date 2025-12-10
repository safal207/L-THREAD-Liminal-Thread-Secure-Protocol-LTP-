import { computeTimeWeaveSummary } from './timeWeave';
import type { TimeBranch, TimeWeave, TimeWeaveMeta } from './timeWeaveTypes';

const MOMENTUM_WINDOW = 5;
const TOP_BRANCHES = 4;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function computeBranchFocusMomentum(branch: TimeBranch): { score: number } {
  const nodes = branch.nodes.slice(-MOMENTUM_WINDOW);

  if (nodes.length < 2) {
    return { score: 0 };
  }

  const first = nodes[0];
  const last = nodes[nodes.length - 1];

  if (!first || !last) {
    return { score: 0 };
  }

  const delta = last.intensity - first.intensity;

  const consecutiveDiffs = nodes
    .slice(1)
    .map((node, index) => Math.abs(node.intensity - nodes[index]!.intensity));
  const volatility =
    consecutiveDiffs.reduce((sum, value) => sum + value, 0) /
    Math.max(consecutiveDiffs.length, 1);

  // Magnitude of directional drift in the recent window.
  const magnitude = clamp01(Math.abs(delta));
  // Reward steady movement more than erratic swings. Volatility above ~0.5 fully dampens the score.
  const stability = 1 - clamp01(volatility / 0.5);

  const score = clamp01(magnitude * 0.7 + stability * 0.3);

  return { score };
}

export function computeTimeWeaveMeta(weave: TimeWeave): TimeWeaveMeta {
  const branchCount = weave.branches.length;
  const branchLengths = weave.branches.map((branch) => branch.nodes.length);
  const totalDepth = branchLengths.reduce((sum, length) => sum + length, 0);
  const avgBranchLength = branchCount > 0 ? totalDepth / branchCount : 0;
  const maxBranchLength = branchLengths.reduce((max, length) => Math.max(max, length), 0);

  const weaveSummary = computeTimeWeaveSummary(weave);

  const branchMomentum = weave.branches
    .map((branch) => {
      const { score } = computeBranchFocusMomentum(branch);
      return { score, weight: Math.max(branch.nodes.length, 1) };
    })
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, TOP_BRANCHES);

  const totalWeight = branchMomentum.reduce((sum, item) => sum + item.weight, 0);
  const weightedScore = branchMomentum.reduce((sum, item) => sum + item.score * item.weight, 0);

  const focusMomentum = totalWeight > 0 ? clamp01(weightedScore / totalWeight) : 0;

  return {
    depth: {
      totalDepth,
      branchCount,
      avgBranchLength,
      maxBranchLength,
      complexityScore: weaveSummary.depthScore,
      focusMomentum,
    },
  };
}
