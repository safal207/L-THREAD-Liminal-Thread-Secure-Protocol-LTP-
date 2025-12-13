import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateConformanceReport, writeConformanceReport } from '../../scripts/conformance/generateConformanceReport';

const fixedTimestamp = 1_730_000_000_000;

describe('conformance report generator', () => {
  it('produces deterministic schema with stable timestamp input', () => {
    const first = generateConformanceReport({ timestampMs: fixedTimestamp });
    const second = generateConformanceReport({ timestampMs: fixedTimestamp });

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    expect(first.version).toBeTruthy();
    expect(first.timestamp).toEqual({
      epoch_ms: fixedTimestamp,
      iso: new Date(fixedTimestamp).toISOString(),
    });

    expect(first.checks).toHaveLength(1);
    const check = first.checks[0];
    expect(check.name).toBe('ltp-node-self-test');
    expect(check.ok).toBe(true);
    expect(check.determinismHash).toBeTruthy();
    expect(check.stats.received).toBeGreaterThan(0);
    expect(check.stats.processed).toBeGreaterThan(0);
    expect(check.errors).toEqual([]);

    expect(first.summary).toEqual({
      total: 1,
      passed: 1,
      failed: 0,
      determinismHash: check.determinismHash,
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
    expect(parsed.timestamp.iso).toBe(report.timestamp.iso);

    fs.unlinkSync(targetPath);
  });
});
