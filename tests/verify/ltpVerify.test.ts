import { describe, expect, test } from 'vitest';
import { formatSummary, type VerifyReport } from '../../scripts/verify/ltpVerify';

describe('ltp:verify summary output', () => {
  test('produces a canonical multiline summary block', () => {
    const report: VerifyReport = {
      version: '0.1',
      timestamp: 1700000000,
      checks: [
        { name: 'build', status: 'OK' },
        { name: 'js-sdk-tests', status: 'OK' },
        { name: 'conformance', status: 'WARN', details: { score: 0.875, errors: 1, warnings: 2 } },
        { name: 'cross-sdk-types', status: 'OK' },
        { name: 'demos', status: 'FAIL' },
      ],
      overall: 'FAIL',
    };

    const expected = [
      'LTP VERIFY SUMMARY (v0.1)',
      'build: OK',
      'js-sdk-tests: OK',
      'conformance: WARN score=0.875 errors=1 warnings=2',
      'cross-sdk-types: OK',
      'demos: FAIL',
      'overall: FAIL',
    ].join('\n');

    expect(formatSummary(report)).toBe(expected);
  });
});
