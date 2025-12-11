const assert = require('node:assert/strict');
const { describe, it } = require('vitest');
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

describe('thread life model', () => {
  it('transitions from birth to active when intent arrives', () => {
    const thread = createThread();
    const event = { type: 'new-opportunity', timestamp: new Date().toISOString() };
    const transition = computeNextPhase(thread, event);
    const updated = applyTransition(thread, transition, event.timestamp);

    assert.equal(transition.to, 'active');
    assert.equal(updated.phase, 'active');
    assert.equal(updated.updatedAt, event.timestamp);
  });

  it('weakens active thread after attention drops', () => {
    const thread = createThread({ phase: 'active', energyLevel: 0.5, resonanceLevel: 0.5 });
    const event = { type: 'drop-in-attention', timestamp: new Date().toISOString() };
    const transition = computeNextPhase(thread, event);
    const updated = applyTransition(thread, transition, event.timestamp);

    assert.equal(transition.to, 'weakening');
    assert.equal(updated.phase, 'weakening');
    assert.ok(transition.reason.toLowerCase().includes('attention'));
  });

  it('allows weakening thread to switch and become active again', () => {
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

  it('archives threads on shutdown when energy is low', () => {
    const thread = createThread({ phase: 'active', energyLevel: 0.05 });
    const event = { type: 'shutdown-request', timestamp: new Date().toISOString() };
    const transition = computeNextPhase(thread, event);
    const updated = applyTransition(thread, transition, event.timestamp);

    assert.equal(updated.phase, 'archived');
    assert.equal(transition.to, 'archived');
  });

  it('registers unique threads in thread map', () => {
    const first = createThread({ threadId: 'unique-thread' });
    const second = createThread({ threadId: 'unique-thread' });
    const map = registerNewThread({ ownerId: 'owner-2', threads: [] }, first);
    const duplicate = registerNewThread(map, second);

    assert.equal(map.threads.length, 1);
    assert.equal(duplicate.threads.length, 1);
  });
});
