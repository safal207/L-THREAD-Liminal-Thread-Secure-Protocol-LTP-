import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { execute } from '../inspect';

export type MatrixOutputAssertions = {
  includes?: string[];
  matches?: string[];
  notMatches?: string[];
  json?: Record<string, unknown>;
};

export type MatrixCase = {
  id: string;
  args: string[];
  expectExit: number | number[];
  stdout?: MatrixOutputAssertions;
  stderr?: MatrixOutputAssertions;
  stdin?: string;
  notes?: string;
  tags?: string[];
};

export type MatrixDefinition = {
  cases: MatrixCase[];
};

const fatalRegex = /(TypeError|ReferenceError|ENOENT|EACCES|Unhandled|FATAL|panic)/i;

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function getByPath(source: unknown, pathKey: string): unknown {
  return pathKey.split('.').reduce((acc: unknown, segment) => {
    if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);
}

function assertJsonExpectations(payload: unknown, expectations: Record<string, unknown>): void {
  Object.entries(expectations).forEach(([key, expected]) => {
    const actual = getByPath(payload, key);
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      const descriptor = expected as Record<string, unknown>;
      if (descriptor.__present === true) {
        expect(actual).not.toBeUndefined();
        return;
      }
      if (typeof descriptor.__type === 'string') {
        expect(typeof actual).toBe(descriptor.__type);
        return;
      }
    }
    expect(actual).toEqual(expected);
  });
}

function assertTextExpectations(text: string, expectations: MatrixOutputAssertions | undefined): void {
  if (!expectations) return;
  const normalized = normalizeText(text);
  expectations.includes?.forEach((snippet) => {
    expect(normalized).toContain(snippet);
  });
  expectations.matches?.forEach((pattern) => {
    expect(normalized).toMatch(new RegExp(pattern));
  });
  expectations.notMatches?.forEach((pattern) => {
    expect(normalized).not.toMatch(new RegExp(pattern));
  });
  if (expectations.json) {
    const parsed = JSON.parse(normalized);
    assertJsonExpectations(parsed, expectations.json);
  }
}

export function loadMatrix(filePath = path.join(__dirname, '..', 'TEST_MATRIX.json')): MatrixDefinition {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as MatrixDefinition;
}

export function runMatrixCase(testCase: MatrixCase): void {
  const logs: string[] = [];
  const errors: string[] = [];

  let exitCode = 3;
  try {
    exitCode = execute(
      testCase.args,
      {
        log: (message) => logs.push(message),
        error: (message) => errors.push(message),
      },
      testCase.stdin !== undefined ? { stdin: testCase.stdin } : undefined,
    );
  } catch (err) {
    const candidate = (err as { exitCode?: number }).exitCode;
    exitCode = typeof candidate === 'number' ? candidate : 3;
    errors.push(String((err as Error)?.message ?? err));
  }

  const expectedExit = Array.isArray(testCase.expectExit) ? testCase.expectExit : [testCase.expectExit];
  expect(expectedExit).toContain(exitCode);
  expect(errors.join('\n')).not.toMatch(fatalRegex);

  const stdout = logs.join('\n');
  const stderr = errors.join('\n');

  assertTextExpectations(stdout, testCase.stdout);
  assertTextExpectations(stderr, testCase.stderr);
}
