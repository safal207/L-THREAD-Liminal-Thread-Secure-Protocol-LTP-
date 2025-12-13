import fs from 'node:fs';
import path from 'node:path';
import { resolveSelfTestMode, runSelfTest, SelfTestMode } from '../../sdk/js/src/conformance/selfTest';
import packageJson from '../../sdk/js/package.json';

export interface ConformanceCheck {
  name: string;
  ok: boolean;
  level: 'LTP-Core' | 'LTP-Flow' | 'LTP-Canonical';
  mode: SelfTestMode;
  determinismHash: string;
  stats: {
    received: number;
    processed: number;
    emitted: number;
    deduped: number;
    branches: number;
  };
  errors: string[];
}

export interface ConformanceReport {
  ok: boolean;
  version: string;
  timestamp: {
    epoch_ms: number;
    iso: string;
  };
  checks: ConformanceCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    determinismHash: string;
  };
}

interface GenerateOptions {
  mode?: SelfTestMode;
  timestampMs?: number;
}

export const generateConformanceReport = (options: GenerateOptions = {}): ConformanceReport => {
  const mode = resolveSelfTestMode(options.mode);
  const { report } = runSelfTest({ mode });
  const epochMs = options.timestampMs ?? Date.now();
  const iso = new Date(epochMs).toISOString();

  const check: ConformanceCheck = {
    name: 'ltp-node-self-test',
    ok: report.ok,
    level: report.level,
    mode: report.mode,
    determinismHash: report.determinismHash,
    stats: {
      received: report.receivedFrames,
      processed: report.processedFrames,
      emitted: report.emittedFrames,
      deduped: report.dedupedFrames,
      branches: report.branchesCount,
    },
    errors: report.errors,
  };

  const summary = {
    total: 1,
    passed: check.ok ? 1 : 0,
    failed: check.ok ? 0 : 1,
    determinismHash: report.determinismHash,
  };

  return {
    ok: check.ok,
    version: packageJson.version,
    timestamp: { epoch_ms: epochMs, iso },
    checks: [check],
    summary,
  };
};

export const writeConformanceReport = (
  targetPath: string,
  options: GenerateOptions = {}
): ConformanceReport => {
  const report = generateConformanceReport(options);
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

  if (!report.ok) {
    process.exitCode = 1;
  }
}
