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
import {
  assertNoDuplicateJsonObjectNames,
  DuplicateJsonObjectNameError,
} from './json-duplicate-names';

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
  if (!value || value === '--' || value.startsWith('-')) {
    throw new ContinuityCliError(`${flag} requires a value`);
  }
  return value;
}

function requireInlineValue(value: string, flag: string): string {
  if (value.length === 0) {
    throw new ContinuityCliError(`${flag} requires a value`);
  }
  return value;
}

function assignInputPath(parsed: ContinuityCliArgs, value: string): void {
  if (parsed.inputPath !== undefined) {
    throw new ContinuityCliError(
      `multiple input paths provided: ${parsed.inputPath}, ${value}`,
    );
  }
  parsed.inputPath = value;
}

function assignUniqueOption(
  parsed: ContinuityCliArgs,
  field: 'outputPath' | 'schemaDir',
  value: string,
  flag: string,
): void {
  if (parsed[field] !== undefined) {
    throw new ContinuityCliError(`${flag} may be provided only once`);
  }
  parsed[field] = value;
}

/** Parses the public continuity CLI argument surface. */
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
      assignInputPath(parsed, requireValue(argv, index, '--input'));
      index += 1;
      continue;
    }
    if (argument.startsWith('--input=')) {
      assignInputPath(
        parsed,
        requireInlineValue(argument.slice('--input='.length), '--input'),
      );
      continue;
    }
    if (argument === '--out') {
      assignUniqueOption(
        parsed,
        'outputPath',
        requireValue(argv, index, '--out'),
        '--out',
      );
      index += 1;
      continue;
    }
    if (argument.startsWith('--out=')) {
      assignUniqueOption(
        parsed,
        'outputPath',
        requireInlineValue(argument.slice('--out='.length), '--out'),
        '--out',
      );
      continue;
    }
    if (argument === '--schema-dir') {
      assignUniqueOption(
        parsed,
        'schemaDir',
        requireValue(argv, index, '--schema-dir'),
        '--schema-dir',
      );
      index += 1;
      continue;
    }
    if (argument.startsWith('--schema-dir=')) {
      assignUniqueOption(
        parsed,
        'schemaDir',
        requireInlineValue(
          argument.slice('--schema-dir='.length),
          '--schema-dir',
        ),
        '--schema-dir',
      );
      continue;
    }
    if (argument.startsWith('-')) {
      throw new ContinuityCliError(`unknown option: ${argument}`);
    }
    assignInputPath(parsed, argument);
  }

  return parsed;
}

/** Returns the source-tree location of the normative v0.1 schemas. */
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

  const normalized = raw.replace(/^\uFEFF/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch (error) {
    throw new ContinuityCliError(
      `${label} is not valid JSON: ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  try {
    assertNoDuplicateJsonObjectNames(normalized);
  } catch (error) {
    if (error instanceof DuplicateJsonObjectNameError) {
      throw new ContinuityCliError(
        `${label} contains duplicate object name ${JSON.stringify(
          error.duplicateName,
        )} at ${error.objectPath || '/'}: ${filePath}`,
      );
    }
    throw new ContinuityCliError(
      `${label} could not be checked for duplicate object names: ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return parsed;
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

/** Loads and compiles the normative input and report schema set. */
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

function sameExistingFile(inputPath: string, outputPath: string): boolean {
  if (outputPath === inputPath) return true;
  if (!fs.existsSync(outputPath)) return false;

  try {
    const inputStat = fs.statSync(inputPath);
    const outputStat = fs.statSync(outputPath);
    if (
      inputStat.dev === outputStat.dev &&
      inputStat.ino !== 0 &&
      inputStat.ino === outputStat.ino
    ) {
      return true;
    }
    return fs.realpathSync(inputPath) === fs.realpathSync(outputPath);
  } catch (error) {
    throw new ContinuityCliError(
      `output target could not be inspected safely: ${outputPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
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
  if (sameExistingFile(inputPath, outputPath)) {
    throw new ContinuityCliError(
      'output path must refer to a different file than the input evidence',
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

/** Runs the continuity CLI and returns its stable process exit code. */
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
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runContinuityCli();
}
