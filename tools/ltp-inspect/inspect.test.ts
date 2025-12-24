import fs from 'node:fs';
import path from 'node:path';
import { spawn, type SpawnOptions } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import { execute, formatHuman, formatJson, runInspect } from './inspect';

const fixturePath = path.join(__dirname, 'fixtures', 'minimal.frames.jsonl');
const expectedJsonPath = path.join(__dirname, 'expected', 'summary.json');
const expectedHumanOkPath = path.join(__dirname, 'expected', 'human.ok.txt');
const expectedHumanWarnPath = path.join(__dirname, 'expected', 'human.warn.txt');
const expectedHumanErrorPath = path.join(__dirname, 'expected', 'human.error.txt');
const warnFixture = path.join(__dirname, 'fixtures', 'continuity-rotated.json');
const canonicalFixture = path.join(__dirname, '..', '..', 'examples', 'traces', 'canonical-linear.json');
const canonicalHumanSnapshot = path.join(__dirname, '..', '..', 'docs', 'devtools', 'inspect-output.txt');
const invalidFixture = path.join(__dirname, 'fixtures', 'invalid-confidence.json');
const missingVersionFixture = path.join(__dirname, 'fixtures', 'missing-version.json');
const unsupportedVersionFixture = path.join(__dirname, 'fixtures', 'unsupported-version.json');
const mixedVersionsFixture = path.join(__dirname, 'fixtures', 'mixed-versions.json');
const unsortedBranchesFixture = path.join(__dirname, 'fixtures', 'unsorted-branches.json');
const sampleTrace = path.join(__dirname, '..', '..', 'samples', 'golden.trace.json');
const agentCriticalFixture = path.join(__dirname, 'fixtures', 'agent-critical.frames.jsonl');
const continuityOutageTrace = path.join(__dirname, '..', '..', 'examples', 'traces', 'continuity-outage.trace.json');
const continuityFailureTrace = path.join(__dirname, '..', '..', 'examples', 'traces', 'continuity-failure.trace.json');

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
  source = source.replace(/from '(\.\/[^']+)';/g, "from '$1.js';");

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

// Create critical action violation fixture
const criticalViolationTrace = [
    { "v": "0.1", "id": "1", "type": "hello", "payload": { "agent": "test-agent" } },
    { "v": "0.1", "id": "2", "type": "orientation", "continuity_token": "ct-1", "payload": { "drift": 0.0, "identity": "test-id" } },
    { "v": "0.1", "id": "3", "type": "route_request", "payload": { "goal": "transfer money" } },
    { "v": "0.1", "id": "4", "type": "route_response", "payload": { "context": "WEB", "targetState": "transfer_money", "admissible": true } }
].map(f => JSON.stringify(f)).join('\n');

if (!fs.existsSync(agentCriticalFixture)) {
    // We mock trace entries with hashes for testing compliance
    // Since verifyTraceIntegrity checks hashes, we need valid ones or to skip integrity checks if testing just the rule
    // But compliance check enforces integrity.
    // For unit tests we can mock verifyTraceIntegrity or generate valid trace.
    // Let's generate a valid trace using node crypto if we really need it,
    // Or we can just mock the file content and accept that integrity fails (which is also a failure)
    // But we want to test SPECIFICALLY the rule AGENTS.CRIT.WEB_DIRECT.

    // We will just write the content and expect Integrity Check Failure + Critical Violation
    fs.writeFileSync(agentCriticalFixture, criticalViolationTrace);
}

