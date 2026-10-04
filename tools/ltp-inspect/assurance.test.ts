import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../../docs/contracts/ltp-inspect.v1.schema.json';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { execute, formatHuman } from './inspect';
import type { LtpFrame } from './types';

const ajv = new Ajv({ strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
const directories: string[] = [];
afterEach(() => {
  process.exitCode = 0;
  vi.restoreAllMocks();
  directories.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});
const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) :
  v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v;
const frames = (): LtpFrame[] => [
  { v: '0.1', type: 'orientation', id: 'a', identity: 'alice', continuity_token: 'ct' },
  { v: '0.1', type: 'focus_snapshot', id: 'b', payload: { drift: 0.1 }, continuity_token: 'ct' },
  { v: '0.1', type: 'route_response', id: 'c', payload: { branches: [{ id: 'safe', confidence: 1, status: 'admissible' }] }, continuity_token: 'ct' },
];
function fixture(input = frames(), signature?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ltp-assurance-'));
  directories.push(dir);
  let prev = '0'.repeat(64);
  const entries = input.map((frame, i) => {
    const hash = crypto.createHash('sha256').update(prev + JSON.stringify(canonical(frame))).digest('hex');
    const entry = { i, frame, prev_hash: prev, hash, signature, key_id: signature ? 'untrusted' : undefined };
    prev = hash;
    return entry;
  });
  const file = path.join(dir, 'trace.jsonl');
  fs.writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return file;
}
function run(file: string, extra: string[] = []) {
  const stdout: string[] = [], stderr: string[] = [];
  const exit = execute(['trace', '--input', file, '--profile', 'agents', '--format=json', ...extra],
    { log: (s) => stdout.push(s), error: (s) => stderr.push(s) });
  const report = JSON.parse(stdout.join('\n'));
  expect(validate(report), JSON.stringify(validate.errors)).toBe(true);
  return { exit, stderr: stderr.join('\n'), report };
}

describe('inspection assurance boundaries', () => {
  it.each([undefined, 'NOT-A-VALID-ED25519-SIGNATURE'])('never certifies signature %s without trusted keys', (sig) => {
    const { report, exit } = run(fixture(frames(), sig));
    expect(exit).toBe(1);
    expect(report.compliance.trace_integrity).toBe('verified');
    expect(report.compliance.signatures).toMatchObject({ present: Boolean(sig), valid: null, verification: sig ? 'unchecked' : 'absent' });
    expect(report.compliance.identity_authentication).toBe('unchecked');
    expect(report.compliance.replay_determinism).toBe('unchecked');
    expect(report.audit_summary).toMatchObject({ verdict: 'INCOMPLETE', regulator_ready: false });
    expect(formatHuman(report)).not.toContain('signatures: verified valid=true');
    expect(formatHuman(report)).toContain('VERDICT: INCOMPLETE');
  });
  it('verifies trusted Ed25519 signatures over the raw 32-byte entry hash', () => {
    const file = fixture();
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const entries = fs.readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    for (const entry of entries) {
      entry.key_id = 'trusted-test';
      entry.alg = 'ed25519';
      entry.signature = crypto.sign(null, Buffer.from(entry.hash, 'hex'), privateKey).toString('base64');
    }
    fs.writeFileSync(file, entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n');
    const keyring = path.join(path.dirname(file), 'trusted-keys.json');
    fs.writeFileSync(keyring, JSON.stringify({ keys: [{
      key_id: 'trusted-test',
      alg: 'ed25519',
      public_key_pem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    }] }));
    const { report, exit } = run(file, ['--trusted-keys', keyring]);
    expect(exit).toBe(1);
    expect(report.compliance.signatures).toMatchObject({ valid: true, verification: 'verified', checked_entries: 3 });
    expect(report.audit_summary.verdict).toBe('INCOMPLETE');
    expect(report.audit_summary.unchecked_checks).not.toContain('signature_verification');
  });
  it('fails a forged Ed25519 signature when a trusted keyring is supplied', () => {
    const file = fixture();
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const entries = fs.readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    for (const entry of entries) {
      entry.key_id = 'trusted-test';
      entry.alg = 'ed25519';
      entry.signature = crypto.sign(null, Buffer.from(entry.hash, 'hex'), privateKey).toString('base64');
    }
    entries[1].signature = Buffer.alloc(64, 7).toString('base64');
    fs.writeFileSync(file, entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n');
    const keyring = path.join(path.dirname(file), 'trusted-keys.json');
    fs.writeFileSync(keyring, JSON.stringify({ keys: [{
      key_id: 'trusted-test',
      alg: 'ed25519',
      public_key_pem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    }] }));
    const { report, exit, stderr } = run(file, ['--trusted-keys', keyring]);
    expect(exit).toBe(2);
    expect(stderr).toContain('SIGNATURE VERIFICATION FAILED');
    expect(report.compliance.signatures).toMatchObject({
      valid: false,
      verification: 'failed',
      failure_index: 1,
      failure_reason: 'Ed25519 verification failed',
    });
    expect(report.audit_summary.verdict).toBe('FAIL');
    expect(report.audit_summary.failed_checks).toContain('signature_verification');
  });
  it('does not treat a payload record ID as authenticated identity', () => {
    const input = frames();
    input.forEach((f) => { delete f.identity; delete f.continuity_token; });
    input[0].payload = { id: 'record-id' };
    expect(run(fixture(input)).report.compliance.identity_binding).toBe('violated');
  });
  it('does not certify replay when orientation is absent', () => {
    const { report } = run(fixture(frames().slice(1)));
    expect(report.compliance.replay_determinism).toBe('unchecked');
  });
  it.each(['changed', 'missing', 'conflicting', 'token-rotation'])('rejects %s identity declarations', (kind) => {
    const input = frames();
    if (kind === 'changed') input[2].identity = 'mallory';
    if (kind === 'conflicting') input[0].payload = { identity: 'mallory' };
    if (kind === 'token-rotation') input[2].continuity_token = 'different';
    if (kind === 'missing') input.forEach((f) => { delete f.identity; delete f.continuity_token; });
    const { report, exit } = run(fixture(input));
    expect(exit).toBe(2);
    expect(report.compliance.identity_binding).toBe('violated');
    expect(report.audit_summary.verdict).toBe('FAIL');
  });
  it.each(['version', 'continuity', 'normalization'])('keeps JSON, human, export and exit consistent for %s errors', (kind) => {
    const input = frames();
    let extra: string[] = [];
    if (kind === 'version') input[1].v = '999';
    if (kind === 'continuity') {
      input[0].payload = { status: 'FAILED' };
      input[2].payload = { targetState: 'transfer_money', context: 'SYSTEM', admissible: true, capabilities: ['CAPABILITY_TRANSFER_MONEY'] };
      extra = ['--continuity', '--strict'];
    }
    if (kind === 'normalization') { input[0].constraints = ['safe'] as any; extra = ['--strict']; }
    const file = fixture(input);
    vi.spyOn(process, 'cwd').mockReturnValue(path.dirname(file));
    const { report, exit, stderr } = run(file, [...extra, '--export', 'json']);
    expect(exit).toBe(2);
    expect(stderr).toContain('Contract violation');
    expect(report.audit_summary).toMatchObject({ verdict: 'FAIL', regulator_ready: false });
    expect(report.audit_summary.failed_checks).toContain('contract');
    expect(formatHuman(report)).toContain('VERDICT: FAIL');
    expect(JSON.parse(fs.readFileSync(path.join(path.dirname(file), 'trace_compliance.json'), 'utf8'))).toEqual(report);
  });
  it('rejects a broken hash chain in trace and replay', () => {
    const file = fixture();
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('"drift":0.1', '"drift":0.9'));
    expect(run(file).exit).toBe(2);
    const errors: string[] = [];
    expect(execute(['replay', '--input', file], { log: () => {}, error: (s) => errors.push(s) })).toBe(2);
    expect(errors.join('\n')).toContain('TRACE INTEGRITY ERROR');
  });
  it('preserves the WEB critical-action rejection alongside incomplete safe evidence', () => {
    const input = frames();
    input[2].payload = { context: 'WEB', targetState: 'transfer_money', admissible: false };
    expect(run(fixture(input)).report.audit_summary.verdict).toBe('INCOMPLETE');
    input[2].payload.admissible = true;
    const { report, exit } = run(fixture(input));
    expect(exit).toBe(2);
    expect(report.audit_summary.violations.some((v: any) => v.rule_id === 'AGENTS.CRIT.WEB_DIRECT')).toBe(true);
  });
  it('accepts the leading pnpm separator and labels recorded playback', () => {
    const logs: string[] = [];
    expect(execute(['--', 'replay', '--input', fixture()], { log: (s) => logs.push(s), error: () => {} })).toBe(0);
    expect(logs.join('\n')).toContain('Recorded playback only; no execution recomputation');
  });
  it('rejects malformed lines and missing files in the secondary playback CLI', () => {
    const file = fixture();
    fs.appendFileSync(file, 'INVALID JSON\n');
    for (const input of [file, `${file}.missing`]) {
      expect(execute(['trace', '--trace', input, '--replay'], { log: () => {}, error: () => {} })).toBe(2);
    }
  });
});
