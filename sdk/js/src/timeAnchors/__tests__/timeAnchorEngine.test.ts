import assert from 'node:assert/strict';
import { createEmptyWeave } from '../../time/timeWeave';
import {
  anchorEventToWeave,
  anchorEventsBatch,
  resolveThreadIdForSector,
} from '../timeAnchorEngine';
import type { OrientationEvent, TimeAnchorContext } from '../timeAnchorTypes';

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

function makeEvent(overrides: Partial<OrientationEvent> = {}): OrientationEvent {
  return {
    sectorId: 'S-A',
    ...overrides,
  } as OrientationEvent;
}

runTest('resolveThreadIdForSector prefers explicit threadId and falls back to sector', () => {
  const explicitThread = resolveThreadIdForSector(makeEvent({ threadId: 'T-1' }));
  assert.equal(explicitThread, 'T-1');

  const fallbackThread = resolveThreadIdForSector(makeEvent({ sectorId: 'S-B', threadId: undefined }));
  assert.equal(fallbackThread, 'S-B');
});

runTest('single event anchors to new branch with clamped intensity', () => {
  const ctx: TimeAnchorContext = { weave: createEmptyWeave() };
  const event = makeEvent({ activationLevel: 0.8 });

  const { weave, anchorNode, branch } = anchorEventToWeave(event, ctx);

  assert.equal(weave.branches.length, 1);
  assert.equal(branch.threadId, 'S-A');
  assert.ok(anchorNode.tick);
  assert.equal(anchorNode.intensity, 0.8);
});

runTest('event without activationLevel uses defaultIntensity', () => {
  const ctx: TimeAnchorContext = { weave: createEmptyWeave(), defaultIntensity: 0.42 };
  const event = makeEvent({ activationLevel: undefined });

  const { anchorNode } = anchorEventToWeave(event, ctx);
  assert.equal(anchorNode.intensity, 0.42);
});

runTest('two events for same sector are sorted by tick', () => {
  const ctx: TimeAnchorContext = { weave: createEmptyWeave() };
  const earlier = makeEvent({ timestamp: 10, activationLevel: 0.1 });
  const later = makeEvent({ timestamp: 20, activationLevel: 0.3 });

  const afterFirst = anchorEventToWeave(earlier, ctx);
  const afterSecond = anchorEventToWeave(later, { ...ctx, weave: afterFirst.weave });

  const branch = afterSecond.weave.branches[0];
  assert.ok(branch);
  assert.deepEqual(branch.nodes.map((node) => node.tick), [10, 20]);
});

runTest('batch anchoring with empty list keeps weave unchanged', () => {
  const initialWeave = createEmptyWeave();
  const ctx: TimeAnchorContext = { weave: initialWeave };

  const result = anchorEventsBatch([], ctx);
  assert.equal(result, initialWeave);
});

runTest('phase mapping applies phaseHint to node phase', () => {
  const ctx: TimeAnchorContext = { weave: createEmptyWeave() };
  const event = makeEvent({ activationLevel: 0.6, phaseHint: 'emerging' });

  const { anchorNode } = anchorEventToWeave(event, ctx);
  assert.equal(anchorNode.phase, 'emerging');
});
