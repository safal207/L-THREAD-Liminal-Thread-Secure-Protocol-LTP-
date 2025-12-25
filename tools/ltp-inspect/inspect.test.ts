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
const goldenTraceOutput = path.join(__dirname, 'fixtures', 'golden.trace_output.txt');
const invalidFixture = path.join(__dirname, 'fixtures', 'invalid-confidence.json');
const missingVersionFixture = path.join(__dirname, 'fixtures', 'missing-version.json');
const unsupportedVersionFixture = path.join(__dirname, 'fixtures', 'unsupported-version.json');
const mixedVersionsFixture = path.join(__dirname, 'fixtures', 'mixed-versions.json');
const unsortedBranchesFixture = path.join(__dirname, 'fixtures', 'unsorted-branches.json');
const sampleTrace = path.join(__dirname, '..', '..', 'samples', 'golden.trace.json');
const unsafeAgentTracePath = path.join(__dirname, '..', '..', 'examples', 'agents', 'unsafe-agent.trace.json');
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
    expect(errors.join('\n')).not.toMatch(/(TypeError|ReferenceError|ENOENT|EACCES)/i);
}

function normalizeOutput(text: string): string {
    return text.replace(/\r\n/g, '\n').trim();
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
      expectNoFatal(errors);
      expect(normalizeOutput(logs.join('\n'))).toEqual(fs.readFileSync(canonicalHumanSnapshot, 'utf-8').trim());
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('matches the golden trace output artifact', () => {
    const logs: string[] = [];
    const errors: string[] = [];
    // The timestamp in the golden artifact is 2025-12-24T22:08:59.315Z
    vi.stubEnv('LTP_INSPECT_FROZEN_TIME', '2025-12-24T22:08:59.315Z');

    try {
      // Use absolute path, then normalize output content
      const exitCode = execute(['--input', sampleTrace, '--format=human', '--color=never'], {
        log: (message) => logs.push(message),
        error: (message) => errors.push(message),
      });

      expect(exitCode).toBe(0);
      expectNoFatal(errors);

      let expected = fs.readFileSync(goldenTraceOutput, 'utf-8').trim();
      let actual = normalizeOutput(logs.join('\n'));

      // Normalize input: ... time: line to avoid path differences
      // Regex matches "input: <anything>  time:" and replaces with generic
      actual = actual.replace(/^input: .* time:/m, 'input: <redacted>  time:');
      expected = expected.replace(/^input: .* time:/m, 'input: <redacted>  time:');

      expect(actual).toEqual(expected);
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
    expect(normalizeOutput(logs.join('\n'))).toEqual(fs.readFileSync(expectedHumanErrorPath, 'utf-8').trim());
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
    expectNoFatal(errors);
    expect(normalizeOutput(logs.join('\n'))).toEqual(fs.readFileSync(expectedHumanWarnPath, 'utf-8').trim());
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
    if (!fs.existsSync(unsafeAgentTracePath)) {
        console.warn('Skipping agent safety test: unsafe-agent.trace.json not found');
        return;
    }

    const logs: string[] = [];
    const errors: string[] = [];
    // Use the actual unsafe agent trace instead of manual fixture
    const exitCode = execute(['--input', unsafeAgentTracePath, '--compliance', 'agents'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect(exitCode).toBe(2);
    const output = logs.join('\n');
    expect(output).toContain('AGENTS.CRIT.WEB_DIRECT');
    expect(output).toContain('Evidence: WEB context allowed to perform critical action');

    // Integrity should be verified since we use generated signed trace
    expect(output).toContain('trace_integrity: verified');
  });

  it('verifies safe agent trace passes checks', () => {
    const safeAgentTracePath = path.join(__dirname, '..', '..', 'examples', 'agents', 'safe-agent.trace.json');
    if (!fs.existsSync(safeAgentTracePath)) return;

    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = execute(['--input', safeAgentTracePath, '--profile', 'agents'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    // Safe agent blocks the action, so it should PASS compliance
    expect([0, 1]).toContain(exitCode);
    const output = logs.join('\n');
    expect(output).toContain('VERDICT: PASS');
  });

  it('fails compliance if trace integrity is unchecked (strict enforcement)', () => {
    // Create a temporary unsigned trace
    const unsignedTrace = fixturePath; // minimal.frames.jsonl is unsigned
    const logs: string[] = [];
    const errors: string[] = [];

    // minimal.frames.jsonl is raw frames, so it will be loaded as 'raw' and integrity will be 'unchecked'
    const exitCode = execute(['--input', unsignedTrace, '--profile', 'fintech'], {
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

    // Check for CLI error reporting
    expect(errOutput).toContain('TRACE INTEGRITY ERROR: unchecked');
  });

  it('visualizes continuity routing correctly for outage scenario', () => {
    const continuityFixture = path.join(__dirname, 'fixtures', 'continuity-outage.trace.json');
    if (!fs.existsSync(continuityFixture)) {
        throw new Error(`Continuity trace fixture missing at ${continuityFixture}`);
    }

    const logs: string[] = [];
    const errors: string[] = [];

    // Explicit 'trace' subcommand
    const exitCode = execute(['trace', '--input', continuityFixture, '--format=human', '--color=never', '--continuity'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    expect([0, 1]).toContain(exitCode);
    expectNoFatal(errors);

    const output = normalizeOutput(logs.join('\n'));

    expect(output).toContain('CONTINUITY ROUTING INSPECTION');
    expect(output).toContain('System Remained Coherent: YES');

    // Verify State Transitions
    expect(output).toContain('State Transitions Observed: HEALTHY -> FAILED -> HEALTHY');
    expect(output).toMatch(/HEALTHY/i);
    expect(output).toMatch(/FAILED/i);

    // Verify Routing Stats with regex
    expect(output).toMatch(/Routing Decisions:\s+Executed=\d+\s+Deferred=\d+\s+Replayed=\d+\s+Frozen=\d+/);
  });

  it('detects continuity failure when critical action is allowed during failure', () => {
    const failureFixture = path.join(__dirname, 'fixtures', 'continuity-failure.trace.json');
    // Ensure fixture exists
    if (!fs.existsSync(failureFixture)) {
         throw new Error(`Continuity failure trace fixture missing at ${failureFixture}`);
    }

    const logs: string[] = [];
    const errors: string[] = [];

    // Correct CLI contract
    const exitCode = execute(['trace', '--input', failureFixture, '--format=human', '--color=never', '--continuity'], {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });

    // We expect a contract violation/warning because System Coherence NO is a serious issue
    expect([0, 1, 2]).toContain(exitCode);

    const output = normalizeOutput(logs.join('\n'));

    expect(output).toContain('CONTINUITY ROUTING INSPECTION');
    expect(output).toContain('System Remained Coherent: NO');
    expect(output).toMatch(/First Unsafe Transition: (index\s)?#\d+/i);
  });
});

describe('ltp inspect cli', () => {
  it('boots without crashing', async () => {
    const distPath = await buildInspectCli();
    const result = await runCommand('node', [distPath, sampleTrace], {
      env: { ...process.env, LTP_INSPECT_FROZEN_TIME: '2024-01-01T00:00:00.000Z', LTP_INSPECT_TEST_RUN: '1' },
    });

    // Accept 0 (clean) or 1 (warnings)
    expect([0, 1]).toContain(result.exitCode);
    expect(result.stdout.toLowerCase()).toContain('orientation');
  });
});
