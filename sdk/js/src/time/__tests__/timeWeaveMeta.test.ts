import assert from 'node:assert/strict';
import { computeTimeWeaveMeta } from '../timeWeaveMeta';
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

runTest('flat trend produces low focus momentum', () => {
  const weave: TimeWeave = {
    branches: [buildBranch('flat', [0.4, 0.42, 0.41, 0.4, 0.39])],
  };

  const meta = computeTimeWeaveMeta(weave);

  assert.ok(meta.depth.focusMomentum !== undefined);
  assert.ok((meta.depth.focusMomentum ?? 0) < 0.25, `expected low momentum, got ${meta.depth.focusMomentum}`);
});

runTest('steady upward trend yields stronger focus momentum', () => {
  const weave: TimeWeave = {
    branches: [
      buildBranch('up', [0.1, 0.25, 0.45, 0.65, 0.85]),
      buildBranch('small-up', [0.2, 0.3, 0.35, 0.42, 0.5]),
    ],
  };

  const meta = computeTimeWeaveMeta(weave);

  assert.ok((meta.depth.focusMomentum ?? 0) > 0.4, `expected upward momentum, got ${meta.depth.focusMomentum}`);
});

runTest('chaotic swings stay below clean upward momentum', () => {
  const orderly: TimeWeave = {
    branches: [buildBranch('up', [0.15, 0.35, 0.55, 0.75, 0.9])],
  };
  const chaotic: TimeWeave = {
    branches: [buildBranch('wild', [0.2, 0.8, 0.3, 0.9, 0.25])],
  };

  const orderlyMeta = computeTimeWeaveMeta(orderly);
  const chaoticMeta = computeTimeWeaveMeta(chaotic);

  assert.ok(
    (chaoticMeta.depth.focusMomentum ?? 0) < (orderlyMeta.depth.focusMomentum ?? 0),
    `expected chaotic momentum to be dampened (chaotic=${chaoticMeta.depth.focusMomentum}, orderly=${orderlyMeta.depth.focusMomentum})`,
  );
});
