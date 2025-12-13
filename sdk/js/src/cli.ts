#!/usr/bin/env node
import { runSelfTest } from './conformance/selfTest';

const printUsage = (): void => {
  // eslint-disable-next-line no-console
  console.error('Usage: ltp-client self-test');
};

const main = (): void => {
  const command = process.argv[2] ?? 'self-test';

  if (command !== 'self-test') {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const { report } = runSelfTest();
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
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(output, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
};

main();
