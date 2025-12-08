import assert from 'node:assert/strict';
import { createOrientationWeb } from '../../orientation/orientationWeb';
import type { OrientationWeb } from '../../orientation/orientationWeb.types';
import { buildTemporalOrientationView, suggestNextSector } from '../temporalOrientationEngine';
import type { TemporalOrientationView } from '../temporalOrientationTypes';
import { appendNodeToBranch, createEmptyWeave } from '../../time/timeWeave';
import type { TimeBranch, TimeWeave } from '../../time/timeWeaveTypes';

function runTest(name: string, fn: () => void): void {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`✔ ${name}`))
    .catch((error) => {
      console.error(`✖ ${name}`);
      console.error(error);
      process.exitCode = 1;
    });
}

function createWebWithSectors(ids: string[]): OrientationWeb {
  const web = createOrientationWeb(ids, {
    sectors: ids.reduce<OrientationWeb['sectors']>((acc, id) => {
      acc[id] = { id, tension: 0, pull: 0, resonance: 0, phase: 'stable' };
      return acc;
    }, {}),
    activeSectorId: ids[0],
  });

  return web;
}

function buildBranch(threadId: string, nodes: { tick: number; intensity: number }[]): TimeBranch {
  return {
    threadId,
    nodes: nodes.map((node, index) => ({
      id: `${threadId}-${index}`,
      tick: node.tick,
      intensity: node.intensity,
      phase: 'stable',
    })),
  };
}

runTest('handles empty weave with simple web', () => {
  const web = createWebWithSectors(['a', 'b']);
  const weave = createEmptyWeave();

  const view = buildTemporalOrientationView(web, weave);

  assert.strictEqual(view.sectors.length, 2);
  view.sectors.forEach((sectorSnapshot) => {
    assert.strictEqual(sectorSnapshot.isActive, false);
    assert.strictEqual(sectorSnapshot.branchTrend, undefined);
  });
  assert.strictEqual(view.summary.globalTrend, 'plateau');
});

runTest('marks single rising branch', () => {
  const web = createWebWithSectors(['r1']);
  let weave: TimeWeave = createEmptyWeave();
  weave = appendNodeToBranch(weave, 'r1', { id: 'n1', tick: 1, intensity: 0.2, phase: 'emerging' });
  weave = appendNodeToBranch(weave, 'r1', { id: 'n2', tick: 2, intensity: 0.6, phase: 'emerging' });
  weave = appendNodeToBranch(weave, 'r1', { id: 'n3', tick: 3, intensity: 0.9, phase: 'emerging' });

  const view = buildTemporalOrientationView(web, weave);
  const snapshot = view.sectors[0];
  assert.ok(snapshot);

  assert.strictEqual(snapshot.branchTrend, 'rising');
  assert.strictEqual(snapshot.isActive, true);
  assert.deepStrictEqual(view.summary.risingSectors, ['r1']);
  assert.strictEqual(view.summary.globalTrend, 'rising');
});

runTest('detects rising and falling mix', () => {
  const web = createWebWithSectors(['rise', 'fall']);
  const risingBranch = buildBranch('rise', [
    { tick: 1, intensity: 0.2 },
    { tick: 2, intensity: 0.5 },
    { tick: 3, intensity: 0.8 },
  ]);
  const fallingBranch = buildBranch('fall', [
    { tick: 1, intensity: 0.9 },
    { tick: 2, intensity: 0.5 },
    { tick: 3, intensity: 0.4 },
  ]);

  const weave: TimeWeave = {
    branches: [risingBranch, fallingBranch],
  };

  const view = buildTemporalOrientationView(web, weave);
  const trends = view.sectors.map((item) => item.branchTrend);

  assert.deepStrictEqual(trends.sort(), ['falling', 'rising']);
  assert.strictEqual(view.summary.globalTrend, 'mixed');
  assert.strictEqual(view.summary.activeSectorCount, 2);
});

runTest('suggests next sector based on rising trend', () => {
  const web = createWebWithSectors(['falling', 'rising']);
  const weave: TimeWeave = {
    branches: [
      buildBranch('falling', [
        { tick: 1, intensity: 0.8 },
        { tick: 2, intensity: 0.5 },
        { tick: 3, intensity: 0.3 },
      ]),
      buildBranch('rising', [
        { tick: 1, intensity: 0.2 },
        { tick: 2, intensity: 0.6 },
        { tick: 3, intensity: 0.9 },
      ]),
    ],
  };

  const view: TemporalOrientationView = buildTemporalOrientationView(web, weave);
  const suggestion = suggestNextSector(view, 'falling');

  assert.strictEqual(suggestion.suggestedSectorId, 'rising');
  assert.ok(suggestion.reason.length > 0);
});
