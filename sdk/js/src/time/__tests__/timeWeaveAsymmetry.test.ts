import assert from 'node:assert/strict';
import { computeTimeWeaveAsymmetry } from '../timeWeaveAsymmetry';

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

runTest('returns zero asymmetry for empty or single-value arrays', () => {
  assert.deepEqual(computeTimeWeaveAsymmetry([]), {
    asymmetry: 0,
    direction: 0,
    confidence: 0,
  });

  assert.deepEqual(computeTimeWeaveAsymmetry([5]), {
    asymmetry: 0,
    direction: 0,
    confidence: 0,
  });
});

runTest('treats flat ranges as symmetric', () => {
  assert.deepEqual(computeTimeWeaveAsymmetry([3, 3, 3]), {
    asymmetry: 0,
    direction: 0,
    confidence: 0,
  });
});

runTest('detects rising and falling trends with direction and confidence', () => {
  const rising = computeTimeWeaveAsymmetry([1, 2, 3, 4, 5]);
  assert.equal(rising.direction, 1);
  assert.ok(rising.asymmetry > 0);
  assert.ok(rising.confidence > 0);

  const falling = computeTimeWeaveAsymmetry([5, 4, 3, 2, 1]);
  assert.equal(falling.direction, -1);
  assert.ok(falling.asymmetry > 0);
  assert.ok(falling.confidence > 0);
});

runTest('zeros direction when delta is within the dead zone', () => {
  const nearFlat = computeTimeWeaveAsymmetry([10, 10.02, 10.01, 10.03]);
  assert.equal(nearFlat.direction, 0);
  assert.ok(nearFlat.asymmetry >= 0);
  assert.ok(nearFlat.confidence >= 0);
});
