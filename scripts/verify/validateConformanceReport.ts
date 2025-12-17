import fs from 'node:fs';
import path from 'node:path';
import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import schema from '../../schemas/ltp-conformance-report.v0.1.json';

const DEFAULT_REPORT_PATH = path.resolve(process.cwd(), 'artifacts/conformance-report.json');
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validator = ajv.compile(schema);

type ValidationResult = {
  valid: boolean;
  errors?: ErrorObject[] | null;
};

const formatErrors = (errors: ErrorObject[] | null | undefined): string => {
  if (!errors || errors.length === 0) return 'Unknown validation error';
  return errors
    .map((err) => {
      const instancePath = err.instancePath || '/';
      const message = err.message ?? 'invalid value';
      const details = err.params ? JSON.stringify(err.params) : '';
      return `${instancePath}: ${message}${details ? ` (${details})` : ''}`;
    })
    .join('\n');
};

const readReport = (targetPath: string): unknown => {
  const resolved = path.resolve(process.cwd(), targetPath);
  const contents = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(contents);
};

export const validateReport = (report: unknown): ValidationResult => ({
  valid: Boolean(validator(report)),
  errors: validator.errors,
});

const parseArgs = (argv: string[]): { reportPath: string; help: boolean } => {
  const help = argv.includes('--help') || argv.includes('-h');
  const positional = argv.filter((arg) => !arg.startsWith('-'));
  const reportPath = positional[0] ?? DEFAULT_REPORT_PATH;
  return { reportPath, help };
};

export const main = (argv = process.argv.slice(2)): void => {
  const { reportPath, help } = parseArgs(argv);

  if (help) {
    // eslint-disable-next-line no-console
    console.log('Usage: pnpm -w ltp:report:validate -- <reportPath>');
    process.exit(0);
  }

  try {
    const report = readReport(reportPath);
    const result = validateReport(report);

    if (result.valid) {
      // eslint-disable-next-line no-console
      console.log(`✅ Conformance report is valid: ${reportPath}`);
      return;
    }

    // eslint-disable-next-line no-console
    console.error(`❌ Conformance report is invalid (${reportPath}):`);
    // eslint-disable-next-line no-console
    console.error(formatErrors(result.errors));
    process.exitCode = 2;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to validate conformance report at ${reportPath}`);
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
};

if (require.main === module) {
  main();
}
