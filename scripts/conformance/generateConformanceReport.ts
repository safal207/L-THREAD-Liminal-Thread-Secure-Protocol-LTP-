import fs from 'node:fs';
import path from 'node:path';
import { resolveSelfTestMode, runSelfTest, SelfTestMode } from '../../sdk/js/src/conformance/selfTest';
import packageJson from '../../sdk/js/package.json';

type ReportResult = 'OK' | 'WARN' | 'FAIL';

interface ReportCheck {
  id: string;
  result: ReportResult;
  details?: string;
}

interface ReportSuite {
  id: string;
  result: ReportResult;
  checks: ReportCheck[];
}

export interface ConformanceReportV01 {
  schemaVersion: 'v0.1';
  protocolVersion: 'v0.1';
  toolingVersion: string;
  overall: ReportResult;
  determinismHash: string;
  summary: {
    passed: number;
    warnings: number;
    failed: number;
  };
  suites: ReportSuite[];
  timings: {
    startedAt: string;
    finishedAt: string;
    durationMs: number;
  };
  environment: {
    runtime?: string;
    os?: string;
    ci?: boolean;
  };
  artifacts: {
    reportPath: string;
    logs: string[];
  };
}

interface GenerateOptions {
  mode?: SelfTestMode;
  timestampMs?: number;
  outputPath?: string;
}

const sanitizeToolingVersion = (version: string): string => version.split('-')[0] || '0.0.0';

const formatHash = (hash: string): string => (hash.startsWith('sha256:') ? hash : `sha256:${hash}`);

export const generateConformanceReport = (options: GenerateOptions = {}): ConformanceReportV01 => {
  const mode = resolveSelfTestMode(options.mode);
  const startedMs = options.timestampMs ?? Date.now();
  const finishedMs = startedMs;
  const { report } = runSelfTest({ mode });
  const overall: ReportResult = report.ok ? 'OK' : 'FAIL';

  const suites: ReportSuite[] = [
    {
      id: 'ltp-self-test',
      result: overall,
      checks: [
        {
          id: 'ltp-node-self-test',
          result: overall,
          details: `mode=${report.mode} level=${report.level}`,
        },
      ],
    },
  ];

  return {
    schemaVersion: 'v0.1',
    protocolVersion: 'v0.1',
    toolingVersion: sanitizeToolingVersion(packageJson.version),
    overall,
    determinismHash: formatHash(report.determinismHash),
    summary: {
      passed: report.ok ? 1 : 0,
      warnings: 0,
      failed: report.ok ? 0 : 1,
    },
    suites,
    timings: {
      startedAt: new Date(startedMs).toISOString(),
      finishedAt: new Date(finishedMs).toISOString(),
      durationMs: finishedMs - startedMs,
    },
    environment: {
      runtime: `node@${process.versions.node}`,
      os: process.platform,
      ci: process.env.CI === 'true' || process.env.CI === '1',
    },
    artifacts: {
      reportPath: path.resolve(process.cwd(), options.outputPath ?? 'artifacts/conformance-report.json'),
      logs: [],
    },
  };
};

export const writeConformanceReport = (
  targetPath: string,
  options: GenerateOptions = {}
): ConformanceReportV01 => {
  const report = generateConformanceReport({ ...options, outputPath: targetPath });
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  return report;
};

const parseFlag = (flag: string): string | undefined => {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
};

if (require.main === module) {
  const modeArg = parseFlag('--mode');
  const timestampArg = parseFlag('--timestamp');
  const timestampMs = timestampArg ? Number(timestampArg) : undefined;
  const mode = resolveSelfTestMode(modeArg);
  const outputPath = path.resolve(process.cwd(), 'artifacts/conformance-report.json');

  const report = writeConformanceReport(outputPath, { mode, timestampMs });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));

  if (report.overall !== 'OK') {
    process.exitCode = 1;
  }
}
