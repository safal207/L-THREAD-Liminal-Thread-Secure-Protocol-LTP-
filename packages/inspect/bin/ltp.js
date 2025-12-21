#!/usr/bin/env node
const path = require('node:path');

process.env.TS_NODE_PROJECT ||= path.join(__dirname, '..', '..', '..', 'tsconfig.json');
require('ts-node/register/transpile-only');

const { main } = require(path.join(__dirname, '..', '..', '..', 'tools', 'ltp-inspect', 'inspect'));

const args = process.argv.slice(2);
const commandArgs = args[0] === 'inspect' ? args.slice(1) : args;

main(commandArgs);
