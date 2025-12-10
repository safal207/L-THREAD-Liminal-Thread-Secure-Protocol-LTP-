import assert from 'node:assert/strict';
import { computeRouteHintForSector } from '../../routing/fuzzyRoutingEngine';
import { computeMomentumMetrics } from '../fuzzyMomentum';
import type { TemporalOrientationView, TemporalTrend } from '../temporalOrientationTypes';

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

function buildView(trendScalar: number): TemporalOrientationView {
  const globalTrend: TemporalTrend = trendScalar > 0.1 ? 'rising' : trendScalar < -0.1 ? 'falling' : 'plateau';
  const rising = trendScalar > 0 ? ['north'] : [];
  const falling = trendScalar < 0 ? ['south'] : [];

  return {
    web: {
      sectors: {
        test: { id: 'test', tension: 0.2, pull: 0.2, resonance: 0.2, phase: 'stable' },
      },
      activeSectorId: 'test',
    },
    sectors: [],
    summary: {
      globalTrend,
      activeSectorCount: 1,
      risingSectors: rising,
      fallingSectors: falling,
      plateauSectors: [],
      focusMomentumScore: trendScalar,
      timeWeaveDepthScore: 0.6,
    },
  };
}

runTest('rising momentum yields positive focus and higher confidence', () => {
  const history = [0.1, 0.3, 0.6].map(buildView);
  const momentum = computeMomentumMetrics(history);

  assert.equal(momentum.slope, 'rising');
  assert.ok(momentum.strength > 0.4);

  const orientationSummary = history[history.length - 1]?.summary;
  const baseline = computeRouteHintForSector('test', {
    timeWeaveDepthScore: 0.6,
    focusMomentumScore: 0,
    orientationSummary,
    entropyLevel: 0.2,
  });

  const withMomentum = computeRouteHintForSector('test', {
    timeWeaveDepthScore: 0.6,
    focusMomentumScore: 0,
    orientationSummary,
    entropyLevel: 0.2,
    momentum,
  });

  assert.ok(withMomentum.focusMomentumScore > 0);
  assert.ok(withMomentum.routeConfidence >= baseline.routeConfidence);
});

runTest('falling momentum drives negative focus and lower confidence', () => {
  const history = [0.7, 0.4, 0.2].map(buildView);
  const momentum = computeMomentumMetrics(history);

  assert.equal(momentum.slope, 'falling');
  assert.ok(momentum.strength > 0.3);

  const orientationSummary = history[history.length - 1]?.summary;
  const baseline = computeRouteHintForSector('test', {
    timeWeaveDepthScore: 0.6,
    focusMomentumScore: 0,
    orientationSummary,
    entropyLevel: 0.2,
  });

  const withMomentum = computeRouteHintForSector('test', {
    timeWeaveDepthScore: 0.6,
    focusMomentumScore: 0,
    orientationSummary,
    entropyLevel: 0.2,
    momentum,
  });

  assert.ok(withMomentum.focusMomentumScore < 0);
  assert.ok(withMomentum.routeConfidence <= baseline.routeConfidence);
});

runTest('oscillating momentum stays near neutral and avoids boosts', () => {
  const history = [0.2, 0.8, 0.3, 0.7].map(buildView);
  const momentum = computeMomentumMetrics(history);

  assert.equal(momentum.slope, 'oscillating');
  assert.ok(momentum.strength > 0);

  const orientationSummary = history[history.length - 1]?.summary;
  const baseline = computeRouteHintForSector('test', {
    timeWeaveDepthScore: 0.6,
    focusMomentumScore: 0,
    orientationSummary,
    entropyLevel: 0.2,
  });

  const withMomentum = computeRouteHintForSector('test', {
    timeWeaveDepthScore: 0.6,
    focusMomentumScore: 0,
    orientationSummary,
    entropyLevel: 0.2,
    momentum,
  });

  assert.ok(withMomentum.focusMomentumScore <= 0.05);
  assert.ok(withMomentum.focusMomentumScore >= -0.5);
  assert.ok(withMomentum.routeConfidence <= baseline.routeConfidence);
});
