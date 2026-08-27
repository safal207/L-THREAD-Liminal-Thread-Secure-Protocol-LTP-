import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type ContinuityVerificationInput,
  verifyRequestOutcomeContinuity,
} from './continuity';
import {
  createContinuitySchemaValidators,
  parseContinuityCliArgs,
  runContinuityCli,
  type ContinuityCliIo,
} from './continuity-cli';

type FixtureCase = {
  case_id: string;
  input: ContinuityVerificationInput;
};

const fixtureDirectory = path.join(__dirname, 'fixtures');
const fixturePath = path.join(
  fixtureDirectory,
  'request-outcome-continuity-v0.1.json',
);
const duplicateNameFixturePath = path.join(
  fixtureDirectory,
  'duplicate-request-id.v0.1.json.txt',
);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
  cases: FixtureCase[];
};

const temporaryDirectories: string[] = [];

function fixtureInput(caseId: string): ContinuityVerificationInput {
  const entry = fixture.cases.find((candidate) => candidate.case_id === caseId);
  if (!entry) throw new Error(`fixture case not found: ${caseId}`);
  return structuredClone(entry.input);
}

function writeRawInput(raw: string): {
  directory: string;
  inputPath: string;
} {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ltp-continuity-cli-'),
  );
  temporaryDirectories.push(directory);
  const inputPath = path.join(directory, 'input.json');
  fs.writeFileSync(inputPath, raw, 'utf8');
  return { directory, inputPath };
}

function writeInput(
  input: ContinuityVerificationInput | Record<string, unknown>,
): {
  directory: string;
  inputPath: string;
} {
  return writeRawInput(`${JSON.stringify(input, null, 2)}\n`);
}

