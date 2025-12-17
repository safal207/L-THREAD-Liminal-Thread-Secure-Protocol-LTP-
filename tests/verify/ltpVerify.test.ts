import { describe, expect, test } from 'vitest';
import { formatSummary, formatSummaryJson, type VerifySummary } from '../../scripts/verify/ltpVerify';

describe('ltp:verify summary output', () => {
  test('produces a compact multiline summary', () => {
    const summary: VerifySummary = {
      canonical: { status: 'OK' },
      conformance: { status: 'WARN', score: 0.875, errors: 1, warnings: 2 },
      overall: 'WARN',
    };

    const expected = [
      'LTP v0.1 verify',
      '---------------',
      'canonical: OK',
      'conformance: WARN score=0.875 errors=1 warnings=2',
      'overall: WARN',
    ].join('\n');

    expect(formatSummary(summary)).toBe(expected);
  });

  test('serializes JSON summary payloads', () => {
    const summary: VerifySummary = {
      canonical: { status: 'OK' },
      conformance: { status: 'OK', score: 1, errors: 0, warnings: 0 },
      overall: 'OK',
    };

    expect(JSON.parse(formatSummaryJson(summary))).toEqual(summary);
  });
});
