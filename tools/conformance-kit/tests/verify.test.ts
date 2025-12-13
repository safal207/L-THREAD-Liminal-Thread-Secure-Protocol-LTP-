import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { normalizeFramesFromValue, readJsonFile } from '../src/utils/files';
import { verifyFrames } from '../src/verify';

const fixturesDir = path.resolve(__dirname, '../../../fixtures/conformance/v0.1');
const getFrames = (filename: string) => {
  const { value } = readJsonFile(path.join(fixturesDir, filename));
  const frames = normalizeFramesFromValue(value);
  if (!frames) throw new Error(`invalid fixture ${filename}`);
  return frames;
};

describe('LTP Conformance Kit verification', () => {
  it('produces deterministic reports with fixed timestamps', () => {
    const frames = getFrames('ok_basic_flow.json');
    const first = verifyFrames(frames, { inputName: 'ok_basic_flow.json', now: () => 1700000000000 });
    const second = verifyFrames(frames, { inputName: 'ok_basic_flow.json', now: () => 1700000000000 });

    expect(first.report).toEqual(second.report);
    expect(first.report.score).toBe(1);
    expect(first.exitCode).toBe(0);
  });

  it('classifies fixtures into ok/warn/fail buckets', () => {
    const ok = verifyFrames(getFrames('ok_basic_flow.json'));
    const warn = verifyFrames(getFrames('warn_missing_optional.json'));
    const fail = verifyFrames(getFrames('fail_wrong_version.json'));

    expect(ok.report.ok).toBe(true);
    expect(ok.report.warnings).toHaveLength(0);
    expect(warn.report.ok).toBe(true);
    expect(warn.report.warnings.length).toBeGreaterThan(0);
    expect(fail.report.ok).toBe(false);
    expect(fail.report.errors.length).toBeGreaterThan(0);
  });

  it('exposes correct exit codes from the CLI', () => {
    const cliPath = path.resolve(__dirname, '../src/cli.ts');
    const ok = spawnSync('node', ['-r', 'ts-node/register', cliPath, 'verify', path.join(fixturesDir, 'ok_basic_flow.json'), '--out', path.join(fixturesDir, 'tmp-ok.json')], {
      cwd: path.resolve(__dirname, '../../..'),
      encoding: 'utf-8',
    });
    const warn = spawnSync('node', ['-r', 'ts-node/register', cliPath, 'verify', path.join(fixturesDir, 'warn_missing_optional.json'), '--out', path.join(fixturesDir, 'tmp-warn.json')], {
      cwd: path.resolve(__dirname, '../../..'),
      encoding: 'utf-8',
    });
    const fail = spawnSync('node', ['-r', 'ts-node/register', cliPath, 'verify', path.join(fixturesDir, 'fail_wrong_version.json'), '--out', path.join(fixturesDir, 'tmp-fail.json')], {
      cwd: path.resolve(__dirname, '../../..'),
      encoding: 'utf-8',
    });

    expect(ok.status).toBe(0);
    expect(warn.status).toBe(2);
    expect(fail.status).toBe(1);

    [path.join(fixturesDir, 'tmp-ok.json'), path.join(fixturesDir, 'tmp-warn.json'), path.join(fixturesDir, 'tmp-fail.json')].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  });
});
