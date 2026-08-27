import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type ContinuityVerificationInput,
  verifyRequestOutcomeContinuity,
} from './continuity';
import {
  createContinuitySchemaValidators,
  runContinuityCli,
  type ContinuityCliIo,
} from './continuity-cli';

const fixturePath = path.join(
  __dirname,
  'fixtures',
  'contractgraph-qa-smart-contract-continuity-v0.1.json',
);

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

describe('ContractGraph-QA smart-contract continuity compatibility', () => {
  it('accepts the CGQA-generated envelope input without extending LTP semantics', () => {
    const input = JSON.parse(
      fs.readFileSync(fixturePath, 'utf8'),
    ) as ContinuityVerificationInput;
    const validators = createContinuitySchemaValidators();

    expect(validators.validateInput(input)).toBe(true);
    expect(validators.validateInput.errors).toBeNull();

    const first = verifyRequestOutcomeContinuity(input);
    const second = verifyRequestOutcomeContinuity(
      structuredClone(input),
    );

    expect(second).toEqual(first);
    expect(first.overall_status).toBe('CONTINUOUS');
    expect(first.findings).toEqual([]);
    expect(input.requests[0].metadata?.producer).toBe('ContractGraph-QA');
    expect(
      input.outcomes[0].metadata?.canonical_finality_established,
    ).toBe(false);
  });

  it('returns stable CLI bytes and exit code 0 for the compatibility fixture', () => {
    const first = captureIo();
    const second = captureIo();

    expect(runContinuityCli([fixturePath, '--compact'], first.io)).toBe(0);
    expect(runContinuityCli([fixturePath, '--compact'], second.io)).toBe(0);
    expect(first.stderr).toEqual([]);
    expect(second.stderr).toEqual([]);
    expect(second.stdout.join('')).toBe(first.stdout.join(''));
    expect(JSON.parse(first.stdout.join('')).overall_status).toBe(
      'CONTINUOUS',
    );
  });
});