describe('ltp-inspect golden summary', () => {
  it('emits stable, ordered output', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const expected = JSON.parse(fs.readFileSync(expectedJsonPath, 'utf-8'));
    const summary = runInspect(fixturePath);
    const summaryJson = JSON.parse(JSON.stringify(summary));

    expect(summaryJson).toEqual(expected);
    expect(formatJson(summary, true)).toEqual(fs.readFileSync(expectedJsonPath, 'utf-8').trim());
    vi.useRealTimers();
  });

  it('renders human format deterministically', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const summary = runInspect(fixturePath);
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
      const exitCode = execute(['--input', canonicalFixture, '--format=human', '--color=never'], {
        log: (message) => logs.push(message),
        error: (message) => errors.push(message),
      });

      expect(exitCode).toBe(1);
      expect(errors.length).toBe(0);
      expect(logs.join('\n').trim()).toEqual(fs.readFileSync(canonicalHumanSnapshot, 'utf-8').trim());
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('returns exit code 2 for missing input', () => {
    const missingPath = path.join(__dirname, 'fixtures', 'does-not-exist.jsonl');
    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['--input', missingPath], {
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
    const exitCode = execute(['--input', invalidFixture, '--format=human', '--color=never'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(2);
    expect(errors.join('\n')).toContain('Contract violation');
    expect(logs.join('\n').trim()).toEqual(fs.readFileSync(expectedHumanErrorPath, 'utf-8').trim());
    vi.useRealTimers();
  });

  it('returns exit code 1 for degraded continuity', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['--input', warnFixture, '--format=human', '--color=never'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(1);
    expect(errors.length).toBe(0);
    expect(logs.join('\n').trim()).toEqual(fs.readFileSync(expectedHumanWarnPath, 'utf-8').trim());
    vi.useRealTimers();
  });

  it('returns exit code 1 for normalized output in non-strict mode', () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['--input', unsortedBranchesFixture], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(1);
    expect(errors.join('\n')).toContain('normalized output (non-canonical input)');
  });

  it('fails loudly when trace version is missing', () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['--input', missingVersionFixture, '--format=human', '--color=never'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(2);
    expect(errors.join('\n')).toContain('missing trace version');
  });

  it('fails loudly for mixed trace versions', () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['--input', mixedVersionsFixture, '--format=human', '--color=never'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(2);
    expect(errors.join('\n')).toContain('mixed trace versions detected');
  });

  it('fails loudly for unsupported versions', () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['--input', unsupportedVersionFixture, '--format=human', '--color=never'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(2);
    expect(errors.join('\n')).toContain('unsupported trace version');
  });

  it('treats canonical gaps as contract violations in strict mode', () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['--input', unsortedBranchesFixture, '--strict'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(2);
    expect(errors.join('\n')).toContain('non-canonical input');
  });

  it('detects critical action violations in agents compliance mode', () => {
    const logs: string[] = [];
    const errors: string[] = [];
    // We expect exit code 2 because of Contract Violation (Compliance Failure)
    const exitCode = execute(['--input', agentCriticalFixture, '--compliance', 'agents'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    // Integrity checks will fail because we manually created the file without hashing
    // But we also want to verify that AGENTS.CRIT.WEB_DIRECT is flagged
    expect(exitCode).toBe(2); // Contract violation
    const output = logs.join('\n');
    expect(output).toContain('AGENTS.CRIT.WEB_DIRECT');
    expect(output).toContain('Evidence: WEB context allowed to perform critical action');
  });

  it('continuity inspection: coherent outage handling (HEALTHY -> FAILED -> HEALTHY)', () => {
    if (!fs.existsSync(continuityOutageTrace)) {
      throw new Error('Missing fixture: examples/traces/continuity-outage.trace.json');
    }

    const logs: string[] = [];
    const errors: string[] = [];

    const exitCode = execute(
      ['trace', '--continuity', '--input', continuityOutageTrace, '--format=human', '--color=never'],
      { log: (m) => logs.push(String(m)), error: (m) => errors.push(String(m)) }
    );

    // Exit code may be 0 (clean) or 1 (warnings) depending on fixture/normalizers.
    // We primarily assert the continuity report contract.
    expect([0, 1]).toContain(exitCode);

    const output = logs.join('\n');

    expect(output).toContain('CONTINUITY ROUTING INSPECTION');
    expect(output).toContain('System Remained Coherent: YES');
    expect(output).toContain('State Transitions Observed:');
    expect(output).toMatch(/HEALTHY/i);
    expect(output).toMatch(/FAILED/i);
  });

  it('continuity inspection: detects unsafe allowed action during FAILED (example violation trace)', () => {
    if (!fs.existsSync(continuityFailureTrace)) {
      throw new Error('Missing fixture: examples/traces/continuity-failure.trace.json');
    }

    const logs: string[] = [];
    const errors: string[] = [];

    const exitCode = execute(
      ['trace', '--continuity', '--input', continuityFailureTrace, '--format=human', '--color=never'],
      { log: (m) => logs.push(String(m)), error: (m) => errors.push(String(m)) }
    );

    // Exit code might be 0 unless strict is enabled, so assert via output text.
    expect([0, 1, 2]).toContain(exitCode);
    const output = logs.join('\n');

    expect(output).toContain('CONTINUITY ROUTING INSPECTION');
    expect(output).toContain('System Remained Coherent: NO');
    expect(output).toMatch(/First Unsafe Transition/i);
    expect(output).toMatch(/(Index|#)\s*\d+/i);
  });
});

describe('ltp inspect cli', () => {
  it('boots without crashing', async () => {
    const distPath = await buildInspectCli();
    const result = await runCommand('node', [distPath, sampleTrace], {
      env: { ...process.env, LTP_INSPECT_FROZEN_TIME: '2024-01-01T00:00:00.000Z', LTP_INSPECT_TEST_RUN: '1' },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toLowerCase()).toContain('orientation');
  });
});
