import { describe, it, expect } from 'vitest';
import { parseArgs } from '../validateConformanceReport';

describe('validateConformanceReport CLI parsing', () => {
  it('uses positional after --', () => {
    const args = ['--', 'artifacts/report.json'];
    const parsed = parseArgs(args);
    expect(parsed.reportPath).toBe('artifacts/report.json');
  });

  it('supports schema override', () => {
    const args = ['--', 'artifacts/report.json', '--schema', 'schema.json'];
    const parsed = parseArgs(args);
    expect(parsed.reportPath).toBe('artifacts/report.json');
    expect(parsed.schemaPath).toBe('schema.json');
  });

  it('fails when no report path provided', () => {
    const args = ['--schema', 'schema.json'];
    const parsed = parseArgs(args);
    expect(parsed.reportPath).toBeUndefined();
  });

  it('fallbacks to first non-flag when -- is not present', () => {
    const args = ['artifacts/report.json'];
    const parsed = parseArgs(args);
    expect(parsed.reportPath).toBe('artifacts/report.json');
  });

  it('does not treat --schema value as report path', () => {
    const args = ['--schema', 'schema.json', 'artifacts/report.json'];
    const parsed = parseArgs(args);
    expect(parsed.reportPath).toBe('artifacts/report.json');
  });
});
