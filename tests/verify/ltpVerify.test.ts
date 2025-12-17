import { describe, expect, test } from 'vitest';
import { formatSummary, type VerifySummary } from '../../scripts/verify/ltpVerify';

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
});
