import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DEFAULT_CONFORMANCE_FIXTURES = path.join(ROOT_DIR, 'fixtures', 'conformance', 'v0.1');

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

export const formatSummaryText = (summary: VerifySummary): string => {
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

export const formatSummary = formatSummaryText;

export const formatSummaryJson = (summary: VerifySummary): string => JSON.stringify(summary, null, 2);

export const runVerify = async (conformanceDir: string): Promise<VerifySummary> => {
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

function resolveConformanceDir(argv: string[]): string | undefined {
  const eq = argv.find((arg) => arg.startsWith('--dir='));
  if (eq) return path.resolve(eq.slice('--dir='.length));

  const idx = argv.indexOf('--dir');
  if (idx === -1) return undefined;

  const value = argv[idx + 1];
  if (!value || value.startsWith('--')) {
    throw new Error('Missing value for --dir. Usage: --dir <path> or --dir=<path>');
  }
  return path.resolve(value);
}

function isMainModule(): boolean {
  // ESM-safe "am I the entrypoint?"
  return import.meta.url === `file://${process.argv[1]}`;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const dirFromArg = resolveConformanceDir(argv);
  const envDir = process.env.LTP_CONFORMANCE_DIR ? path.resolve(process.env.LTP_CONFORMANCE_DIR) : undefined;
  const conformanceDir = dirFromArg ?? envDir ?? DEFAULT_CONFORMANCE_FIXTURES;

  const summary = await runVerify(conformanceDir);

  if (process.env.LTP_VERIFY_JSON === '1') {
    console.log(formatSummaryJson(summary));
  } else {
    console.log(formatSummaryText(summary));
  }

  process.exitCode = summary.overall === 'FAIL' ? 2 : 0;
}

// If executed directly: node scripts/verify/ltpVerify.ts ...
if (isMainModule()) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
