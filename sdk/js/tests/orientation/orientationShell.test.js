const assert = require('node:assert/strict');
const { createOrientationShell, ORIENTATION_BASELINE } = require('../../dist');

function runTest(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`✔ ${name}`))
    .catch((error) => {
      console.error(`✖ ${name}`);
      console.error(error);
      process.exitCode = 1;
    });
}

runTest('baseline is returned when no params passed', () => {
  const shell = createOrientationShell();
  assert.deepEqual(shell, ORIENTATION_BASELINE);
});

runTest('partial override inherits baseline defaults', () => {
  const shell = createOrientationShell({ activeSectorId: 'future' });
  assert.equal(shell.activeSectorId, 'future');
  assert.equal(shell.direction, 'neutral');
  assert.equal(shell.rotation, 0);
  assert.equal(shell.confidence, 0.4);
});
