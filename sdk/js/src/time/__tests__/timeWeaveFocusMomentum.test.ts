import assert from 'node:assert/strict';
import { computeFocusMomentumScore } from '../timeWeave';
import type { TimeBranch, TimeWeave } from '../timeWeaveTypes';

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

function buildBranch(threadId: string, intensities: number[]): TimeBranch {
  return {
    threadId,
    nodes: intensities.map((intensity, index) => ({
      id: `${threadId}-${index}`,
      tick: index,
      intensity,
      phase: 'stable',
    })),
  };
}

runTest('stable branches yield near-zero focus momentum', () => {
  const weave: TimeWeave = {
    branches: [
      buildBranch('s1', [0.5, 0.5, 0.52, 0.5]),
      buildBranch('s2', [0.3, 0.31, 0.3, 0.32]),
    ],
  };

  const score = computeFocusMomentumScore(weave);

  assert.ok(Math.abs(score) < 0.1, `Expected near-zero momentum, got ${score}`);
});

runTest('clearly rising branches produce positive focus momentum', () => {
  const weave: TimeWeave = {
    branches: [
      buildBranch('r1', [0.2, 0.4, 0.6, 0.9]),
      buildBranch('r2', [0.1, 0.3, 0.55, 0.8]),
    ],
  };

  const score = computeFocusMomentumScore(weave);

  assert.ok(score > 0.3, `Expected positive momentum, got ${score}`);
});

runTest('clearly falling branches produce negative focus momentum', () => {
  const weave: TimeWeave = {
    branches: [
      buildBranch('f1', [0.9, 0.6, 0.4, 0.1]),
      buildBranch('f2', [0.8, 0.5, 0.3, 0.2]),
    ],
  };

  const score = computeFocusMomentumScore(weave);

  assert.ok(score < -0.3, `Expected negative momentum, got ${score}`);
});

runTest('sparse branches default to neutral momentum', () => {
  const weave: TimeWeave = {
    branches: [buildBranch('single', [0.6])],
  };

  const score = computeFocusMomentumScore(weave);

  assert.equal(score, 0);
});
