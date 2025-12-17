import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderCanonicalDemo } from '../../src/demos/canonicalFlowDemo.v0.1';
import { verifyDirectoryReports } from '../../tools/conformance-kit/src/verify';
import type { ConformanceReportBatch } from '../../tools/conformance-kit/src/types';

export type VerifyStatus = 'OK' | 'WARN' | 'FAIL';

export type VerifyCheckName = 'build' | 'js-sdk-tests' | 'conformance' | 'cross-sdk-types' | 'demos';

export interface VerifyCheck {
  name: VerifyCheckName;
  status: VerifyStatus;
  details?: Record<string, unknown>;
  output?: string;
}

export interface VerifyReport {
  version: string;
  timestamp: number;
  checks: VerifyCheck[];
  overall: VerifyStatus;
}

export interface VerifyOptions {
  verbose?: boolean;
  outPath?: string;
  cwd?: string;
}

const VERSION = '0.1';
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DEFAULT_CONFORMANCE_FIXTURES = path.join(ROOT_DIR, 'fixtures', 'conformance', 'v0.1');

  return {
    name: 'conformance',
    status,
    details: {
      score: batch.score,
      errors,
      warnings,
    },
  };
};

const runConformance = (): VerifyCheck => {
  try {
    const { batch } = verifyDirectoryReports(conformanceDir);
    return summarizeConformance(batch);
  } catch (error) {
    return {
      name: 'conformance',
      status: 'FAIL',
      details: { error: error instanceof Error ? error.message : 'unknown conformance failure' },
    };
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

const defaultSteps = (
  options: { verbose: boolean; cwd: string },
): Array<() => Promise<VerifyCheck> | VerifyCheck> => [
  () => spawnCommand('build', 'pnpm', ['-w', 'build'], options),
  () => spawnCommand('js-sdk-tests', 'pnpm', ['--filter', '@liminal/ltp-client', 'test'], options),
  () => Promise.resolve(runConformance()),
  () => spawnCommand('cross-sdk-types', 'pnpm', ['-w', 'test:verify-types'], options),
  () => spawnCommand('demos', 'pnpm', ['-w', 'demo:canonical-v0.1'], options),
];

const writeJsonReport = (outPath: string, report: VerifyReport): void => {
  ensureDirectory(outPath);
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
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

  const checks: VerifyCheck[] = [];
  // eslint-disable-next-line no-console
  if (verbose) console.log('Running LTP verify steps...');

  for (const step of steps) {
    const result = await step();
    checks.push(result);
  }

  const report: VerifyReport = {
    version: VERSION,
    timestamp: Math.floor(Date.now() / 1000),
    checks,
    overall: deriveOverall(checks),
  };

  if (options.outPath) {
    const resolvedOut = path.isAbsolute(options.outPath)
      ? options.outPath
      : path.resolve(cwd, options.outPath);
    writeJsonReport(resolvedOut, report);
  }

  return report;
};
const getCurrentModuleHref = (): string | undefined => {
  try {
    // eslint-disable-next-line no-eval
    return (0, eval)('import.meta.url') as string;
  } catch {
    return pathToFileURL(__filename).href;
  }
};

export const formatSummary = formatSummaryText;

export const formatSummaryJson = (summary: VerifySummary): string => JSON.stringify(summary, null, 2);

export const runVerify = async (conformanceDir: string): Promise<VerifySummary> => {
  const canonical = runCanonicalFlow();
  const conformance = runConformanceSuite(conformanceDir);
  const overall = deriveOverall(canonical.status, conformance.status);

const parseCliArgs = (argv: string[]): CliArgs => {
  const outIndex = argv.indexOf('--out');
  const verbose = argv.includes('--verbose') || argv.includes('-v');
  const help = argv.includes('--help') || argv.includes('-h');
  return {
    verbose,
    outPath: outIndex !== -1 ? argv[outIndex + 1] : undefined,
    help,
  };
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

export const getCurrentModuleHref = (): string | undefined => {
  try {
    // eslint-disable-next-line no-eval
    return (0, eval)('import.meta.url') as string;
  } catch {
    return pathToFileURL(__filename).href;
  }
};

export function isMainModule(
  argvPath: string | undefined = process.argv[1],
  currentHrefGetter: () => string | undefined = getCurrentModuleHref,
): boolean {
  if (!argvPath) return false;

  const mainHref = pathToFileURL(argvPath).href;
  const currentHref = currentHrefGetter();

  if (!currentHref) return false;

  return mainHref === currentHref;
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
