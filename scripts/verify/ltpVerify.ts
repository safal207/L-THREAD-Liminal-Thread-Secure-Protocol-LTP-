import path from 'node:path';
import { renderCanonicalDemo } from '../../src/demos/canonicalFlowDemo.v0.1';
import { verifyDirectoryReports } from '../../tools/conformance-kit/src/verify';
import type { ConformanceReportBatch } from '../../tools/conformance-kit/src/types';

type VerifyStatus = 'OK' | 'WARN' | 'FAIL';

interface CanonicalResult {
  status: VerifyStatus;
}

interface ConformanceResult {
  status: VerifyStatus;
  score: number;
  errors: number;
  warnings: number;
}

export interface VerifySummary {
  canonical: CanonicalResult;
  conformance: ConformanceResult;
  overall: VerifyStatus;
}

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const CONFORMANCE_FIXTURES = path.join(ROOT_DIR, 'fixtures', 'conformance', 'v0.1');

const summarizeConformance = (batch: ConformanceReportBatch): ConformanceResult => {
  const { score, summary } = batch;
  const status: VerifyStatus = summary.unexpectedCount > 0 ? 'FAIL' : summary.warnCount > 0 ? 'WARN' : 'OK';
  return {
    status,
    score,
    errors: summary.unexpectedCount,
    warnings: summary.warnCount,
  };
};

const runCanonicalFlow = (): CanonicalResult => {
  try {
    renderCanonicalDemo();
    return { status: 'OK' };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Canonical flow failed', error);
    return { status: 'FAIL' };
  }
};

const runConformanceSuite = (): ConformanceResult => {
  try {
    const { batch } = verifyDirectoryReports(CONFORMANCE_FIXTURES);
    return summarizeConformance(batch);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Conformance verification failed', error);
    return { status: 'FAIL', score: 0, errors: 1, warnings: 0 };
  }
};

const deriveOverall = (canonical: VerifyStatus, conformance: VerifyStatus): VerifyStatus => {
  if (canonical === 'FAIL' || conformance === 'FAIL') {
    return 'FAIL';
  }
  if (canonical === 'WARN' || conformance === 'WARN') {
    return 'WARN';
  }
  return 'OK';
};

export const formatSummary = (summary: VerifySummary): string => {
  const lines = [
    'LTP v0.1 verify',
    '---------------',
    `canonical: ${summary.canonical.status}`,
    `conformance: ${summary.conformance.status} score=${summary.conformance.score.toFixed(3)} ` +
      `errors=${summary.conformance.errors} warnings=${summary.conformance.warnings}`,
    `overall: ${summary.overall}`,
  ];

  return lines.join('\n');
};

export const runVerify = (): VerifySummary => {
  const canonical = runCanonicalFlow();
  const conformance = runConformanceSuite();
  const overall = deriveOverall(canonical.status, conformance.status);

  const summary: VerifySummary = {
    canonical,
    conformance,
    overall,
  };

  const summaryText = formatSummary(summary);
  // eslint-disable-next-line no-console
  console.log(summaryText);

  process.exitCode = overall === 'FAIL' ? 2 : 0;

  return summary;
};

if (require.main === module) {
  runVerify();
}
