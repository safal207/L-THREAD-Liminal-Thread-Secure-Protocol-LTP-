import assert from 'node:assert/strict';
import { buildCanonicalInput, canonicalFlow } from '../canonicalFlow';

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

runTest('canonicalFlow produces deterministic output', () => {
  const input = buildCanonicalInput();
  const result = canonicalFlow(input);

  assert.equal(result.note, 'No optimal path exists.');
  assert.equal(result.options.length, 3);
  assert.ok(result.temporalOrientation);
  assert.ok(result.threads.length >= 1);
  assert.ok(result.message.length > 0);
  assert.ok(result.suggestion.length > 0);
});
