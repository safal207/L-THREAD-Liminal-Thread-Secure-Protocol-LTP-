import fs from 'node:fs';
import path from 'node:path';
import { spawn, type SpawnOptions } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import type { InspectSummary } from './types';
import { execute, formatHuman, formatJson, runInspect } from './inspect';

const minimalFixture = path.join(__dirname, 'fixtures', 'minimal.frames.jsonl');
const expectedJsonPath = path.join(__dirname, 'expected', 'summary.json');
const expectedHumanOkPath = path.join(__dirname, 'expected', 'human.ok.txt');
const expectedHumanWarnPath = path.join(__dirname, 'expected', 'human.warn.txt');
const expectedHumanErrorPath = path.join(__dirname, 'expected', 'human.error.txt');
const warnFixture = path.join(__dirname, 'fixtures', 'continuity-rotated.jsonl');
const canonicalFixture = path.join(__dirname, '..', '..', 'examples', 'traces', 'canonical-linear.json');
const canonicalHumanSnapshot = path.join(__dirname, '..', '..', 'docs', 'devtools', 'inspect-output.txt');
const goldenTraceOutput = path.join(__dirname, 'fixtures', 'golden.trace_output.txt');
const invalidFixture = path.join(__dirname, 'fixtures', 'invalid-confidence.json');
const missingVersionFixture = path.join(__dirname, 'fixtures', 'missing-version.json');
const unsupportedVersionFixture = path.join(__dirname, 'fixtures', 'unsupported-version.json');
const mixedVersionsFixture = path.join(__dirname, 'fixtures', 'mixed-versions.json');
const unsortedBranchesFixture = path.join(__dirname, 'fixtures', 'unsorted-branches.json');
const sampleTrace = path.join(__dirname, '..', '..', 'samples', 'golden.trace.json');

// Canonical agent traces
const allowedCriticalTracePath = path.join(__dirname, '..', '..', 'examples', 'agents', 'allowed-critical.trace.jsonl');
const blockedCriticalTracePath = path.join(__dirname, '..', '..', 'examples', 'agents', 'blocked-critical.trace.jsonl');

// Canonical continuity fixtures
const continuityOutageFixture = path.join(__dirname, 'fixtures', 'continuity-outage.trace.jsonl');
const continuityFailureFixture = path.join(__dirname, 'fixtures', 'continuity-failure.trace.jsonl');


let builtCliPath: string | undefined;

async function runCommand(command: string, args: string[], options: SpawnOptions = {}) {
  return new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ exitCode: code ?? 0, stdout, stderr });
    });
  });
}

function transpileToDist(sourcePath: string, outPath: string): void {
  let source = fs.readFileSync(sourcePath, 'utf-8');
  // Hack: Add .js extension to relative imports for ESM execution in Node
  // Safety: check if .js is already present to avoid double extension
  source = source.replace(/(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g, (match, p1, p2, p3) => {
      if (p2.endsWith('.js')) return match;
      return p1 + p2 + '.js' + p3;
  });

  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      esModuleInterop: true,
    },
    fileName: sourcePath,
  });
  fs.writeFileSync(outPath, output.outputText, 'utf-8');
}

