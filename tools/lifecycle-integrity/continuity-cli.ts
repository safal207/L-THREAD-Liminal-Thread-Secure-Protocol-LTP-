import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { ErrorObject, ValidateFunction } from 'ajv';
import {
  type ContinuityReport,
  type ContinuityVerificationInput,
  verifyRequestOutcomeContinuity,
} from './continuity';

const SCHEMA_FILES = {
  request: 'ltp-request-envelope.v0.1.schema.json',
  outcome: 'ltp-outcome-envelope.v0.1.schema.json',
  input: 'ltp-request-outcome-continuity-input.v0.1.schema.json',
  report: 'ltp-request-outcome-continuity-report.v0.1.schema.json',
} as const;

export type ContinuityCliArgs = {
  inputPath?: string;
  outputPath?: string;
  schemaDir?: string;
  allowBroken: boolean;
  compact: boolean;
  help: boolean;
};

export type ContinuityCliIo = {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
};

export class ContinuityCliError extends Error {}

const defaultIo: ContinuityCliIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value === '--') {
    throw new ContinuityCliError(`${flag} requires a value`);
  }
  return value;
}

export function parseContinuityCliArgs(argv: string[]): ContinuityCliArgs {
  const parsed: ContinuityCliArgs = {
    allowBroken: false,
    compact: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--') continue;
    if (argument === '--help' || argument === '-h') {
      parsed.help = true;
      continue;
    }
    if (argument === '--allow-broken') {
      parsed.allowBroken = true;
      continue;
    }
    if (argument === '--compact') {
      parsed.compact = true;
      continue;
    }
    if (argument === '--input') {
      parsed.inputPath = requireValue(argv, index, '--input');
      index += 1;
      continue;
    }
    if (argument.startsWith('--input=')) {
      parsed.inputPath = argument.slice('--input='.length);
      continue;
    }
    if (argument === '--out') {
      parsed.outputPath = requireValue(argv, index, '--out');
      index += 1;
      continue;
    }
    if (argument.startsWith('--out=')) {
      parsed.outputPath = argument.slice('--out='.length);
      continue;
    }
    if (argument === '--schema-dir') {
      parsed.schemaDir = requireValue(argv, index, '--schema-dir');
      index += 1;
      continue;
    }
    if (argument.startsWith('--schema-dir=')) {
      parsed.schemaDir = argument.slice('--schema-dir='.length);
      continue;
    }
    if (argument.startsWith('-')) {
      throw new ContinuityCliError(`unknown option: ${argument}`);
    }
    if (parsed.inputPath) {
      throw new ContinuityCliError(
        `multiple input paths provided: ${parsed.inputPath}, ${argument}`,
      );
    }
    parsed.inputPath = argument;
  }

  return parsed;
}

export function defaultContinuitySchemaDir(): string {
  return path.resolve(__dirname, '../../docs/contracts');
}

function helpText(): string {
  return `Usage:
  pnpm -w ltp:continuity -- <input.json> [--out <report.json>]
  pnpm -w ltp:continuity -- --input <input.json> [options]

Options:
  --out <path>         Write the JSON report to a file instead of stdout.
  --schema-dir <path>  Override the directory containing the v0.1 schemas.
  --compact            Emit compact JSON instead of two-space indentation.
  --allow-broken       Return exit code 0 even when the verdict is BROKEN.
  -h, --help           Show this help.

Exit codes:
  0  Input is valid and the verdict is not BROKEN, or --allow-broken was used.
  1  Usage, I/O, JSON Schema, or semantic validation failed.
  2  Verification completed and the continuity verdict is BROKEN.
`;
}

function readJsonFile(filePath: string, label: string): unknown {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new ContinuityCliError(
      `${label} could not be read: ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new ContinuityCliError(
      `${label} is not valid JSON: ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function schemaPath(schemaDir: string, fileName: string): string {
  return path.resolve(schemaDir, fileName);
}

function formatSchemaErrors(errors: ErrorObject[] | null | undefined): string {
  return [...(errors ?? [])]
    .map(
      (error) =>
        `- ${error.instancePath || '/'} ${
          error.message ?? `failed ${error.keyword}`
        }`,
    )
    .sort(compareText)
    .join('\n');
}

function assertSchema(
  validator: ValidateFunction,
  value: unknown,
  label: string,
): void {
  if (validator(value)) return;
  const details = formatSchemaErrors(validator.errors);
  throw new ContinuityCliError(
    `${label} does not match its JSON Schema${details ? `:\n${details}` : ''}`,
  );
}

export function createContinuitySchemaValidators(
  schemaDir = defaultContinuitySchemaDir(),
): {
  validateInput: ValidateFunction;
  validateReport: ValidateFunction;
} {
  const resolvedDir = path.resolve(schemaDir);
  const requestSchema = readJsonFile(
    schemaPath(resolvedDir, SCHEMA_FILES.request),
    'request envelope schema',
  );
  const outcomeSchema = readJsonFile(
    schemaPath(resolvedDir, SCHEMA_FILES.outcome),
    'outcome envelope schema',
  );
  const inputSchema = readJsonFile(
    schemaPath(resolvedDir, SCHEMA_FILES.input),
    'continuity input schema',
  );
  const reportSchema = readJsonFile(
    schemaPath(resolvedDir, SCHEMA_FILES.report),
    'continuity report schema',
  );

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addSchema(requestSchema);
  ajv.addSchema(outcomeSchema);

  return {
    validateInput: ajv.compile(inputSchema),
    validateReport: ajv.compile(reportSchema),
  };
}

function writeReport(
  report: ContinuityReport,
  args: ContinuityCliArgs,
  inputPath: string,
  io: ContinuityCliIo,
): void {
  const json = `${JSON.stringify(report, null, args.compact ? 0 : 2)}\n`;
  if (!args.outputPath) {
    io.stdout(json);
    return;
  }

  const outputPath = path.resolve(args.outputPath);
  if (outputPath === inputPath) {
    throw new ContinuityCliError(
      'output path must differ from the input path to avoid overwriting evidence',
    );
  }

  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, json, 'utf8');
  } catch (error) {
    throw new ContinuityCliError(
      `continuity report could not be written: ${outputPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  io.stdout(
    `Continuity report written: ${outputPath} (${report.overall_status})\n`,
  );
}

export function runContinuityCli(
  argv = process.argv.slice(2),
  io: ContinuityCliIo = defaultIo,
): number {
  try {
    const args = parseContinuityCliArgs(argv);

    if (args.help) {
      io.stdout(helpText());
      return 0;
    }
    if (!args.inputPath) {
      throw new ContinuityCliError(
        'missing input path; run with --help for usage',
      );
    }

    const inputPath = path.resolve(args.inputPath);
    const input = readJsonFile(inputPath, 'continuity input');
    const validators = createContinuitySchemaValidators(args.schemaDir);
    assertSchema(validators.validateInput, input, 'continuity input');

    const report = verifyRequestOutcomeContinuity(
      input as ContinuityVerificationInput,
    );
    assertSchema(validators.validateReport, report, 'generated continuity report');
    writeReport(report, args, inputPath, io);

    return report.overall_status === 'BROKEN' && !args.allowBroken ? 2 : 0;
  } catch (error) {
    io.stderr(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runContinuityCli();
}
