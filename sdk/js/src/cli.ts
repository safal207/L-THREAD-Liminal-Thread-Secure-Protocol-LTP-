#!/usr/bin/env node
import { resolveSelfTestMode, runSelfTest } from './conformance/selfTest';

const printUsage = (): void => {
  // eslint-disable-next-line no-console
  console.error('Usage: ltp-client self-test [--mode calm|storm|recovery]');
};

const main = (): void => {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'self-test';
  const modeFlagIndex = args.indexOf('--mode');
  const requestedMode = modeFlagIndex >= 0 ? args[modeFlagIndex + 1] : undefined;
  const mode = resolveSelfTestMode(requestedMode);

  if (command !== 'self-test') {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const { report } = runSelfTest({ mode });
  const output = {
    ok: report.ok,
    level: report.level,
    branches: report.branchesCount,
    determinismHash: report.determinismHash,
    received: report.receivedFrames,
    processed: report.processedFrames,
    emitted: report.emittedFrames,
    deduped: report.dedupedFrames,
    errors: report.errors,
    mode: report.mode,
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(output, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
};

main();
