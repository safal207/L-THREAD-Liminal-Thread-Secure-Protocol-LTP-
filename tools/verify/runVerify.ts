import { spawn } from 'child_process';

interface VerifyStep {
  label: string;
  command: string;
  args: string[];
}

interface StepResult {
  step: VerifyStep;
  success: boolean;
  output?: string;
}

const steps: VerifyStep[] = [
  {
    label: 'JS SDK tests',
    command: 'pnpm',
    args: ['--filter', '@liminal/ltp-client', 'test'],
  },
  {
    label: 'Canonical flow demo',
    command: 'pnpm',
    args: ['-w', 'demo:canonical-v0.1'],
  },
  {
    label: 'Conformance (ok_basic_flow.json)',
    command: 'pnpm',
    args: ['-w', 'ltp:conformance', 'verify', 'fixtures/conformance/v0.1/ok_basic_flow.json'],
  },
];

interface VerifyOptions {
  verbose: boolean;
  help: boolean;
}

function parseOptions(): VerifyOptions {
  const args = process.argv.slice(2);

  return {
    verbose: args.includes('--verbose') || args.includes('-v'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function printHelp(): void {
  console.log('Usage: pnpm -w ltp:verify [--verbose]');
  console.log('Runs the minimal LTP verification suite.');
}

function runStep(step: VerifyStep, verbose: boolean): Promise<StepResult> {
  return new Promise((resolve) => {
    const child = spawn(step.command, step.args, {
      shell: process.platform === 'win32',
      stdio: verbose ? 'inherit' : 'pipe',
    });

    let combinedOutput = '';

    if (!verbose) {
      child.stdout?.on('data', (data) => {
        combinedOutput += data.toString();
      });

      child.stderr?.on('data', (data) => {
        combinedOutput += data.toString();
      });
    }

    child.on('close', (code) => {
      resolve({
        step,
        success: code === 0,
        output: combinedOutput.trim(),
      });
    });

    child.on('error', (error) => {
      resolve({
        step,
        success: false,
        output: error.message,
      });
    });
  });
}

function printSummary(results: StepResult[]): void {
  const passed = results.filter((result) => result.success).length;
  const total = results.length;
  const failures = results.filter((result) => !result.success);

  console.log('');

  if (failures.length === 0) {
    console.log(`PASS ✅  (${passed}/${total})`);
  } else {
    console.log(`FAIL ❌  (${passed}/${total})`);
    console.log(`Failed: ${failures.map((failure) => failure.step.label).join(', ')}`);
    console.log('Re-run with --verbose for detailed output.');
  }
}

async function main(): Promise<void> {
  const options = parseOptions();

  if (options.help) {
    printHelp();
    return;
  }

  const { verbose } = options;

  console.log('LTP Verify (v0.1 core)');

  const results: StepResult[] = [];

  for (const step of steps) {
    const result = await runStep(step, verbose);
    results.push(result);

    if (result.success) {
      console.log(`✓ ${step.label}`);
    } else {
      console.log(`✗ ${step.label}`);
      if (verbose && result.output) {
        console.log(result.output);
      }
    }
  }

  printSummary(results);

  const hasFailure = results.some((result) => !result.success);
  process.exit(hasFailure ? 1 : 0);
}

main();
