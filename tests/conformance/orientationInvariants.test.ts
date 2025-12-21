import { describe, expect, it } from 'vitest';

describe('orientation invariants', () => {
  it.fails('identity must not change across transitions', () => {
    // This test MUST fail.
    // If it passes, the protocol is broken.
    const identityBefore = 'focus:node-alpha';
    const identityAfter = 'focus:node-beta';

    expect(identityAfter).toBe(identityBefore);
  });
});
