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

runTest('neutral short history stays on a neutral plateau', () => {
  const history: TimeWeaveHistory = {
    segments: [
      { bias: 0.02, asymmetryMagnitude: 0.02, stepCount: 1, timestampMs: 0 },
      { bias: -0.03, asymmetryMagnitude: 0.03, stepCount: 1, timestampMs: 10 },
      { bias: 0.01, asymmetryMagnitude: 0.01, stepCount: 1, timestampMs: 20 },
    ],
  };

  const meta = computeAsymmetryMeta(history, defaultOptions);

  assert.ok(Math.abs(meta.depthWeightedAsymmetry) < 0.1);
  assert.ok(meta.tenderness > 0.8);
  assert.equal(meta.posture, 'neutral_plateau');
});

runTest('steady forward drift yields a steady posture', () => {
  const history: TimeWeaveHistory = {
    segments: [
      { bias: 0.2, asymmetryMagnitude: 0.2, stepCount: 2, timestampMs: 0 },
      { bias: 0.3, asymmetryMagnitude: 0.3, stepCount: 3, timestampMs: 5_000 },
      { bias: 0.42, asymmetryMagnitude: 0.42, stepCount: 4, timestampMs: 10_000 },
      { bias: 0.5, asymmetryMagnitude: 0.5, stepCount: 5, timestampMs: 15_000 },
    ],
  };

  const meta = computeAsymmetryMeta(history, defaultOptions);

  assert.ok(meta.depthWeightedAsymmetry > 0.3);
  assert.ok(meta.tenderness > 0.7);
  assert.equal(meta.posture, 'steady_forward');
});

runTest('sharp flip is classified as a storm shift', () => {
  const history: TimeWeaveHistory = {
    segments: [
      { bias: -0.4, asymmetryMagnitude: 0.4, stepCount: 1, timestampMs: 0 },
      { bias: -0.6, asymmetryMagnitude: 0.6, stepCount: 1, timestampMs: 1_000 },
      { bias: 0.8, asymmetryMagnitude: 0.8, stepCount: 4, timestampMs: 2_000 },
    ],
  };

  const meta = computeAsymmetryMeta(history, defaultOptions);

  assert.ok(meta.tenderness < 0.4);
  assert.equal(meta.posture, 'storm_shift');
});

runTest('gentle recovery from backward bias is gentle_recovery', () => {
  const history: TimeWeaveHistory = {
    segments: [
      { bias: -0.5, asymmetryMagnitude: 0.5, stepCount: 3, timestampMs: 0 },
      { bias: -0.35, asymmetryMagnitude: 0.35, stepCount: 3, timestampMs: 1_000 },
      { bias: -0.2, asymmetryMagnitude: 0.2, stepCount: 3, timestampMs: 2_000 },
      { bias: -0.1, asymmetryMagnitude: 0.1, stepCount: 3, timestampMs: 3_000 },
    ],
  };

  const meta = computeAsymmetryMeta(history, defaultOptions);

  assert.ok(meta.depthWeightedAsymmetry < 0);
  assert.ok(meta.tenderness > 0.7);
  assert.equal(meta.posture, 'gentle_recovery');
});