async function buildInspectCli(): Promise<string> {
  if (builtCliPath) return builtCliPath;
  const distDir = path.join(__dirname, '..', '..', 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf-8');
  transpileToDist(path.join(__dirname, 'inspect.ts'), path.join(distDir, 'inspect.js'));
  transpileToDist(path.join(__dirname, 'types.ts'), path.join(distDir, 'types.js'));
  transpileToDist(path.join(__dirname, 'critical_actions.ts'), path.join(distDir, 'critical_actions.js'));
  builtCliPath = path.join(distDir, 'inspect.js');
  return builtCliPath;
}

function expectNoFatal(errors: string[]) {
  expect(errors.join('\n')).not.toMatch(/(TypeError|ReferenceError|ENOENT|EACCES|Unhandled|FATAL|panic)/i);
}

function normalizeOutput(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

function normalizeInputLine(text: string): string {
  // Removes path differences in "input: ... time:"
  return text.replace(/^input: .* time:/m, 'input: <redacted>  time:');
}

describe('ltp-inspect golden summary', () => {
  it('emits stable, ordered output', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const expected = JSON.parse(fs.readFileSync(expectedJsonPath, 'utf-8'));
    const summary = runInspect(minimalFixture);
    const summaryJson = JSON.parse(JSON.stringify(summary));

    expect(summaryJson).toEqual(expected);
    expect(formatJson(summary, true)).toEqual(fs.readFileSync(expectedJsonPath, 'utf-8').trim());
    vi.useRealTimers();
  });

  it('renders human format deterministically', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const summary = runInspect(minimalFixture);
    const human = formatHuman(summary);
    const expectedHuman = fs.readFileSync(expectedHumanOkPath, 'utf-8').trim();

    expect(human.trim()).toEqual(expectedHuman);
    vi.useRealTimers();
  });

  it('matches the canonical human snapshot output', () => {
    const logs: string[] = [];
    const errors: string[] = [];
    vi.stubEnv('LTP_INSPECT_FROZEN_TIME', '2024-01-01T00:00:00.000Z');
    try {
      const exitCode = execute(['trace', '--input', canonicalFixture, '--format=human', '--color=never'], {
        log: (message) => logs.push(message),
        error: (message) => errors.push(message),
      });

      expect(exitCode).toBe(1);
      expectNoFatal(errors);
      expect(normalizeOutput(logs.join('\n'))).toEqual(fs.readFileSync(canonicalHumanSnapshot, 'utf-8').trim());
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('renders golden sample deterministically', () => {
    const logs: string[] = [];
    const errors: string[] = [];
    vi.stubEnv('LTP_INSPECT_FROZEN_TIME', '2025-12-24T22:08:59.315Z');

    try {
      const exitCode = execute(['trace', '--input', sampleTrace, '--format=human', '--color=never'], {
        log: (message) => logs.push(message),
        error: (message) => errors.push(message),
      });

      expect(exitCode).toBe(0);
      expectNoFatal(errors);

      let expected = normalizeOutput(fs.readFileSync(goldenTraceOutput, 'utf-8'));
      let actual = normalizeOutput(logs.join('\n'));
      expected = normalizeInputLine(expected);
      actual = normalizeInputLine(actual);
      expect(actual).toEqual(expected);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('returns exit code 2 for missing input', () => {
    const missingPath = path.join(__dirname, 'fixtures', 'does-not-exist.jsonl');
    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['trace', '--input', missingPath], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(2);
    expect(errors.join('\n')).toContain('ERROR: Frame log not found');
  });

  it('returns exit code 2 for contract violations (invalid confidence)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['trace', '--input', invalidFixture, '--format=human', '--color=never'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(2);
    expect(errors.join('\n')).toContain('Contract violation');
    expect(normalizeOutput(logs.join('\n'))).toEqual(fs.readFileSync(expectedHumanErrorPath, 'utf-8').trim());
    vi.useRealTimers();
  });

  it('returns exit code 1 for degraded continuity', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['trace', '--input', warnFixture, '--format=human', '--color=never'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(1);
    expectNoFatal(errors);
    expect(normalizeOutput(logs.join('\n'))).toEqual(fs.readFileSync(expectedHumanWarnPath, 'utf-8').trim());
    vi.useRealTimers();
  });

  it('returns exit code 1 for normalized output in non-strict mode', () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['trace', '--input', unsortedBranchesFixture], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(1);
    expect(errors.join('\n')).toContain('normalized output (non-canonical input)');
  });

  it('fails loudly when trace version is missing', () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['trace', '--input', missingVersionFixture, '--format=human', '--color=never'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(2);
    expect(errors.join('\n')).toContain('missing trace version');
  });

  it('fails loudly for mixed trace versions', () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['trace', '--input', mixedVersionsFixture, '--format=human', '--color=never'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(2);
    expect(errors.join('\n')).toContain('mixed trace versions detected');
  });

  it('fails loudly for unsupported versions', () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['trace', '--input', unsupportedVersionFixture, '--format=human', '--color=never'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(2);
    expect(errors.join('\n')).toContain('unsupported trace version');
  });

  it('treats canonical gaps as contract violations in strict mode', () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['trace', '--input', unsortedBranchesFixture, '--strict'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(2);
    expect(errors.join('\n')).toContain('non-canonical input');
  });

  it('detects critical action violations in agents compliance mode', () => {
    if (!fs.existsSync(allowedCriticalTracePath)) return;

    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['trace', '--input', allowedCriticalTracePath, '--profile', 'agents', '--format=json'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(2);
    expectNoFatal(errors);

    const output = JSON.parse(logs.join('\n')) as any;
    expect(output.audit_summary.verdict).toBe('FAIL');
    expect(Array.isArray(output.audit_summary.violations)).toBe(true);
    expect(output.audit_summary.violations.some((v: any) => v.rule_id === 'AGENTS.CRIT.WEB_DIRECT')).toBe(true);
    expect(output.compliance.trace_integrity).toBe('verified');
  });

  it('verifies safe agent trace passes checks', () => {
    if (!fs.existsSync(blockedCriticalTracePath)) return;

    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['trace', '--input', blockedCriticalTracePath, '--profile', 'agents', '--format=json'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    // PASS, but warnings allowed -> 0 or 1
    expect([0, 1]).toContain(exitCode);
    expectNoFatal(errors);

    const output = JSON.parse(logs.join('\n')) as any;
    expect(output.audit_summary.verdict).toBe('PASS');
    expect(output.compliance.trace_integrity).toBe('verified');
  });

  it('fails compliance if trace integrity is unchecked (strict enforcement)', () => {
    // minimalFixture is raw frames, so it will be loaded as 'raw' and integrity will be 'unchecked'
    const logs: string[] = [];
    const errors: string[] = [];

    const exitCode = execute(['trace', '--input', minimalFixture, '--profile', 'fintech'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    // Should fail because integrity is 'unchecked' but profile is active
    expect(exitCode).toBe(2);
    const output = logs.join('\n');
    const errOutput = errors.join('\n');

    // Check for audit summary failure
    expect(output).toContain('VERDICT: FAIL');
    expect(output).toContain('CORE.INTEGRITY');

    // Check for CLI error reporting in stderr
    expect(errOutput).toContain('TRACE INTEGRITY ERROR: unchecked');
  });

  it('visualizes continuity routing correctly for outage scenario', () => {
    if (!fs.existsSync(continuityOutageFixture)) {
      throw new Error(`Continuity outage fixture missing at ${continuityOutageFixture}`);
    }

    const logs: string[] = [];
    const errors: string[] = [];

    const exitCode = execute(['trace', '--input', continuityOutageFixture, '--format=human', '--color=never', '--continuity'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    // warnings possible (normalization/snaps), but not violation
    expect([0, 1]).toContain(exitCode);
    expectNoFatal(errors);
    const output = normalizeOutput(logs.join('\n'));

    expect(output).toContain('CONTINUITY ROUTING INSPECTION');
    expect(output).toContain('System Remained Coherent: YES');
    expect(output).toMatch(/State Transitions Observed:\s*HEALTHY\s*->\s*FAILED\s*->\s*HEALTHY/i);
    expect(output).toMatch(/Routing Decisions:\s+Executed=\d+\s+Deferred=\d+\s+Replayed=\d+\s+Frozen=\d+/);
  });

  it('detects continuity failure (non-strict = warning)', () => {
    if (!fs.existsSync(continuityFailureFixture)) {
      throw new Error(`Continuity failure fixture missing at ${continuityFailureFixture}`);
    }

    const logs: string[] = [];
    const errors: string[] = [];

    const exitCode = execute(['trace', '--input', continuityFailureFixture, '--format=human', '--color=never', '--continuity'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(1);
    expectNoFatal(errors);

    const output = normalizeOutput(logs.join('\n'));
    expect(output).toContain('CONTINUITY ROUTING INSPECTION');
    expect(output).toContain('System Remained Coherent: NO');
    expect(output).toMatch(/First Unsafe Transition:\s*#\d+/i);
    expect(output).toMatch(/transfer_money/i);
  });

  it('detects continuity failure (strict = violation)', () => {
    if (!fs.existsSync(continuityFailureFixture)) return;

    const logs: string[] = [];
    const errors: string[] = [];

    const exitCode = execute(
      ['trace', '--input', continuityFailureFixture, '--format=human', '--color=never', '--continuity', '--strict'],
      { log: (m) => logs.push(m), error: (m) => errors.push(m) }
    );

    expect(exitCode).toBe(2);
    expectNoFatal(errors);

    const output = normalizeOutput(logs.join('\n'));
    expect(output).toContain('System Remained Coherent: NO');
    expect(output).toMatch(/Continuity Violation:/i);
  });
});

describe('ltp inspect cli', () => {
  it('boots without crashing', async () => {
    const distPath = await buildInspectCli();
    const result = await runCommand('node', [distPath, 'trace', sampleTrace], {
      env: { ...process.env, LTP_INSPECT_FROZEN_TIME: '2024-01-01T00:00:00.000Z', LTP_INSPECT_TEST_RUN: '1' },
    });

    // Accept 0 (clean) or 1 (warnings)
    expect([0, 1]).toContain(result.exitCode);
    expect(result.stdout.toLowerCase()).toContain('orientation');
  });
});
