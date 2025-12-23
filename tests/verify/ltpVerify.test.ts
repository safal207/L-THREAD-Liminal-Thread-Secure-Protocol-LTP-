import { describe, expect, test } from 'vitest';
import { formatSummaryText, formatSummaryJson, type VerifySummary, type VerifyReport } from '../../scripts/verify/ltpVerify';

describe('ltp:verify summary output', () => {
  test('produces a canonical multiline summary block', () => {
    // We need to construct a VerifySummary, not VerifyReport, because formatSummaryText takes VerifySummary
    const summary: VerifySummary = {
       canonical: { status: 'FAIL', output: 'some error' }, // mapped from 'demos' check in report
       conformance: { status: 'WARN', score: 0.875, errors: 1, warnings: 2 },
       overall: 'FAIL'
    };

    // Note: The formatSummaryText function output format might differ from the expectation in the old test.
    // Let's check scripts/verify/ltpVerify.ts implementation of formatSummaryText:
    /*
      'LTP v0.1 verify',
      '---------------',
      `canonical: ${summary.canonical.status}`,
      `conformance: ${summary.conformance.status} score=${summary.conformance.score.toFixed(3)} ` +
        `errors=${summary.conformance.errors} warnings=${summary.conformance.warnings}`,
      `overall: ${summary.overall}`,
    */

    const expected = [
      'LTP v0.1 verify',
      '---------------',
      'canonical: FAIL',
      'conformance: WARN score=0.875 errors=1 warnings=2',
      'overall: FAIL',
    ].join('\n');

    expect(formatSummaryText(summary)).toBe(expected);
  });

  test('serializes JSON summary payloads', () => {
    const summary: VerifySummary = {
      canonical: { status: 'OK' },
      conformance: { status: 'OK', score: 1, errors: 0, warnings: 0 },
      overall: 'OK',
    };

    expect(JSON.parse(formatSummaryJson(summary))).toEqual(summary);
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
