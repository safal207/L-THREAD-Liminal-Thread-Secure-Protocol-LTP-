import path from 'node:path';
import { pathToFileURL } from 'node:url';
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
const DEFAULT_CONFORMANCE_FIXTURES = path.join(ROOT_DIR, 'fixtures', 'conformance', 'v0.1');

interface VerifyOptions {
  conformanceDir?: string;
}

const resolveConformanceDir = (override?: string): string =>
  override ?? process.env.LTP_CONFORMANCE_DIR ?? DEFAULT_CONFORMANCE_FIXTURES;

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

const runConformanceSuite = (conformanceDir: string): ConformanceResult => {
  try {
    const { batch } = verifyDirectoryReports(conformanceDir);
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

export const formatSummaryJson = (summary: VerifySummary): string => JSON.stringify(summary, null, 2);

export const runVerify = (options: VerifyOptions = {}): VerifySummary => {
  const conformanceDir = resolveConformanceDir(options.conformanceDir);
  const canonical = runCanonicalFlow();
  const conformance = runConformanceSuite(conformanceDir);
  const overall = deriveOverall(canonical.status, conformance.status);

  const summary: VerifySummary = {
    canonical,
    conformance,
    overall,
  };

  return summary;
};

const parseDirArg = (argv: string[]): string | undefined => {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dir') {
      return argv[index + 1];
    }
    if (arg.startsWith('--dir=')) {
      return arg.slice('--dir='.length);
    }
  }
  return undefined;
};

const main = (): void => {
  const cliDir = parseDirArg(process.argv.slice(2));
  const conformanceDir = resolveConformanceDir(cliDir);
  const summary = runVerify({ conformanceDir });
  const summaryText = formatSummary(summary);
  const jsonMode = process.env.LTP_VERIFY_JSON === '1';

  // eslint-disable-next-line no-console
  console.log(jsonMode ? formatSummaryJson(summary) : summaryText);

  process.exitCode = summary.overall === 'FAIL' ? 2 : 0;
};

const mainArg = process.argv[1];
const isMain = mainArg ? pathToFileURL(mainArg).href === import.meta.url : false;

if (isMain) {
  main();
}
