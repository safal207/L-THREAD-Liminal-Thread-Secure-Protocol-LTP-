const assert = require('node:assert/strict');
const {
  buildConsciousnessWeb,
  createDefaultOrientationShell,
  orientWeb,
} = require('../dist');

function createThread(overrides = {}) {
  const now = new Date().toISOString();
  return {
    threadId: `thread-${Math.random().toString(16).slice(2, 8)}`,
    scope: 'individual',
    createdAt: now,
    updatedAt: now,
    phase: 'active',
    energyLevel: 0.5,
    resonanceLevel: 0.5,
    ...overrides,
  };
}

function runTest(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`✔ ${name}`))
    .catch((error) => {
      console.error(`✖ ${name}`);
      console.error(error);
      process.exitCode = 1;
    });
}

runTest('Build web with parent-child links and metrics', () => {
  const parent = createThread({ threadId: 'p1', scope: 'family' });
  const childA = createThread({ threadId: 'c1', parentThreadId: 'p1', scope: 'family' });
  const childB = createThread({ threadId: 'c2', parentThreadId: 'p1', scope: 'family' });
  const map = { ownerId: 'owner-x', threads: [parent, childA, childB] };

  const web = buildConsciousnessWeb(map);

  const parentChildLinks = web.links.filter((link) => link.kind === 'parent-child');
  assert.equal(parentChildLinks.length, 2);
  assert.ok(parentChildLinks.every((link) => link.fromId === 'p1'));

  const parentMetrics = web.metrics.find((metric) => metric.threadId === 'p1');
  const leafMetrics = web.metrics.find((metric) => metric.threadId === 'c1');
  assert.ok(parentMetrics.degree > leafMetrics.degree);
});

runTest('Shared scope and shared tag links are detected', () => {
  const threadA = createThread({ threadId: 'tA', scope: 'project', tags: ['liminal-os', 'coordination'] });
  const threadB = createThread({ threadId: 'tB', scope: 'project', tags: ['coordination'] });
  const threadC = createThread({ threadId: 'tC', scope: 'system', tags: ['liminal-os'] });
  const map = { ownerId: 'owner-y', threads: [threadA, threadB, threadC] };

  const web = buildConsciousnessWeb(map);

  const sharedScopeLinks = web.links.filter((link) => link.kind === 'shared-scope');
  const sharedTagLinks = web.links.filter((link) => link.kind === 'shared-tag');

  assert.ok(sharedScopeLinks.length >= 1);
  assert.ok(sharedTagLinks.length >= 1);
});

runTest('Orientation shell isolates family sector', () => {
  const individual = createThread({ threadId: 'i1', scope: 'individual' });
  const family = createThread({ threadId: 'f1', scope: 'family' });
  const map = { ownerId: 'owner-z', threads: [individual, family] };

  const web = buildConsciousnessWeb(map);
  const shell = createDefaultOrientationShell();
  const familySector = shell.sectors.find((sector) => sector.scope === 'family');
  shell.activeSectorIds = familySector ? [familySector.id] : [];

  const { activeThreads, dormantThreads } = orientWeb(web, shell);

  assert.equal(activeThreads.length, 1);
  assert.equal(activeThreads[0].threadId, 'f1');
  assert.ok(dormantThreads.some((thread) => thread.threadId === 'i1'));
});

runTest('Orientation shell isolates liminal tag sector', () => {
  const liminalThread = createThread({ threadId: 'l1', tags: ['liminal-os'], scope: 'project' });
  const otherThread = createThread({ threadId: 'o1', scope: 'project' });
  const map = { ownerId: 'owner-w', threads: [liminalThread, otherThread] };

  const web = buildConsciousnessWeb(map);
  const shell = createDefaultOrientationShell();
  const liminalSector = shell.sectors.find((sector) => sector.requiredTags?.includes('liminal-os'));
  shell.activeSectorIds = liminalSector ? [liminalSector.id] : [];

  const { activeThreads, dormantThreads } = orientWeb(web, shell);

  assert.equal(activeThreads.length, 1);
  assert.equal(activeThreads[0].threadId, 'l1');
  assert.ok(dormantThreads.some((thread) => thread.threadId === 'o1'));
});
