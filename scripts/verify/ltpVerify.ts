import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
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

const CHECK_ORDER: VerifyCheckName[] = ['build', 'js-sdk-tests', 'conformance', 'cross-sdk-types', 'demos'];

const deriveOverall = (checks: VerifyCheck[]): VerifyStatus => {
  if (checks.some((check) => check.status === 'FAIL')) {
    return 'FAIL';
  }

  if (checks.some((check) => check.status === 'WARN')) {
    return 'WARN';
  }

  return 'OK';
};

const formatConformanceDetails = (details: Record<string, unknown> | undefined): string => {
  if (!details) {
    return '';
  }

  const score = typeof details.score === 'number' ? (details.score as number).toFixed(3) : undefined;
  const errors = details.errors as number | undefined;
  const warnings = details.warnings as number | undefined;

  const parts = [
    score !== undefined ? `score=${score}` : undefined,
    errors !== undefined ? `errors=${errors}` : undefined,
    warnings !== undefined ? `warnings=${warnings}` : undefined,
  ].filter(Boolean);

  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
};

export const formatSummary = (report: VerifyReport): string => {
  const lines = [`LTP VERIFY SUMMARY (v${report.version})`];

  CHECK_ORDER.forEach((name) => {
    const check = report.checks.find((entry) => entry.name === name);

    if (!check) return;

    const detailSuffix = check.name === 'conformance' ? formatConformanceDetails(check.details) : '';
    lines.push(`${check.name}: ${check.status}${detailSuffix}`);
  });

  lines.push(`overall: ${report.overall}`);

  return lines.join('\n');
};

const spawnCommand = async (
  name: VerifyCheckName,
  command: string,
  args: string[],
  options: { verbose: boolean; cwd: string },
): Promise<VerifyCheck> => {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: process.platform === 'win32',
      stdio: options.verbose ? 'inherit' : 'pipe',
    });

    let combinedOutput = '';

    if (!options.verbose) {
      child.stdout?.on('data', (data) => {
        combinedOutput += data.toString();
      });

      child.stderr?.on('data', (data) => {
        combinedOutput += data.toString();
      });
    }

    const finalize = (status: VerifyStatus) => {
      resolve({
        name,
        status,
        output: combinedOutput.trim() || undefined,
      });
    };

    child.on('close', (code) => {
      finalize(code === 0 ? 'OK' : 'FAIL');
    });

    child.on('error', () => {
      finalize('FAIL');
    });
  });
};

const summarizeConformance = (batch: ConformanceReportBatch): VerifyCheck => {
  const errors = batch.summary.failedCount + batch.summary.unexpectedCount;
  const warnings = batch.summary.warnCount + batch.summary.expectedFailCount;

  const status: VerifyStatus = errors > 0 ? 'FAIL' : warnings > 0 ? 'WARN' : 'OK';

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

const ensureDirectory = (targetPath: string): void => {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
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

export const runLtpVerify = async (options: VerifyOptions = {}): Promise<VerifyReport> => {
  const verbose = Boolean(options.verbose);
  const cwd = options.cwd ?? ROOT_DIR;
  const steps = defaultSteps({ verbose, cwd });

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

function isMainModule(): boolean {
  const argvPath = process.argv[1];
  if (!argvPath) return false;
  const mainHref = pathToFileURL(argvPath).href;
  const currentHref = getCurrentModuleHref();
  return Boolean(currentHref) && mainHref === currentHref;
}

type CliArgs = { verbose: boolean; outPath?: string; help: boolean };

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

const printHelp = (): void => {
  // eslint-disable-next-line no-console
  console.log(`Usage: pnpm -w ltp:verify [--verbose] [--out <path>]
Runs build, JS SDK tests, conformance fixtures, cross-SDK type checks, and canonical demos.
Summary is always printed; exit codes: 0 (OK), 1 (WARN), 2 (FAIL).
`);
};

export const runCli = async (argv: string[]): Promise<void> => {
  const args = parseCliArgs(argv);

  if (args.help) {
    printHelp();
    process.exitCode = 0;
    return;
  }

  // (опционально) конформанс-директория нужна runVerify, если ты её используешь отдельно где-то ещё.
  // Здесь основной “канонический” раннер — runLtpVerify(), он возвращает VerifyReport.
  // Если тебе нужно пробросить conformanceDir внутрь runLtpVerify — добавь это в VerifyOptions и прокинь.
  const report = await runLtpVerify({ verbose: args.verbose, outPath: args.outPath });

  if (process.env.LTP_VERIFY_JSON === '1') {
    // eslint-disable-next-line no-console
    console.log(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    // eslint-disable-next-line no-console
    console.log(formatSummary(report));
  }

  switch (report.overall) {
    case 'OK':
      process.exitCode = 0;
      break;
    case 'WARN':
      process.exitCode = 1;
      break;
    case 'FAIL':
    default:
      process.exitCode = 2;
      break;
  }
};

// If executed directly: node scripts/verify/ltpVerify.ts ...
if (isMainModule()) {
  runCli(process.argv.slice(2)).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  });
}
