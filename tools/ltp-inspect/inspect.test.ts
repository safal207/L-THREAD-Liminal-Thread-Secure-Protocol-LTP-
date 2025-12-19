import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runInspect } from './inspect';

const fixturePath = path.join(__dirname, 'fixtures', 'minimal.frames.jsonl');
const expectedPath = path.join(__dirname, 'expected', 'summary.yaml');

describe('ltp-inspect golden summary', () => {
  it('emits stable, ordered output', () => {
    const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
    const summary = runInspect(fixturePath);

    expect(summary).toEqual(expected);
    expect(JSON.stringify(summary, null, 2)).toEqual(JSON.stringify(expected, null, 2));
  });
});
