import { spawn } from 'node:child_process';

function collect(command: string, args: string[]) {
  return new Promise<{ exitCode: number; logs: string[]; errors: string[] }>((resolve) => {
    const cli = spawn(command, args);

    const logs: string[] = [];
    const errors: string[] = [];

    cli.stdout.on('data', (data) => logs.push(data.toString()));
    cli.stderr.on('data', (data) => errors.push(data.toString()));

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
  const pnpmAttempt = await collect('pnpm', ['-w', 'ltp:inspect', '--', ...args]);
  if (pnpmAttempt.exitCode === 0) return pnpmAttempt;
  if (!pnpmAttempt.errors.join('\n').includes('ts-node: not found')) return pnpmAttempt;

  return collect('npx', ['ts-node', 'tools/ltp-inspect/inspect.ts', ...args]);
}
