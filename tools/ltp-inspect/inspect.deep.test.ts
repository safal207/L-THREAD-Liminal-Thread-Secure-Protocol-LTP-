import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { execute } from './inspect';

const shouldRunDeep = process.env.LTP_INSPECT_DEEP === '1';

const describeDeep = shouldRunDeep ? describe : describe.skip;

function createRng(seed = 1337): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function randomChoice<T>(rng: () => number, options: T[]): T {
  return options[Math.floor(rng() * options.length)];
}

function generateLine(rng: () => number): string {
  const variant = randomChoice(rng, ['valid', 'valid', 'valid', 'multi', 'invalid', 'legacy']);
  switch (variant) {
    case 'valid':
      return JSON.stringify({
        v: '0.1',
        type: randomChoice(rng, ['orientation', 'focus_snapshot', 'route_response']),
        id: `id-${Math.floor(rng() * 1000)}`,
        continuity_token: 'ct-fuzz',
        payload: rng() > 0.5 ? { drift: rng() } : { branches: { A: { confidence: 0.5, status: 'admissible' } } },
      });
    case 'multi':
      return '{"v":"0.1"} {"v":"0.1"}';
    case 'legacy':
      return '[{"v":"0.1"}]';
    case 'invalid':
    default:
      return '{"v":"0.1"';
  }
}

function expectNoFatal(errors: string[]) {
  expect(errors.join('\n')).not.toMatch(/(TypeError|ReferenceError|ENOENT|EACCES|Unhandled|FATAL|panic)/i);
}

describeDeep('ltp-inspect deep fuzz/property tests', () => {
  it('never crashes and returns stable exit codes for randomized JSONL', () => {
    const rng = createRng(2024);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ltp-inspect-fuzz-'));

    try {
      for (let i = 0; i < 25; i += 1) {
        const filePath = path.join(tmpDir, `case-${i}.jsonl`);
        const lines = Array.from({ length: 5 }, () => generateLine(rng));
        const content = (rng() > 0.5 ? '\uFEFF' : '') + lines.join('\n') + '\n';
        fs.writeFileSync(filePath, content, 'utf-8');

        const logs: string[] = [];
        const errors: string[] = [];
        const exitCode = execute(['trace', '--input', filePath, '--format=json', '--quiet'], {
          log: (m) => logs.push(m),
          error: (m) => errors.push(m),
        });

        expect([0, 1, 2]).toContain(exitCode);
        expectNoFatal(errors);

        if (exitCode === 0 || exitCode === 1) {
          expect(() => JSON.parse(logs.join('\n'))).not.toThrow();
        }
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
