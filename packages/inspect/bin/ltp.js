#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const DIST_ENTRY = path.join(__dirname, '..', 'dist', 'inspect.js');
const EXIT_NOT_BUILT = 4;
const EXIT_FAILURE = 1;

function fail(code, message) {
  console.error(message);
  process.exit(code);
}

function loadDistInspector() {
  if (!fs.existsSync(DIST_ENTRY)) {
    fail(EXIT_NOT_BUILT, '@ltp/inspect is not built. Run: pnpm -C packages/inspect build');
  }

  try {
    const mod = require(DIST_ENTRY);
    if (!mod?.main) fail(EXIT_FAILURE, 'Inspector runtime is missing the expected "main" export.');
    return mod;
  } catch (error) {
    console.error('Failed to load @ltp/inspect runtime from dist/inspect.js');
    console.error(error?.stack ?? error);
    process.exit(EXIT_FAILURE);
  }
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection in @ltp/inspect CLI:', reason);
  process.exit(EXIT_FAILURE);
});

process.on('uncaughtException', (error) => {
  console.error('Unhandled error in @ltp/inspect CLI:', error);
  process.exit(EXIT_FAILURE);
});

const args = process.argv.slice(2);
const commandArgs = args[0] === 'inspect' ? args.slice(1) : args;

const { main } = loadDistInspector();
Promise.resolve()
  .then(() => main(commandArgs))
  .catch((error) => {
    const exitCode = typeof error?.exitCode === 'number' ? error.exitCode : EXIT_FAILURE;
    console.error(error?.message ?? error);
    if (error?.stack) console.error(error.stack);
    process.exit(exitCode || EXIT_FAILURE);
  });
