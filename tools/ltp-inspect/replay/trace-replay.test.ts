import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatReplay } from './formatter';
import { replayTrace } from './trace-replay';

const SAMPLE_TRACE = [
  '{"id":"t1","status":"admissible","payload":{"text":"Paris is the capital of France."}}',
  '{"id":"t2","status":"admissible","payload":{"text":"France is in Europe."}}',
  '{"id":"t3","status":"drifted","payload":{"text":"Unanchored claim."}}',
  'INVALID JSON LINE',
  '',
].join('\n');

function withTempTrace(content: string, run: (file: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ltp-replay-'));
  const file = path.join(dir, 'trace.jsonl');

  try {
    fs.writeFileSync(file, content, 'utf-8');
    run(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('replayTrace', () => {
  it('parses JSONL and preserves order without timestamps', () => {
    withTempTrace(SAMPLE_TRACE, (file) => {
      const steps = replayTrace(file);
      expect(steps).toHaveLength(3);
      expect(steps.map((s) => s.id)).toEqual(['t1', 't2', 't3']);
      expect(steps.map((s) => s.index)).toEqual([1, 2, 3]);
      expect(steps[0].text).toBe('Paris is the capital of France.');
      expect(steps[2].status).toBe('drift');
    });
  });

  it('uses unknown status when missing', () => {
    withTempTrace('{"id":"t1"}', (file) => {
      const steps = replayTrace(file);
      expect(steps[0].status).toBe('unknown');
    });
  });

  it('sorts chronologically when timestamps are present', () => {
    const trace = [
      '{"id":"late","timestamp":"2024-01-01T00:00:02.000Z"}',
      '{"id":"early","timestamp":"2024-01-01T00:00:01.000Z"}',
    ].join('\n');

    withTempTrace(trace, (file) => {
      const steps = replayTrace(file);
      expect(steps.map((s) => s.id)).toEqual(['early', 'late']);
      expect(steps.map((s) => s.index)).toEqual([1, 2]);
    });
  });

  it('never throws for missing files', () => {
    expect(replayTrace('/tmp/does-not-exist/never.jsonl')).toEqual([]);
  });
});

describe('formatReplay', () => {
  it('includes header, id/status and text, and skips undefined text', () => {
    const output = formatReplay(
      [
        { index: 1, id: 't1', status: 'admissible', text: 'alpha' },
        { index: 2, id: 't2', status: 'unknown' },
      ],
      false,
    );

    expect(output).toContain('--- LTP Trace Replay ---');
    expect(output).toContain('[1] t1 (admissible)');
    expect(output).toContain('    alpha');
    expect(output).toContain('[2] t2 (unknown)');
  });

  it('applies ANSI colors when enabled and omits when disabled', () => {
    const colored = formatReplay([{ index: 1, id: 't1', status: 'rejected' }], true);
    const plain = formatReplay([{ index: 1, id: 't1', status: 'rejected' }], false);

    expect(colored).toContain('\u001b[31mrejected\u001b[0m');
    expect(plain).toContain('(rejected)');
    expect(plain).not.toContain('\u001b[31m');
  });

  it('truncates text longer than 500 chars and keeps exactly 500 chars unchanged', () => {
    const exact = 'a'.repeat(500);
    const long = 'b'.repeat(501);
    const output = formatReplay(
      [
        { index: 1, id: 'exact', status: 'admissible', text: exact },
        { index: 2, id: 'long', status: 'admissible', text: long },
      ],
      false,
    );

    expect(output).toContain(`    ${exact}`);
    expect(output).toContain(`    ${'b'.repeat(500)}...(truncated)`);
  });
});
