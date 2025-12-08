const assert = require('node:assert/strict');
const {
  computeNextPhase,
  applyTransition,
  registerNewThread,
  updateThreadFromEvent,
} = require('../dist');

function createThread(overrides = {}) {
  const now = new Date().toISOString();
  return {
    threadId: `thread-${Math.random().toString(16).slice(2, 8)}`,
    scope: 'individual',
    createdAt: now,
    updatedAt: now,
    phase: 'birth',
    energyLevel: 0.6,
    resonanceLevel: 0.6,
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

runTest('Birth transitions to Active when intent arrives', () => {
  const thread = createThread();
  const event = { type: 'new-opportunity', timestamp: new Date().toISOString() };
  const transition = computeNextPhase(thread, event);
  const updated = applyTransition(thread, transition, event.timestamp);

  assert.equal(transition.to, 'active');
  assert.equal(updated.phase, 'active');
  assert.equal(updated.updatedAt, event.timestamp);
});

runTest('Active thread weakens after attention drops', () => {
  const thread = createThread({ phase: 'active', energyLevel: 0.5, resonanceLevel: 0.5 });
  const event = { type: 'drop-in-attention', timestamp: new Date().toISOString() };
  const transition = computeNextPhase(thread, event);
  const updated = applyTransition(thread, transition, event.timestamp);

  assert.equal(transition.to, 'weakening');
  assert.equal(updated.phase, 'weakening');
  assert.ok(transition.reason.toLowerCase().includes('attention'));
});

runTest('Weakening thread can switch and become active again', () => {
  const now = new Date().toISOString();
  const map = {
    ownerId: 'owner-1',
    threads: [createThread({ threadId: 't1', phase: 'weakening', energyLevel: 0.25, resonanceLevel: 0.3 })],
  };

  const switchEvent = { type: 'new-opportunity', timestamp: now, payload: { resonanceLevel: 0.7 } };
  const switched = updateThreadFromEvent(map, 't1', switchEvent, now);
  const switchingThread = switched.threads.find((t) => t.threadId === 't1');
  assert.equal(switchingThread.phase, 'switching');

  const activationEvent = { type: 'goal-updated', timestamp: new Date().toISOString() };
  const activated = updateThreadFromEvent(switched, 't1', activationEvent, activationEvent.timestamp);
  const activeThread = activated.threads.find((t) => t.threadId === 't1');
  assert.equal(activeThread.phase, 'active');
});

runTest('Threads archive on shutdown with low energy', () => {
  const thread = createThread({ phase: 'active', energyLevel: 0.05 });
  const event = { type: 'shutdown-request', timestamp: new Date().toISOString() };
  const transition = computeNextPhase(thread, event);
  const updated = applyTransition(thread, transition, event.timestamp);

  assert.equal(updated.phase, 'archived');
  assert.equal(transition.to, 'archived');
});

runTest('ThreadMap registers unique threads', () => {
  const first = createThread({ threadId: 'unique-thread' });
  const second = createThread({ threadId: 'unique-thread' });
  const map = registerNewThread({ ownerId: 'owner-2', threads: [] }, first);
  const duplicate = registerNewThread(map, second);

  assert.equal(map.threads.length, 1);
  assert.equal(duplicate.threads.length, 1);
});
