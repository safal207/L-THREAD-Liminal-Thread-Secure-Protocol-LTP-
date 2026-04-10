import { spawn } from 'node:child_process';

const PNPM_COMMAND = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const NPX_COMMAND = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function collect(command: string, args: string[]) {
  return new Promise<{ exitCode: number; logs: string[]; errors: string[] }>((resolve) => {
    const cli = spawn(command, args, { shell: process.platform === 'win32' });

    const logs: string[] = [];
    const errors: string[] = [];

    cli.stdout.on('data', (data) => logs.push(data.toString()));
    cli.stderr.on('data', (data) => errors.push(data.toString()));

    cli.on('error', (error) => {
      resolve({ exitCode: 1, logs, errors: [error.message] });
    });

    cli.on('close', (code) => {
      const filteredErrors = errors
        .join('')
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0 && !line.toLowerCase().startsWith('npm warn'));
      resolve({ exitCode: code ?? 1, logs, errors: filteredErrors });
    });
  });
}

export async function runInspectCLI(args: string[]) {
  const scriptAttempt = await collect(PNPM_COMMAND, ['-w', 'run', 'ltp:inspect', '--', ...args]);
  if (scriptAttempt.exitCode === 0) return scriptAttempt;

  const execAttempt = await collect(PNPM_COMMAND, ['-w', 'exec', 'ts-node', 'tools/ltp-inspect/inspect.ts', ...args]);
  if (execAttempt.exitCode === 0) return execAttempt;

  const npxAttempt = await collect(NPX_COMMAND, ['ts-node', 'tools/ltp-inspect/inspect.ts', ...args]);
  if (npxAttempt.exitCode === 0) return npxAttempt;

  return scriptAttempt;
}
