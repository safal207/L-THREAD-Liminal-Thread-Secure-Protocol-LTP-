import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderCanonicalDemo } from '../../src/demos/canonicalFlowDemo.v0.1';
import type { ConformanceReportBatch } from '../../tools/conformance-kit/src/types';
import { verifyDirectoryReports } from '../../tools/conformance-kit/src/verify';
import { generateConformanceReport } from './generateConformanceReport';

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

export interface VerifySummary {
  canonical: { status: VerifyStatus; output?: string };
  conformance: { status: VerifyStatus; score: number; errors: number; warnings: number };
  overall: VerifyStatus;
  reportPath?: string;
}

type ConformanceResult = { status: VerifyStatus; score: number; errors: number; warnings: number };
type CliArgs = { verbose: boolean; outPath: string; help: boolean };

const VERSION = '0.1';
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DEFAULT_CONFORMANCE_FIXTURES = path.join(ROOT_DIR, 'fixtures', 'conformance', 'v0.1');
const DEFAULT_OUT_PATH = 'artifacts/conformance-report.json';

function ensureDirForFile(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

const deriveOverall = (statuses: VerifyStatus[]): VerifyStatus => {
  if (statuses.some((status) => status === 'FAIL')) return 'FAIL';
  if (statuses.some((status) => status === 'WARN')) return 'WARN';
  return 'OK';
};

const summarizeConformance = (batch: ConformanceReportBatch): ConformanceResult => {
  const errors = batch.reports.reduce((total, report) => total + (report.errors?.length ?? 0), 0);
  const warnings = batch.reports.reduce((total, report) => total + (report.warnings?.length ?? 0), 0);
  const status: VerifyStatus = errors > 0 ? 'FAIL' : warnings > 0 ? 'WARN' : 'OK';

  return { status, score: batch.score, errors, warnings };
};

const spawnCommand = async (
  name: VerifyCheckName,
  cmd: string,
  args: string[],
  options: { verbose: boolean; cwd: string },
): Promise<VerifyCheck> =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: options.cwd, shell: false });

    let output = '';
    if (options.verbose) {
      child.stdout?.pipe(process.stdout);
      child.stderr?.pipe(process.stderr);
    } else {
      child.stdout?.on('data', (chunk) => {
        output += chunk.toString();
      });
      child.stderr?.on('data', (chunk) => {
        output += chunk.toString();
      });
    }

    child.on('error', (error) => {
      resolve({ name, status: 'FAIL', details: { error: error.message } });
    });

    child.on('close', (code) => {
      resolve({
        name,
        status: code === 0 ? 'OK' : 'FAIL',
        output: options.verbose ? undefined : output.trim() || undefined,
      });
    });
  });

const runCanonicalFlow = (): VerifyCheck => {
  try {
    const output = renderCanonicalDemo();
    return { name: 'demos', status: 'OK', output };
  } catch (error) {
    return {
      name: 'demos',
      status: 'FAIL',
      details: { error: error instanceof Error ? error.message : 'unknown canonical flow failure' },
    };
  }
};

