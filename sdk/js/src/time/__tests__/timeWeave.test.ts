import assert from 'node:assert/strict';
import {
  appendNodeToBranch,
  computeBranchTrend,
  createEmptyWeave,
  summarizeWeave,
  upsertBranch,
} from '../timeWeave';
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

function makeNode(overrides: Partial<TimeNode> = {}): TimeNode {
  return {
    id: `node-${Math.random().toString(16).slice(2, 8)}`,
    tick: Date.now(),
    intensity: 0.5,
    phase: 'stable',
    ...overrides,
  };
}

runTest('createEmptyWeave initializes without branches', () => {
  const weave = createEmptyWeave();
  assert.deepEqual(weave, { branches: [] });
});

runTest('upsertBranch inserts and replaces by threadId', () => {
  const branchA: TimeBranch = { threadId: 'thread-1', nodes: [makeNode()] };
  const branchB: TimeBranch = { threadId: 'thread-1', nodes: [makeNode({ intensity: 0.8 })] };

  const afterInsert = upsertBranch(createEmptyWeave(), branchA);
  const insertedBranch = afterInsert.branches[0];
  assert.ok(insertedBranch);
  const insertedNode = insertedBranch.nodes[0];
  assert.ok(insertedNode);
  const originalNode = branchA.nodes[0];
  assert.ok(originalNode);
  assert.equal(insertedNode.id, originalNode.id);

  const afterReplace = upsertBranch(afterInsert, branchB);
  const replacedBranch = afterReplace.branches[0];
  assert.ok(replacedBranch);
  const replacedNode = replacedBranch.nodes[0];
  assert.ok(replacedNode);
  const replacementNode = branchB.nodes[0];
  assert.ok(replacementNode);
  assert.equal(replacedNode.id, replacementNode.id);
});

runTest('appendNodeToBranch creates missing branch, clamps intensity, and keeps order', () => {
  const nodeLow: TimeNode = makeNode({ tick: 5, intensity: -0.2 });
  const nodeHigh: TimeNode = makeNode({ tick: 10, intensity: 1.5 });
  const nodeMid: TimeNode = makeNode({ tick: 7, intensity: 0.6 });

  const weaveWithNewBranch = appendNodeToBranch(createEmptyWeave(), 'thread-2', nodeMid);
  assert.equal(weaveWithNewBranch.branches.length, 1);

  const withMoreNodes = appendNodeToBranch(weaveWithNewBranch, 'thread-2', nodeLow);
  const finalWeave = appendNodeToBranch(withMoreNodes, 'thread-2', nodeHigh);

  const branch = finalWeave.branches[0];
  assert.ok(branch);
  assert.equal(branch.nodes.length, 3);
  assert.deepEqual(
    branch.nodes.map((n) => n.tick),
    [5, 7, 10],
  );
  const firstNode = branch.nodes[0];
  const lastNode = branch.nodes[2];
  assert.ok(firstNode);
  assert.ok(lastNode);
  assert.equal(firstNode.intensity, 0);
  assert.equal(lastNode.intensity, 1);
});

runTest('computeBranchTrend detects rising, falling, and plateau', () => {
  const risingBranch: TimeBranch = {
    threadId: 'rise',
    nodes: [0.1, 0.2, 0.4, 0.7].map((intensity, idx) => makeNode({ tick: idx, intensity })),
  };
  const fallingBranch: TimeBranch = {
    threadId: 'fall',
    nodes: [0.8, 0.6, 0.4, 0.1].map((intensity, idx) => makeNode({ tick: idx, intensity })),
  };
  const flatBranch: TimeBranch = {
    threadId: 'flat',
    nodes: [0.4, 0.4, 0.41, 0.4].map((intensity, idx) => makeNode({ tick: idx, intensity })),
  };

  assert.equal(computeBranchTrend(risingBranch), 'rising');
  assert.equal(computeBranchTrend(fallingBranch), 'falling');
  assert.equal(computeBranchTrend(flatBranch), 'plateau');
});

runTest('summarizeWeave reports counts and global trend', () => {
  const weave: TimeWeave = {
    branches: [
      {
        threadId: 'a',
        nodes: [makeNode({ intensity: 0.2 })],
      },
      {
        threadId: 'b',
        nodes: [0.1, 0.2, 0.3, 0.5].map((intensity, idx) => makeNode({ tick: idx, intensity })),
      },
      {
        threadId: 'c',
        nodes: [0.9, 0.6, 0.4].map((intensity, idx) => makeNode({ tick: idx, intensity })),
      },
    ],
  };

  const summary = summarizeWeave(weave);
  assert.equal(summary.branchCount, 3);
  assert.equal(summary.activeBranches, 2);
  assert.equal(summary.globalTrend, 'mixed');
});
