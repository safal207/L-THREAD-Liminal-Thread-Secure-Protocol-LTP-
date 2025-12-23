#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

function loadInspector() {
  const distEntry = path.join(__dirname, '..', 'dist', 'inspect.js');
  if (fs.existsSync(distEntry)) {
    return require(distEntry);
  }

  const repoRoot = path.join(__dirname, '..', '..', '..');
  const devEntry = path.join(repoRoot, 'tools', 'ltp-inspect', 'inspect.ts');
  if (!fs.existsSync(devEntry)) {
    throw new Error(
      `Inspector entrypoint not found.\n` +
        `Tried:\n` +
        `- ${distEntry}\n` +
        `- ${devEntry}\n` +
        `\n` +
        `If you're in the monorepo, run: pnpm -C packages/inspect build`,
    );
  }

  process.env.TS_NODE_PROJECT ||= path.join(repoRoot, 'tsconfig.json');
  require('ts-node/register/transpile-only');
  return require(devEntry);
}

const args = process.argv.slice(2);
const commandArgs = args[0] === 'inspect' ? args.slice(1) : args;

const { main } = loadInspector();
Promise.resolve(main(commandArgs)).catch((err) => {
  console.error(err);
  process.exit(1);
});
