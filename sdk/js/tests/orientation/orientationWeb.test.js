const assert = require('node:assert/strict');
const {
  ORIENTATION_BASELINE,
  applyWebUpdates,
  chooseDominantSector,
  createOrientationWeb,
  updateActiveSector,
} = require('../../dist');

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

runTest('createOrientationWeb builds default sectors and baseline active', () => {
  const web = createOrientationWeb(['self', 'family', 'work']);

  assert.equal(Object.keys(web.sectors).length, 3);
  assert.equal(web.activeSectorId, ORIENTATION_BASELINE.activeSectorId);

  Object.values(web.sectors).forEach((sector) => {
    assert.equal(sector.tension, 0);
    assert.equal(sector.pull, 0);
    assert.equal(sector.resonance, 0);
    assert.equal(sector.phase, 'stable');
  });
});

runTest('applyWebUpdates accumulates and clamps deltas', () => {
  const web = createOrientationWeb(['self', 'family', 'work']);
  const updated = applyWebUpdates(web, [
    {
      sectorId: 'work',
      deltaTension: 0.8,
      deltaPull: 1.2,
      deltaResonance: -0.5,
      newPhase: 'rising',
    },
  ]);

  const work = updated.sectors.work;
  assert.equal(work.tension, 0.8);
  assert.equal(work.pull, 1);
  assert.equal(work.resonance, 0);
  assert.equal(work.phase, 'rising');
});

runTest('chooseDominantSector picks sector with highest score', () => {
  const web = createOrientationWeb(['self', 'family', 'work'], {
    sectors: {
      self: { id: 'self', tension: 0.1, pull: 0.2, resonance: 0.3, phase: 'stable' },
      family: { id: 'family', tension: 0.3, pull: 0.5, resonance: 0.5, phase: 'stable' },
      work: { id: 'work', tension: 0.9, pull: 0.1, resonance: 0.1, phase: 'stable' },
    },
    activeSectorId: 'self',
  });

  assert.equal(chooseDominantSector(web), 'family');
});

runTest('updateActiveSector switches deterministically when a stronger sector appears', () => {
  const web = createOrientationWeb(['self', 'family', 'work'], {
    sectors: {
      self: { id: 'self', tension: 0.1, pull: 0.2, resonance: 0.3, phase: 'stable' },
      family: { id: 'family', tension: 0.3, pull: 0.5, resonance: 0.5, phase: 'stable' },
      work: { id: 'work', tension: 0.9, pull: 0.1, resonance: 0.1, phase: 'stable' },
    },
    activeSectorId: 'self',
  });

  const updated = updateActiveSector(web);
  assert.equal(updated.activeSectorId, 'family');
});

runTest('chooseDominantSector keeps current active sector when scores tie', () => {
  const web = createOrientationWeb(['a', 'b'], {
    sectors: {
      a: { id: 'a', tension: 0.2, pull: 0.2, resonance: 0.2, phase: 'stable' },
      b: { id: 'b', tension: 0.2, pull: 0.2, resonance: 0.2, phase: 'stable' },
    },
    activeSectorId: 'b',
  });

  assert.equal(chooseDominantSector(web), 'b');
});

runTest('applyWebUpdates returns original when updates array is empty', () => {
  const web = createOrientationWeb(['self', 'family']);
  const updated = applyWebUpdates(web, []);

  assert.equal(updated, web);
});

runTest('applyWebUpdates ignores missing sectorId safely', () => {
  const web = createOrientationWeb(['self', 'family']);
  const updated = applyWebUpdates(web, [
    {
      sectorId: 'work',
      deltaTension: 0.5,
    },
  ]);

  assert.deepEqual(updated.sectors, web.sectors);
});

runTest('applyWebUpdates ignores invalid phase updates', () => {
  const web = createOrientationWeb(['self']);
  const updated = applyWebUpdates(web, [
    {
      sectorId: 'self',
      deltaPull: 0.1,
      newPhase: 'invalid-phase',
    },
  ]);

  assert.equal(updated.sectors.self.phase, 'stable');
  assert.equal(updated.sectors.self.pull, 0.1);
});
