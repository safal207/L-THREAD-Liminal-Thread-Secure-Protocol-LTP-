import assert from 'node:assert/strict';
import { pickBestRouteHint } from '../smartRouterDemo';
import type { RouteHint } from '../../routing/fuzzyRoutingEngine';

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

runTest('pickBestRouteHint prefers high priority', () => {
  const hints: RouteHint[] = [
    { sectorId: 'A', priority: 'normal', mode: 'explore', depthScore: 0.6, focusMomentumScore: 0.1, reason: '...' },
    { sectorId: 'B', priority: 'high', mode: 'stabilize', depthScore: 0.7, focusMomentumScore: 0.2, reason: '...' },
  ];

  const best = pickBestRouteHint(hints);
  assert.equal(best?.sectorId, 'B');
});

runTest('pickBestRouteHint breaks ties by mode order', () => {
  const hints: RouteHint[] = [
    { sectorId: 'A', priority: 'normal', mode: 'explore', depthScore: 0.5, focusMomentumScore: 0.3, reason: '...' },
    { sectorId: 'B', priority: 'normal', mode: 'exploit', depthScore: 0.5, focusMomentumScore: 0.3, reason: '...' },
  ];

  const best = pickBestRouteHint(hints);
  assert.equal(best?.sectorId, 'B');
});

runTest('pickBestRouteHint returns null when empty', () => {
  const hints: RouteHint[] = [];
  const best = pickBestRouteHint(hints);

  assert.equal(best, null);
});
