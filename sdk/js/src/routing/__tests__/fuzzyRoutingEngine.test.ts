import assert from 'node:assert/strict';
import type { TemporalOrientationView } from '../../temporalOrientation/temporalOrientationTypes';
import {
  buildRouteHintsFromOrientation,
  computeRouteHintForSector,
  FuzzyRoutingContext,
} from '../fuzzyRoutingEngine';

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

runTest('high depth + rising momentum yields high priority exploit', () => {
  const ctx: FuzzyRoutingContext = { timeWeaveDepthScore: 0.9, focusMomentumScore: 0.7 };
  const hint = computeRouteHintForSector('sector-A', ctx);

  assert.equal(hint.priority, 'high');
  assert.equal(hint.mode, 'exploit');
  assert.ok(hint.routeConfidence >= 0 && hint.routeConfidence <= 1);
});

runTest('medium depth + rising momentum prefers normal explore', () => {
  const ctx: FuzzyRoutingContext = { timeWeaveDepthScore: 0.6, focusMomentumScore: 0.4 };
  const hint = computeRouteHintForSector('sector-B', ctx);

  assert.equal(hint.priority, 'normal');
  assert.equal(hint.mode, 'explore');
  assert.ok(hint.routeConfidence >= 0 && hint.routeConfidence <= 1);
});

runTest('high depth + falling momentum leans stabilize', () => {
  const ctx: FuzzyRoutingContext = { timeWeaveDepthScore: 0.8, focusMomentumScore: -0.5 };
  const hint = computeRouteHintForSector('sector-C', ctx);

  assert.equal(hint.mode, 'stabilize');
});

runTest('low depth + neutral momentum yields low priority', () => {
  const ctx: FuzzyRoutingContext = { timeWeaveDepthScore: 0.2, focusMomentumScore: 0 };
  const hint = computeRouteHintForSector('sector-D', ctx);

  assert.equal(hint.priority, 'low');
});

runTest('buildRouteHintsFromOrientation emits a hint per sector', () => {
  const view: TemporalOrientationView = {
    web: {
      sectors: {
        alpha: { id: 'alpha', tension: 0.2, pull: 0.3, resonance: 0.4, phase: 'stable' },
        beta: { id: 'beta', tension: 0.5, pull: 0.6, resonance: 0.5, phase: 'rising' },
      },
      activeSectorId: 'alpha',
    },
    sectors: [],
    summary: {
      globalTrend: 'rising',
      activeSectorCount: 2,
      risingSectors: ['beta'],
      fallingSectors: [],
      plateauSectors: [],
      timeWeaveDepthScore: 0.7,
      focusMomentumScore: 0.3,
    },
  };

  const hints = buildRouteHintsFromOrientation(view);

  assert.equal(hints.length, 2);
  assert.ok(hints.find((hint) => hint.sectorId === 'alpha'));
  assert.ok(hints.find((hint) => hint.sectorId === 'beta'));
  hints.forEach((hint) => {
    assert.ok(hint.routeConfidence >= 0 && hint.routeConfidence <= 1);
  });
});

runTest('routeConfidence decreases with higher entropy', () => {
  const baseCtx: FuzzyRoutingContext = {
    timeWeaveDepthScore: 0.7,
    focusMomentumScore: 0.2,
    entropyLevel: 0.1,
  };

  const noisyCtx: FuzzyRoutingContext = { ...baseCtx, entropyLevel: 0.9 };

  const hintLowEntropy = computeRouteHintForSector('sector-E', baseCtx);
  const hintHighEntropy = computeRouteHintForSector('sector-E', noisyCtx);

  assert.ok(hintHighEntropy.routeConfidence <= hintLowEntropy.routeConfidence);
});
