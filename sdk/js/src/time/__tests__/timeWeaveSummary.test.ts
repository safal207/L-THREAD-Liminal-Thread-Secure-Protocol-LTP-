import assert from 'node:assert/strict';
import { computeTimeWeaveSummary } from '../timeWeave';
import type { TimeBranch, TimeNode, TimeWeave } from '../timeWeaveTypes';

function runTest(name: string, fn: () => void): void {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`✔ ${name}`))
    .catch((error) => {
      console.error(`✖ ${name}`);
      console.error(error);
      process.exitCode = 1;
    });
}

function makeNode(tick: number | string, overrides: Partial<TimeNode> = {}): TimeNode {
  return {
    id: `node-${Math.random().toString(16).slice(2, 8)}`,
    tick,
    intensity: 0.5,
    phase: 'stable',
    ...overrides,
  };
}

runTest('computeTimeWeaveSummary handles an empty weave', () => {
  const weave: TimeWeave = { branches: [] };

  const summary = computeTimeWeaveSummary(weave);

  assert.equal(summary.branchesCount, 0);
  assert.equal(summary.eventsCount, 0);
  assert.equal(summary.timeSpanMs, 0);
  assert.equal(summary.depthScore, 0);
});

runTest('computeTimeWeaveSummary evaluates a single modest branch', () => {
  const branch: TimeBranch = {
    threadId: 'single',
    nodes: [1000, 2000, 3000].map((tick) => makeNode(tick)),
  };
  const weave: TimeWeave = { branches: [branch] };

  const summary = computeTimeWeaveSummary(weave);

  assert.equal(summary.branchesCount, 1);
  assert.equal(summary.eventsCount, 3);
  assert.equal(summary.timeSpanMs, 2000);
  assert.ok(summary.depthScore > 0);
  assert.ok(summary.depthScore < 0.2);
});

runTest('computeTimeWeaveSummary increases with richer, longer activity', () => {
  const branches: TimeBranch[] = Array.from({ length: 8 }, (_, branchIdx) => {
    const baseTick = branchIdx * 15 * 60 * 1000; // stagger branches by 15 minutes
    const nodes: TimeNode[] = Array.from({ length: 15 }, (__, nodeIdx) =>
      makeNode(baseTick + nodeIdx * 60 * 1000),
    );
    return {
      threadId: `branch-${branchIdx}`,
      nodes,
    };
  });
  const weave: TimeWeave = { branches };

  const summary = computeTimeWeaveSummary(weave);

  assert.equal(summary.branchesCount, 8);
  assert.equal(summary.eventsCount, 120);
  assert.ok(summary.timeSpanMs > 0);
  assert.ok(summary.depthScore > 0.5);
});

runTest('computeTimeWeaveSummary tolerates missing timestamps', () => {
  const branch: TimeBranch = {
    threadId: 'invalid-time',
    nodes: [makeNode('not-a-date'), makeNode(Number.NaN), makeNode('')],
  };
  const weave: TimeWeave = { branches: [branch] };

  const summary = computeTimeWeaveSummary(weave);

  assert.equal(summary.timeSpanMs, 0);
  assert.equal(summary.branchesCount, 1);
  assert.equal(summary.eventsCount, 3);
  assert.ok(summary.depthScore > 0);
});