const runConformanceSuite = (conformanceDir: string): VerifyCheck => {
  try {
    const { batch } = verifyDirectoryReports(conformanceDir);
    const summary = summarizeConformance(batch);
    return {
      name: 'conformance',
      status: summary.status,
      details: { score: summary.score, errors: summary.errors, warnings: summary.warnings },
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Conformance verification failed', error);
    return { name: 'conformance', status: 'FAIL', details: { score: 0, errors: 1, warnings: 0 } };
  }
};

const defaultSteps = (
  conformanceDir: string,
  options: { verbose: boolean; cwd: string },
): Array<() => Promise<VerifyCheck> | VerifyCheck> => [
  () => spawnCommand('build', 'pnpm', ['-w', 'build'], options),
  () => spawnCommand('js-sdk-tests', 'pnpm', ['--filter', '@liminal/ltp-client', 'test'], options),
  () => Promise.resolve(runConformanceSuite(conformanceDir)),
  () => spawnCommand('cross-sdk-types', 'pnpm', ['-w', 'test:verify-types'], options),
  () => Promise.resolve(runCanonicalFlow()),
];

export const formatSummaryText = (summary: VerifySummary): string => {
  const lines = [
    'LTP v0.1 verify',
    '---------------',
    `canonical: ${summary.canonical.status}`,
    `conformance: ${summary.conformance.status} score=${summary.conformance.score.toFixed(3)} ` +
      `errors=${summary.conformance.errors} warnings=${summary.conformance.warnings}`,
    `overall: ${summary.overall}`,
  ];

  if (summary.reportPath) {
    lines.push(`Report: ${summary.reportPath}`);
  }

  return lines.join('\n');
};

export const formatSummaryJson = (summary: VerifySummary): string => JSON.stringify(summary, null, 2);

export const runVerify = async (
  conformanceDir: string,
  options: VerifyOptions,
): Promise<{ report: VerifyReport; summary: VerifySummary }> => {
  const verbose = options.verbose ?? false;
  const cwd = options.cwd ?? ROOT_DIR;

  const steps = defaultSteps(conformanceDir, { verbose, cwd });
  const checks: VerifyCheck[] = [];

  if (verbose) {
    // eslint-disable-next-line no-console
    console.log('Running LTP verify steps...');
  }

  for (const step of steps) {
    const result = await step();
    checks.push(result);
  }

  const canonicalCheck = checks.find((c) => c.name === 'demos');
  const conformanceCheck = checks.find((c) => c.name === 'conformance');

  const summary: VerifySummary = {
    canonical: { status: canonicalCheck?.status ?? 'FAIL', output: canonicalCheck?.output },
    conformance: {
      status: conformanceCheck?.status ?? 'FAIL',
      score: Number((conformanceCheck?.details?.score as number | undefined) ?? 0),
      errors: Number((conformanceCheck?.details?.errors as number | undefined) ?? 0),
      warnings: Number((conformanceCheck?.details?.warnings as number | undefined) ?? 0),
    },
    overall: deriveOverall(checks.map((c) => c.status)),
    reportPath: options.outPath,
  };

  const report: VerifyReport = {
    version: VERSION,
    timestamp: Math.floor(Date.now() / 1000),
    checks,
    overall: summary.overall,
  };

  return { report, summary };
};

const parseCliArgs = (argv: string[]): CliArgs => {
  const outIndex = argv.indexOf('--out');
  const outEquals = argv.find((arg) => arg.startsWith('--out='));
  const verbose = argv.includes('--verbose') || argv.includes('-v');
  const help = argv.includes('--help') || argv.includes('-h');

  let outPath = DEFAULT_OUT_PATH;
  if (outIndex !== -1) {
    const candidate = argv[outIndex + 1];
    if (candidate && !candidate.startsWith('--')) outPath = candidate;
  }
  if (outEquals) outPath = outEquals.slice('--out='.length);

  return { verbose, outPath, help };
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

  const { verbose, outPath, help } = parseCliArgs(argv);

  if (help) {
    // eslint-disable-next-line no-console
    console.log(
      'Usage: pnpm -w ltp:verify -- [--out <path>] [--dir <conformanceDir>] [--verbose]\n' +
        `Default output: ${DEFAULT_OUT_PATH}`,
    );
    process.exitCode = 0;
    return;
  }

  const resolvedOut = path.resolve(outPath ?? DEFAULT_OUT_PATH);

  const { report, summary } = await runVerify(conformanceDir, { verbose, outPath: outPath ?? DEFAULT_OUT_PATH, cwd: ROOT_DIR });

  ensureDirForFile(resolvedOut);
  await generateConformanceReport({ outPath: resolvedOut, report });

  const displayReportPath = outPath ?? DEFAULT_OUT_PATH;

  const summaryWithReport: VerifySummary = { ...summary, reportPath: displayReportPath };

  if (process.env.LTP_VERIFY_JSON === '1') {
    console.log(formatSummaryJson(summaryWithReport));
  } else {
    console.log(formatSummaryText(summaryWithReport));
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
