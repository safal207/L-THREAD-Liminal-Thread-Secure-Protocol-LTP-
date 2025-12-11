const assert = require('node:assert/strict');
const { describe, it } = require('vitest');
const { createOrientationShell, ORIENTATION_BASELINE } = require('../../dist');

describe('createOrientationShell', () => {
  it('returns baseline when no params passed', () => {
    const shell = createOrientationShell();
    assert.deepEqual(shell, ORIENTATION_BASELINE);
  });

  it('inherits baseline defaults when partially overridden', () => {
    const shell = createOrientationShell({ activeSectorId: 'future' });
    assert.equal(shell.activeSectorId, 'future');
    assert.equal(shell.direction, 'neutral');
    assert.equal(shell.rotation, 0);
    assert.equal(shell.confidence, 0.4);
  });
});
