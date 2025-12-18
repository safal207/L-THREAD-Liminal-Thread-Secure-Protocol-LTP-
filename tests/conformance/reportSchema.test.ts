import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateConformanceReport, writeConformanceReport } from '../../scripts/conformance/generateConformanceReport';

const fixedTimestamp = 1_730_000_000_000;

describe('conformance report generator', () => {
  it('produces deterministic schema v0.1 with stable timestamp input', () => {
    const first = generateConformanceReport({ timestampMs: fixedTimestamp });
    const second = generateConformanceReport({ timestampMs: fixedTimestamp });

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe('v0.1');
    expect(first.protocolVersion).toBe('v0.1');
    expect(first.toolingVersion).toMatch(/^\d+\.\d+\.\d+$/);

    expect(first.timings.startedAt).toBe(new Date(fixedTimestamp).toISOString());
    expect(first.timings.finishedAt).toBe(new Date(fixedTimestamp).toISOString());
    expect(first.timings.durationMs).toBe(0);

    expect(first.suites).toHaveLength(1);
    const suite = first.suites[0];
    expect(suite.id).toBe('ltp-self-test');
    expect(suite.result).toBe('OK');
    expect(suite.checks).toHaveLength(1);
    const check = suite.checks[0];
    expect(check.id).toBe('ltp-node-self-test');
    expect(check.result).toBe('OK');
    expect(check.details).toContain('mode=');

    expect(first.determinismHash.startsWith('sha256:')).toBe(true);
    expect(first.summary).toEqual({
      passed: 1,
      warnings: 0,
      failed: 0,
    });
  });

  it('writes the report to the artifacts directory without relying on wall-clock time', () => {
    const targetPath = path.resolve(__dirname, '../../artifacts/conformance-report.test.json');
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }

    const report = writeConformanceReport(targetPath, { timestampMs: fixedTimestamp });

    expect(fs.existsSync(targetPath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));

    expect(parsed.summary).toEqual(report.summary);
    expect(parsed.timings.startedAt).toBe(report.timings.startedAt);

    fs.unlinkSync(targetPath);
  });
});
