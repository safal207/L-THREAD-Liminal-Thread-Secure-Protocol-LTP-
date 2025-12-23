#!/usr/bin/env node
const path = require('node:path');

const repoRoot = path.join(__dirname, '..', '..', '..');
const devEntry = path.join(repoRoot, 'tools', 'ltp-inspect', 'inspect.ts');

process.env.TS_NODE_PROJECT ||= path.join(repoRoot, 'tsconfig.json');
require('ts-node/register/transpile-only');

const args = process.argv.slice(2);
const commandArgs = args[0] === 'inspect' ? args.slice(1) : args;

Promise.resolve()
  .then(() => require(devEntry))
  .then(({ main }) => main(commandArgs))
  .catch((error) => {
    console.error(error?.message ?? error);
    if (error?.stack) console.error(error.stack);
    process.exit(error?.exitCode ?? 1);
  });
