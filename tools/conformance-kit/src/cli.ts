#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { resolveSelfTestMode, runSelfTest } from '../../../sdk/js/src/conformance/selfTest';
import kitPackage from '../package.json';
import { clamp01 } from './utils/math';
import { normalizeFramesFromValue, readJsonFile } from './utils/files';
import { ConformanceReport, ConformanceReportBatch } from './types';
import { verifyFrames, writeReport } from './verify';

const DEFAULT_REPORT_PATH = path.resolve(process.cwd(), 'reports/ltp-conformance-report.json');
const DEFAULT_BADGE_PATH = path.resolve(process.cwd(), 'reports/ltp-conformance-badge.json');

const log = (message: string): void => {
  // eslint-disable-next-line no-console
  console.log(message);
};

const formatSummary = (report: ConformanceReport): string => {
  const state = report.errors.length > 0 ? 'FAIL' : report.warnings.length > 0 ? 'WARN' : 'OK';
  return `${state} score=${report.score.toFixed(3)} errors=${report.errors.length} warnings=${report.warnings.length}`;
};

const writeBadge = (targetPath: string, report: ConformanceReport | ConformanceReportBatch): void => {
  const hasErrors = 'reports' in report ? report.reports.some((r) => r.errors.length > 0) : report.errors.length > 0;
  const hasWarnings = 'reports' in report
    ? report.reports.some((r) => r.errors.length === 0 && r.warnings.length > 0)
    : report.warnings.length > 0;

  const badge = {
    label: 'LTP',
    message: hasErrors ? 'non-conformant v0.1' : hasWarnings ? 'conformant with warnings' : 'conformant v0.1',
    color: hasErrors ? 'red' : hasWarnings ? 'yellow' : 'brightgreen',
  };

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(badge, null, 2)}\n`, 'utf-8');
};

const verifyFile = (filePath: string, options: { outPath?: string; format?: string; strict?: boolean }) => {
  const resolved = path.resolve(process.cwd(), filePath);
  const { value, inputHash } = readJsonFile(resolved);
  const frames = normalizeFramesFromValue(value);
  const outcome = verifyFrames(frames, { inputName: path.basename(resolved), inputHash, strict: options.strict });
  const reportPath = path.resolve(process.cwd(), options.outPath ?? DEFAULT_REPORT_PATH);
  writeReport(reportPath, outcome.report);
  writeBadge(DEFAULT_BADGE_PATH, outcome.report);

  if (options.format === 'json') {
    log(JSON.stringify(outcome.report, null, 2));
  } else {
    log(`${path.basename(resolved)} -> ${formatSummary(outcome.report)} (report: ${path.relative(process.cwd(), reportPath)})`);
  }

  process.exitCode = Math.max(process.exitCode ?? 0, outcome.exitCode);
};

const verifyDirectory = (dirPath: string, options: { outPath?: string; format?: string; strict?: boolean }) => {
  const resolvedDir = path.resolve(process.cwd(), dirPath);
  const files = fs
    .readdirSync(resolvedDir)
    .filter((file) => file.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  const reports: ConformanceReport[] = [];
  let highestExit = 0;

  files.forEach((file) => {
    const { value, inputHash } = readJsonFile(path.join(resolvedDir, file));
    const frames = normalizeFramesFromValue(value);
    const { report, exitCode } = verifyFrames(frames, { inputName: file, inputHash, strict: options.strict });
    reports.push(report);
    highestExit = Math.max(highestExit, exitCode);
    if (options.format !== 'json') {
      log(`${file} -> ${formatSummary(report)}`);
    }
  });

  const summary = {
    total: reports.length,
    passed: reports.filter((r) => r.errors.length === 0 && r.warnings.length === 0).length,
    warned: reports.filter((r) => r.errors.length === 0 && r.warnings.length > 0).length,
    failed: reports.filter((r) => r.errors.length > 0).length,
  };

  const batch: ConformanceReportBatch = {
    v: '0.1',
    ok: summary.failed === 0,
    score: reports.length
      ? Number(
          (
            reports.reduce((total, current) => total + current.score, 0) /
            Math.max(1, reports.length)
          ).toFixed(3)
        )
      : 0,
    reports,
    summary,
    meta: {
      timestamp: Date.now(),
      tool: 'ltp-conformance-kit',
      toolVersion: kitPackage.version,
      inputName: path.basename(resolvedDir),
    },
  };

  const reportPath = path.resolve(process.cwd(), options.outPath ?? DEFAULT_REPORT_PATH);
  writeReport(reportPath, batch);
  writeBadge(DEFAULT_BADGE_PATH, batch);

  if (options.format === 'json') {
    log(JSON.stringify(batch, null, 2));
  } else {
    const state = summary.failed > 0 ? 'FAIL' : summary.warned > 0 ? 'WARN' : 'OK';
    log(`summary -> ${state} score=${batch.score.toFixed(3)} errors=${summary.failed} warnings=${summary.warned}`);
    log(`saved ${reports.length} reports to ${path.relative(process.cwd(), reportPath)}`);
  }

  process.exitCode = Math.max(process.exitCode ?? 0, highestExit);
};

const runSelfTestCommand = (options: { outPath?: string; format?: string; strict?: boolean; mode?: string }) => {
  const mode = resolveSelfTestMode(options.mode);
  const selfTest = runSelfTest({ mode });
  const issues = selfTest.report.errors.map((message, index) => ({
    code: 'ltp.selftest.error',
    message,
    at: index,
  }));
  const conformance: ConformanceReport = {
    v: '0.1',
    ok: issues.length === 0,
    score: clamp01(1 - issues.length * 0.2),
    frameCount: selfTest.report.receivedFrames,
    passed: issues.length === 0 ? [`selftest ${mode} passed at level ${selfTest.report.level}`] : [],
    warnings: [],
    errors: issues,
    hints: issues.length === 0 ? ['self-test canonical flow validated'] : [],
    annotations: { selfTest: selfTest.report },
    meta: {
      timestamp: Date.now(),
      tool: 'ltp-conformance-kit',
      toolVersion: kitPackage.version,
      inputName: `selftest:${mode}`,
    },
  };
  const exitCode = issues.length === 0 ? 0 : options.strict ? 1 : 2;

  const reportPath = path.resolve(process.cwd(), options.outPath ?? DEFAULT_REPORT_PATH);
  writeReport(reportPath, conformance);
  writeBadge(DEFAULT_BADGE_PATH, conformance);

  if (options.format === 'json') {
    log(JSON.stringify(conformance, null, 2));
  } else {
    log(`selftest(${mode}) -> ${formatSummary(conformance)} (report: ${path.relative(process.cwd(), reportPath)})`);
  }

  process.exitCode = Math.max(process.exitCode ?? 0, exitCode);
};

const printHelp = (): void => {
  log(`LTP Conformance Kit v0.1