function captureIo(): {
  io: ContinuityCliIo;
  stdout: string[];
  stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    },
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('request/outcome continuity CLI', () => {
  it('parses positional input and machine-output options', () => {
    expect(
      parseContinuityCliArgs([
        '--',
        'input.json',
        '--out',
        'report.json',
        '--allow-broken',
        '--compact',
        '--schema-dir=schemas',
      ]),
    ).toEqual({
      inputPath: 'input.json',
      outputPath: 'report.json',
      schemaDir: 'schemas',
      allowBroken: true,
      compact: true,
      help: false,
    });
  });

  it('rejects unknown options and multiple input paths', () => {
    const unknown = captureIo();
    expect(runContinuityCli(['--wat'], unknown.io)).toBe(1);
    expect(unknown.stderr.join('')).toContain('unknown option: --wat');

    const multiple = captureIo();
    expect(
      runContinuityCli(['first.json', 'second.json'], multiple.io),
    ).toBe(1);
    expect(multiple.stderr.join('')).toContain(
      'multiple input paths provided',
    );
  });

  it('rejects missing, empty, and duplicate path options', () => {
    const missing = captureIo();
    expect(
      runContinuityCli(
        ['--input', '--out', 'report.json'],
        missing.io,
      ),
    ).toBe(1);
    expect(missing.stderr.join('')).toContain('--input requires a value');

    const empty = captureIo();
    expect(runContinuityCli(['input.json', '--out='], empty.io)).toBe(1);
    expect(empty.stderr.join('')).toContain('--out requires a value');

    const duplicateInput = captureIo();
    expect(
      runContinuityCli(
        ['--input=first.json', '--input=second.json'],
        duplicateInput.io,
      ),
    ).toBe(1);
    expect(duplicateInput.stderr.join('')).toContain(
      'multiple input paths provided',
    );

    const duplicateOutput = captureIo();
    expect(
      runContinuityCli(
        ['input.json', '--out=first.json', '--out=second.json'],
        duplicateOutput.io,
      ),
    ).toBe(1);
    expect(duplicateOutput.stderr.join('')).toContain(
      '--out may be provided only once',
    );
  });

  it('compiles the four schemas and validates verifier output', () => {
    const input = fixtureInput(
      'request_with_terminal_outcome_is_continuous',
    );
    const report = verifyRequestOutcomeContinuity(input);
    const validators = createContinuitySchemaValidators();

    expect(validators.validateInput(input)).toBe(true);
    expect(validators.validateInput.errors).toBeNull();
    expect(validators.validateReport(report)).toBe(true);
    expect(validators.validateReport.errors).toBeNull();
  });

  it('emits a schema-valid continuity report to stdout', () => {
    const { inputPath } = writeInput(
      fixtureInput('request_with_terminal_outcome_is_continuous'),
    );
    const captured = captureIo();

    expect(runContinuityCli([inputPath, '--compact'], captured.io)).toBe(0);
    expect(captured.stderr).toEqual([]);

    const report = JSON.parse(captured.stdout.join('')) as {
      profile: string;
      overall_status: string;
      requests: Array<{ canonical_outcome_id: string | null }>;
    };
    expect(report.profile).toBe(
      'org.ltp.request-outcome-continuity-report.v0.1',
    );
    expect(report.overall_status).toBe('CONTINUOUS');
    expect(report.requests[0].canonical_outcome_id).toBe('outcome-1');
  });

  it('rejects escaped-equivalent duplicate JSON object names before schema validation', () => {
    const raw = fs.readFileSync(duplicateNameFixturePath, 'utf8');
    const { inputPath } = writeRawInput(raw);
    const captured = captureIo();

    expect(runContinuityCli([inputPath], captured.io)).toBe(1);
    expect(captured.stdout).toEqual([]);
    expect(captured.stderr.join('')).toContain(
      'duplicate object name "request_id" at /requests/0',
    );
    expect(captured.stderr.join('')).not.toContain(
      'does not match its JSON Schema',
    );
  });

  it('returns exit code 2 for BROKEN unless explicitly allowed', () => {
    const { inputPath } = writeInput(
      fixtureInput('expired_request_without_outcome_breaks_continuity'),
    );

    const blocked = captureIo();
    expect(runContinuityCli([inputPath, '--compact'], blocked.io)).toBe(2);
    expect(JSON.parse(blocked.stdout.join('')).overall_status).toBe('BROKEN');

    const allowed = captureIo();
    expect(
      runContinuityCli(
        [inputPath, '--compact', '--allow-broken'],
        allowed.io,
      ),
    ).toBe(0);
    expect(JSON.parse(allowed.stdout.join('')).overall_status).toBe('BROKEN');
  });

  it('writes a report file without overwriting the input evidence', () => {
    const input = fixtureInput(
      'restart_retry_preserves_logical_request_identity',
    );
    const { directory, inputPath } = writeInput(input);
    const outputPath = path.join(directory, 'reports', 'continuity.json');
    const captured = captureIo();

    expect(
      runContinuityCli(
        [inputPath, '--out', outputPath, '--compact'],
        captured.io,
      ),
    ).toBe(0);
    expect(captured.stderr).toEqual([]);
    expect(captured.stdout.join('')).toContain(
      'Continuity report written:',
    );
    expect(
      JSON.parse(fs.readFileSync(outputPath, 'utf8')).overall_status,
    ).toBe('CONTINUOUS');

    const inputBefore = fs.readFileSync(inputPath, 'utf8');
    const refused = captureIo();
    expect(
      runContinuityCli([inputPath, '--out', inputPath], refused.io),
    ).toBe(1);
    expect(refused.stderr.join('')).toContain(
      'output path must refer to a different file',
    );
    expect(fs.readFileSync(inputPath, 'utf8')).toBe(inputBefore);

    const hardLinkPath = path.join(directory, 'input-hard-link.json');
    fs.linkSync(inputPath, hardLinkPath);
    const hardLinkRefused = captureIo();
    expect(
      runContinuityCli(
        [inputPath, '--out', hardLinkPath],
        hardLinkRefused.io,
      ),
    ).toBe(1);
    expect(hardLinkRefused.stderr.join('')).toContain(
      'output path must refer to a different file',
    );
    expect(fs.readFileSync(inputPath, 'utf8')).toBe(inputBefore);

    const symlinkPath = path.join(directory, 'input-symbolic-link.json');
    let symlinkAvailable = true;
    try {
      fs.symlinkSync(inputPath, symlinkPath, 'file');
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : '';
      if (
        process.platform === 'win32' &&
        (code === 'EPERM' || code === 'EACCES' || code === 'ENOTSUP')
      ) {
        symlinkAvailable = false;
      } else {
        throw error;
      }
    }

    if (symlinkAvailable) {
      const symlinkRefused = captureIo();
      expect(
        runContinuityCli(
          [inputPath, '--out', symlinkPath],
          symlinkRefused.io,
        ),
      ).toBe(1);
      expect(symlinkRefused.stderr.join('')).toContain(
        'output path must refer to a different file',
      );
      expect(fs.readFileSync(inputPath, 'utf8')).toBe(inputBefore);
    }
  });

  it('rejects structurally invalid input before semantic verification', () => {
    const input = fixtureInput(
      'request_with_terminal_outcome_is_continuous',
    ) as ContinuityVerificationInput & { unexpected?: boolean };
    input.unexpected = true;
    const { inputPath } = writeInput(input);
    const captured = captureIo();

    expect(runContinuityCli([inputPath], captured.io)).toBe(1);
    expect(captured.stdout).toEqual([]);
    expect(captured.stderr.join('')).toContain(
      'continuity input does not match its JSON Schema',
    );
    expect(captured.stderr.join('')).toContain(
      'must NOT have additional properties',
    );
  });

  it('keeps explicit-offset timestamp and DEFERRED continuation rules normative', () => {
    const timestampInput = fixtureInput(
      'request_with_terminal_outcome_is_continuous',
    );
    timestampInput.requests[0].occurred_at = '2026-08-27T10:00:00';
    const timestampFile = writeInput(timestampInput);
    const timestampResult = captureIo();

    expect(
      runContinuityCli([timestampFile.inputPath], timestampResult.io),
    ).toBe(1);
    expect(timestampResult.stderr.join('')).toContain('must match pattern');

    const deferredInput = fixtureInput(
      'durable_defer_is_not_a_silent_gap',
    );
    delete deferredInput.requests[0].continuation_id;
    const deferredFile = writeInput(deferredInput);
    const deferredResult = captureIo();

    expect(
      runContinuityCli([deferredFile.inputPath], deferredResult.io),
    ).toBe(1);
    expect(deferredResult.stderr.join('')).toContain(
      "must have required property 'continuation_id'",
    );
  });
});
