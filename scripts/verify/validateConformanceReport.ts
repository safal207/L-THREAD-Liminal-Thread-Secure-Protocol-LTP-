import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

type Cli = {
  reportPath?: string;
  schemaPath?: string;
  help?: boolean;
};

function parseArgs(argv: string[]): Cli {
  const out: Cli = {};
  const args = [...argv];

  // positional: first non-flag is reportPath
  for (let i = 0; i < args.length; i++) {
    const a = args[i];

    if (a === '--help' || a === '-h') out.help = true;

    if (a === '--schema') out.schemaPath = args[i + 1];
    if (a.startsWith('--schema=')) out.schemaPath = a.slice('--schema='.length);

    if (a === '--report') out.reportPath = args[i + 1];
    if (a.startsWith('--report=')) out.reportPath = a.slice('--report='.length);
  }

  if (!out.reportPath) {
    const positional = args.find((x) => !x.startsWith('-'));
    if (positional) out.reportPath = positional;
  }

  return out;
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage:
  pnpm -w ltp:report:validate -- <reportPath> [--schema <schemaPath>]

Examples:
  pnpm -w ltp:report:validate -- artifacts/conformance-report.json
  pnpm -w ltp:report:validate -- artifacts/conformance-report.json --schema schemas/ltp-conformance-report.v0.1.json
`);
}

function readJsonFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);

  if (args.help) {
    printHelp();
    process.exitCode = 0;
    return;
  }

  const reportPath = args.reportPath ? path.resolve(args.reportPath) : undefined;

  const schemaPath = path.resolve(args.schemaPath ?? 'schemas/ltp-conformance-report.v0.1.json');

  if (!reportPath) {
    // eslint-disable-next-line no-console
    console.error('Missing report path. Run with --help for usage.');
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(reportPath)) {
    // eslint-disable-next-line no-console
    console.error(`Report file not found: ${reportPath}`);
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(schemaPath)) {
    // eslint-disable-next-line no-console
    console.error(`Schema file not found: ${schemaPath}`);
    process.exitCode = 1;
    return;
  }

  const report = readJsonFile(reportPath);
  const schema = readJsonFile(schemaPath);

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const validate = ajv.compile(schema as any);
  const ok = validate(report);

  if (ok) {
    // eslint-disable-next-line no-console
    console.log(`Conformance report is valid ✅ (${path.basename(schemaPath)})`);
    process.exitCode = 0;
    return;
  }

  // eslint-disable-next-line no-console
  console.error(`Conformance report is INVALID ❌ (${path.basename(schemaPath)})`);
  for (const err of validate.errors ?? []) {
    // eslint-disable-next-line no-console
    console.error(`- ${err.instancePath || '/'} ${err.message}`);
  }

  process.exitCode = 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  });
}