Usage:
  pnpm -w ltp:conformance verify <capture.json> [--out <path>] [--format text|json] [--strict]
  pnpm -w ltp:conformance verify:dir <fixtures-dir> [--out <path>] [--format text|json] [--strict]
  pnpm -w ltp:conformance selftest [--mode calm|storm|recovery] [--out <path>]
`);
};

export const runCli = (argv: string[]) => {
  const [command, ...rest] = argv.slice(2);
  const outFlagIndex = rest.indexOf('--out');
  const formatFlagIndex = rest.indexOf('--format');
  const strict = rest.includes('--strict');
  const modeFlagIndex = rest.indexOf('--mode');

  const outPath = outFlagIndex !== -1 ? rest[outFlagIndex + 1] : undefined;
  const format = formatFlagIndex !== -1 ? rest[formatFlagIndex + 1] : undefined;
  const mode = modeFlagIndex !== -1 ? rest[modeFlagIndex + 1] : undefined;

  try {
    switch (command) {
      case 'verify': {
        const target = rest[0];
        if (!target) {
          printHelp();
          process.exitCode = 3;
          return;
        }
        verifyFile(target, { outPath, format, strict });
        break;
      }
      case 'verify:dir': {
        const targetDir = rest[0];
        if (!targetDir) {
          printHelp();
          process.exitCode = 3;
          return;
        }
        verifyDirectory(targetDir, { outPath, format, strict });
        break;
      }
      case 'selftest': {
        runSelfTestCommand({ outPath, format, strict, mode });
        break;
      }
      default:
        printHelp();
        process.exitCode = 3;
    }
  } catch (error) {
    process.exitCode = 4;
    // eslint-disable-next-line no-console
    console.error('Conformance kit failed:', error);
  }
};

if (require.main === module) {
  runCli(process.argv);
}
