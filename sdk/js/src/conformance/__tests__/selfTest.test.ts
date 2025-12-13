import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { buildCanonicalSelfTestFrames, resolveSelfTestMode, runSelfTest } from '../selfTest';

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

runTest('canonical self-test passes deterministically', () => {
  const first = runSelfTest();
  const second = runSelfTest();

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.report.level, 'LTP-Canonical');
  assert.equal(first.report.processedFrames, 8);
  assert.equal(first.report.receivedFrames, 10);
  assert.equal(first.report.dedupedFrames, 1);
  assert.equal(first.report.branchesCount >= 2, true);
  assert.equal(first.report.emittedFrames, 3);
  assert.deepEqual(first.report.errors, []);
  assert.equal(first.report.determinismHash, second.report.determinismHash);
  assert.equal(first.report.mode, 'calm');
});

runTest('rejects non-hello first frame', () => {
  const frames = JSON.parse(JSON.stringify(buildCanonicalSelfTestFrames()));
  frames[0] = {
    v: '0.1',
    id: 'broken-first-heartbeat',
    ts: 0,
    type: 'heartbeat',
    payload: { seq: 0, status: 'out-of-order' },
  };
  const result = runSelfTest({ frames });

  assert.equal(result.ok, false);
  assert.equal(result.report.level, 'LTP-Core');
  assert.ok(result.report.errors.some((error) => error.includes('first frame must be hello')));
});

runTest('ignores unknown frame type without throwing', () => {
  const frames = JSON.parse(JSON.stringify(buildCanonicalSelfTestFrames()));
  frames.splice(2, 0, { v: '0.1', id: 'mystery', ts: 2.5, type: 'mystery', payload: { note: 'ignore me' } });
  const result = runSelfTest({ frames });

  assert.equal(result.ok, true);
  assert.equal(result.report.processedFrames, 8);
  assert.equal(result.report.receivedFrames, 11);
});

runTest('deduplicates repeated ids to avoid side effects', () => {
  const frames = JSON.parse(JSON.stringify(buildCanonicalSelfTestFrames()));
  frames.push(frames[2]);
  const result = runSelfTest({ frames });

  assert.equal(result.ok, true);
  assert.equal(result.report.dedupedFrames >= 1, true);
  assert.equal(result.report.processedFrames, 8);
});

runTest('modes produce deterministic but distinct reports', () => {
  const calm = runSelfTest({ mode: 'calm' });
  const storm = runSelfTest({ mode: 'storm' });
  const recovery = runSelfTest({ mode: 'recovery' });

  assert.equal(calm.report.mode, 'calm');
  assert.equal(storm.report.mode, 'storm');
  assert.equal(recovery.report.mode, 'recovery');
  assert.notEqual(calm.report.determinismHash, storm.report.determinismHash);
  assert.notEqual(storm.report.determinismHash, recovery.report.determinismHash);
});

runTest('cli self-test command emits canonical report', () => {
  const cliPath = path.resolve(__dirname, '../../cli.js');
  const result = spawnSync('node', [cliPath], { encoding: 'utf-8' });

  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.level, 'LTP-Canonical');
  assert.equal(output.branches >= 2, true);
  assert.ok(typeof output.determinismHash === 'string');
  assert.equal(resolveSelfTestMode(output.mode), output.mode);
});
