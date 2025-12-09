import {
  ThreadId,
  TimeBranch,
  TimeNode,
  TimeTick,
  TimeWeave,
  TimeWeaveSummary,
  TimeWeaveTrendSummary,
} from './timeWeaveTypes';

const INTENSITY_MIN = 0;
const INTENSITY_MAX = 1;
const TREND_WINDOW = 5;
const TREND_EPSILON = 0.05;

type BranchTrend = 'rising' | 'falling' | 'plateau';

function clampIntensity(value: number): number {
  if (value < INTENSITY_MIN) {
    return INTENSITY_MIN;
  }

  if (value > INTENSITY_MAX) {
    return INTENSITY_MAX;
  }

  return value;
}

function sortNodesByTick(nodes: TimeNode[]): TimeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.tick < b.tick) return -1;
    if (a.tick > b.tick) return 1;
    return 0;
  });
}

export function createEmptyWeave(): TimeWeave {
  return { branches: [] };
}

export function upsertBranch(weave: TimeWeave, branch: TimeBranch): TimeWeave {
  const existingIndex = weave.branches.findIndex((item) => item.threadId === branch.threadId);

  if (existingIndex === -1) {
    return {
      branches: [...weave.branches, branch],
    };
  }

  const updatedBranches = weave.branches.map((item, index) =>
    index === existingIndex ? branch : item,
  );

  return {
    branches: updatedBranches,
  };
}

export function getBranch(weave: TimeWeave, threadId: ThreadId): TimeBranch | undefined {
  return weave.branches.find((branch) => branch.threadId === threadId);
}

export function appendNodeToBranch(
  weave: TimeWeave,
  threadId: ThreadId,
  node: TimeNode,
): TimeWeave {
  const branch = getBranch(weave, threadId);
  const normalizedNode: TimeNode = {
    ...node,
    intensity: clampIntensity(node.intensity),
  };

  if (!branch) {
    const newBranch: TimeBranch = { threadId, nodes: [normalizedNode] };
    return upsertBranch(weave, newBranch);
  }

  const updatedNodes = sortNodesByTick([...branch.nodes, normalizedNode]);
  const updatedBranch: TimeBranch = {
    threadId,
    nodes: updatedNodes,
  };

  return upsertBranch(weave, updatedBranch);
}

export function computeBranchTrend(branch: TimeBranch): BranchTrend {
  const nodes = branch.nodes.slice(-TREND_WINDOW);

  if (nodes.length <= 1) {
    return 'plateau';
  }

  const midPoint = Math.floor(nodes.length / 2);
  const firstHalf = nodes.slice(0, midPoint);
  const secondHalf = nodes.slice(midPoint);

  const average = (items: TimeNode[]): number =>
    items.reduce((sum, item) => sum + item.intensity, 0) / items.length;

  const firstAvg = average(firstHalf);
  const secondAvg = average(secondHalf);

  if (secondAvg > firstAvg + TREND_EPSILON) {
    return 'rising';
  }

  if (secondAvg < firstAvg - TREND_EPSILON) {
    return 'falling';
  }

  return 'plateau';
}

export function summarizeWeave(weave: TimeWeave): TimeWeaveTrendSummary {
  const branchCount = weave.branches.length;

  const trends = weave.branches.map((branch) => computeBranchTrend(branch));

  const activeBranches = weave.branches.reduce((count, branch) => {
    const lastNode = branch.nodes[branch.nodes.length - 1];
    if (lastNode && lastNode.intensity > 0.3) {
      return count + 1;
    }
    return count;
  }, 0);

  const trendCounts = trends.reduce(
    (acc, trend) => {
      acc[trend] += 1;
      return acc;
    },
    { rising: 0, falling: 0, plateau: 0 } as Record<BranchTrend, number>,
  );

  let globalTrend: TimeWeaveTrendSummary['globalTrend'] = 'plateau';

  if (trendCounts.rising > 0 && trendCounts.falling > 0) {
    globalTrend = 'mixed';
  } else if (trendCounts.rising > 0) {
    globalTrend = 'rising';
  } else if (trendCounts.falling > 0) {
    globalTrend = 'falling';
  }

  return {
    branchCount,
    activeBranches,
    globalTrend,
  };
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toTimestamp(tick: TimeTick): number | null {
  if (typeof tick === 'number' && Number.isFinite(tick)) {
    return tick;
  }

  if (typeof tick === 'string') {
    const asNumber = Number(tick);
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }

    const parsed = Date.parse(tick);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

const TARGET_BRANCH_COUNT = 12;
const TARGET_EVENT_COUNT = 100;
// One hour is treated as a "rich" span of activity; longer spans saturate the factor.
const TARGET_TIME_SPAN_MS = 60 * 60 * 1000;

export function computeTimeWeaveSummary(weave: TimeWeave): TimeWeaveSummary {
  const branchesCount = weave.branches.length;
  let eventsCount = 0;
  let minTimestamp: number | null = null;
  let maxTimestamp: number | null = null;

  weave.branches.forEach((branch) => {
    eventsCount += branch.nodes.length;

    branch.nodes.forEach((node) => {
      const timestamp = toTimestamp(node.tick);
      if (timestamp === null) {
        return;
      }

      if (minTimestamp === null || timestamp < minTimestamp) {
        minTimestamp = timestamp;
      }

      if (maxTimestamp === null || timestamp > maxTimestamp) {
        maxTimestamp = timestamp;
      }
    });
  });

  const hasValidTimestamps =
    minTimestamp !== null &&
    maxTimestamp !== null &&
    Number.isFinite(minTimestamp) &&
    Number.isFinite(maxTimestamp) &&
    maxTimestamp >= minTimestamp;

  const timeSpanMs = hasValidTimestamps ? maxTimestamp! - minTimestamp! : 0;

  const branchFactor = clamp01(branchesCount / TARGET_BRANCH_COUNT);
  const eventsFactor = clamp01(eventsCount / TARGET_EVENT_COUNT);
  const spanFactor = clamp01(timeSpanMs / TARGET_TIME_SPAN_MS);

  const depthScore = branchFactor * 0.4 + eventsFactor * 0.4 + spanFactor * 0.2;

  return {
    depthScore,
    branchesCount,
    eventsCount,
    timeSpanMs,
  };
}
