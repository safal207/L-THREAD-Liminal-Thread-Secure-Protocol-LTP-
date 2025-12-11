import assert from 'node:assert/strict';
import { computeAsymmetryMeta } from '../timeWeaveAsymmetry';
import type { TimeWeaveHistory } from '../timeWeaveTypes';

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

const defaultOptions = { maxSteps: 50, maxSpanMs: 100_000 } as const;

runTest('shallow bias produces low depth and softness', () => {
  const history: TimeWeaveHistory = {
    segments: [
      { bias: 0.2, asymmetryMagnitude: 0.2, stepCount: 2, timestampMs: 0 },
      { bias: 0.15, asymmetryMagnitude: 0.15, stepCount: 1, timestampMs: 1000 },
    ],
  };

  const meta = computeAsymmetryMeta(history, defaultOptions);

  assert.equal(meta.direction, 'forward');
  assert.ok(meta.depthScore < 0.1);
  assert.ok(meta.softAsymmetryIndex < 0.55);
});

runTest('deep stable bias increases depth and softness', () => {
  const history: TimeWeaveHistory = {
    segments: Array.from({ length: 10 }, (_, index) => ({
      bias: 0.8,
      asymmetryMagnitude: 0.8,
      stepCount: 5,
      timestampMs: index * 10_000,
    })),
  };

  const meta = computeAsymmetryMeta(history, defaultOptions);

  assert.equal(meta.direction, 'forward');
  assert.ok(meta.depthScore > 0.8);
  assert.ok(meta.softAsymmetryIndex > 0.8);
});

runTest('volatile bias dampens softness even with high asymmetry', () => {
  const history: TimeWeaveHistory = {
    segments: [
      { bias: 0.9, asymmetryMagnitude: 0.9, stepCount: 5, timestampMs: 0 },
      { bias: -0.8, asymmetryMagnitude: 0.8, stepCount: 5, timestampMs: 10_000 },
      { bias: 0.85, asymmetryMagnitude: 0.85, stepCount: 5, timestampMs: 20_000 },
    ],
  };

  const meta = computeAsymmetryMeta(history, defaultOptions);

  assert.equal(meta.direction, 'forward');
  assert.ok(meta.depthScore < 0.4);
  assert.ok(meta.softAsymmetryIndex < 0.6);
});

