import { describe, it, expect, vi, afterEach } from 'vitest';
import * as verify from '../../scripts/verify/ltpVerify';

describe('isMainModule', () => {
  const originalArgv = process.argv.slice();

  afterEach(() => {
    process.argv = originalArgv.slice();
    vi.restoreAllMocks();
  });

  it('returns true when argv[1] matches current module href', () => {
    const fakePath = '/tmp/ltpVerify.ts';

    process.argv[1] = fakePath;

    expect(verify.isMainModule(fakePath, () => `file://${fakePath}`)).toBe(true);
  });

  it('returns false when argv[1] does not match current module href', () => {
    process.argv[1] = '/tmp/other.ts';

    expect(verify.isMainModule('/tmp/other.ts', () => 'file:///tmp/ltpVerify.ts')).toBe(false);
  });

  it('returns false when current module href is undefined', () => {
    process.argv[1] = '/tmp/ltpVerify.ts';

    expect(verify.isMainModule('/tmp/ltpVerify.ts', () => undefined)).toBe(false);
  });
});
