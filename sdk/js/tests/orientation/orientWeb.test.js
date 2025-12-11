const assert = require('node:assert/strict');
const { describe, it } = require('vitest');
const {
  buildConsciousnessWeb,
  createDefaultOrientationShell,
  orientWeb,
} = require('../../dist');

function createThread(threadId, scope) {
  const now = new Date().toISOString();
  return {
    threadId,
    scope,
    createdAt: now,
    updatedAt: now,
    phase: 'active',
    energyLevel: 0.5,
    resonanceLevel: 0.5,
  };
}

describe('orientWeb', () => {
  it('isolates active and dormant threads by sector focus', () => {
    const familyThread = createThread('family-thread', 'family');
    const individualThread = createThread('self-thread', 'individual');
    const projectThread = createThread('project-thread', 'project');
    const map = {
      ownerId: 'owner-orient',
      threads: [familyThread, individualThread, projectThread],
    };

    const web = buildConsciousnessWeb(map);
    const shell = createDefaultOrientationShell();
    const familySector = shell.sectors.find((sector) => sector.scope === 'family');
    assert.ok(familySector, 'family sector should exist in the default shell');

    const focusedShell = {
      ...shell,
      activeSectorIds: [familySector.id],
    };

    const { activeThreads, dormantThreads } = orientWeb(web, focusedShell);

    assert.equal(activeThreads.length, 1);
    assert.equal(activeThreads[0].threadId, 'family-thread');
    assert.deepEqual(
      dormantThreads.map((thread) => thread.threadId).sort(),
      ['project-thread', 'self-thread'].sort()
    );
  });
});
