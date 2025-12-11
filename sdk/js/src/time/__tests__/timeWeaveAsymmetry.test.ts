import assert from 'node:assert/strict';
import { computeTimeWeaveAsymmetry, detectBranchCollapse } from '../timeWeaveAsymmetry';
import type { TimeBranch, TimeWeaveSummary } from '../timeWeaveTypes';

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

function makeBranch(threadId: string, weight: number): TimeBranch {
  return {
    threadId,
    nodes: [
      {
        id: `${threadId}-n1`,
        tick: 0,
        intensity: weight,
        phase: 'stable',
      },
    ],
  };
}

runTest('balanced weave shows no collapse', () => {
  const branches: TimeBranch[] = [
    makeBranch('a', 0.25),
    makeBranch('b', 0.25),
    makeBranch('c', 0.25),
    makeBranch('d', 0.25),
  ];

  const asymmetry = computeTimeWeaveAsymmetry({ branches });
  const collapse = detectBranchCollapse({ asymmetry, branches });

  assert.equal(asymmetry.branchCount, 4);
  assert.ok(Math.abs(asymmetry.concentration - 0.25) < 0.001);
  assert.equal(asymmetry.shape, 'balanced');
  assert.equal(collapse.hasCollapsed, false);
  assert.equal(collapse.mode, 'none');
});

runTest('single dominant branch triggers hard collapse', () => {
  const branches: TimeBranch[] = [
    makeBranch('dominant', 0.8),
    makeBranch('alt-1', 0.1),
    makeBranch('alt-2', 0.1),
  ];

  const asymmetry = computeTimeWeaveAsymmetry({ branches });
  const collapse = detectBranchCollapse({ asymmetry, branches });

  assert.ok(asymmetry.concentration >= 0.8);
  assert.equal(asymmetry.shape, 'single-dominant');
  assert.equal(collapse.hasCollapsed, true);
  assert.equal(collapse.mode, 'hard-collapse');
  assert.equal(collapse.dominantBranchId, 'dominant');
});

runTest('soft merge detected when concentration rises sharply', () => {
  const previousBranches: TimeBranch[] = [
    makeBranch('p1', 0.35),
    makeBranch('p2', 0.3),
    makeBranch('p3', 0.35),
  ];
  const previousAsymmetry = computeTimeWeaveAsymmetry({ branches: previousBranches });
  const previousSummary: TimeWeaveSummary = {
    depthScore: 0,
    branchesCount: previousBranches.length,
    eventsCount: previousBranches.reduce((sum, branch) => sum + branch.nodes.length, 0),
    timeSpanMs: 0,
    asymmetry: previousAsymmetry,
  };

  const branches: TimeBranch[] = [
    makeBranch('p1', 0.65),
    makeBranch('p2', 0.2),
    makeBranch('p3', 0.15),
  ];

  const asymmetry = computeTimeWeaveAsymmetry({ branches });
  const collapse = detectBranchCollapse({ asymmetry, branches, previousSummary });

  assert.equal(asymmetry.shape, 'single-dominant');
  assert.equal(collapse.hasCollapsed, true);
  assert.equal(collapse.mode, 'soft-merge');
});

runTest('scattered futures avoid collapse', () => {
  const branches: TimeBranch[] = [
    makeBranch('s1', 0.5),
    makeBranch('s2', 0.2),
    makeBranch('s3', 0.1),
    makeBranch('s4', 0.1),
    makeBranch('s5', 0.1),
  ];

  const asymmetry = computeTimeWeaveAsymmetry({ branches });
  const collapse = detectBranchCollapse({ asymmetry, branches });

  assert.equal(asymmetry.shape, 'scattered');
  assert.equal(collapse.hasCollapsed, false);
  assert.equal(collapse.mode, 'none');
});
