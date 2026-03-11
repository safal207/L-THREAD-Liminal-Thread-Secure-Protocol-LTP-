import assert from 'node:assert/strict';
import { StateGraph, simulateFeedbackLoop } from '../stateGraph';

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

runTest('rewinds to previous valid state on contradictory feedback', () => {
  const graph = new StateGraph({ confidenceThreshold: 0.7, now: () => '2026-01-01T00:00:00.000Z' });

  const state0 = graph.addNode({ decision: 'start', confidence_score: 1 });
  const state1 = graph.addNode({ decision: 'plan A', confidence_score: 0.8 });
  const state2 = graph.addNode({ decision: 'execute plan A', confidence_score: 0.74 });

  graph.addEdge(state0.state_id, state1.state_id);
  graph.addEdge(state1.state_id, state2.state_id);

  const feedback = graph.triggerFeedback(state2.state_id, 'contradiction with env: execution blocked');
  assert.strictEqual(feedback.contradictsDecision, true);

  const trace = graph.exportTrace();
  const rewind = trace.rewind_chain[0];
  assert.ok(rewind);
  assert.strictEqual(rewind?.from, state2.state_id);
  assert.strictEqual(rewind?.to, state1.state_id);

  const revisitedEvent = trace.events.find((event) => event.event_type === 'state_revisited');
  assert.ok(revisitedEvent);
});

runTest('visualization highlights rewinds and feedback markers', () => {
  const { visualization } = simulateFeedbackLoop();

  assert.match(visualization, /REVISITED/);
  assert.match(visualization, /⚠ feedback/);
  assert.match(visualization, /rewind_paths:/);
});

runTest('trace json is deterministic with fixed clock', () => {
  const fixed = new StateGraph({ confidenceThreshold: 0.7, now: () => '2030-02-02T02:02:02.000Z' });
  const s0 = fixed.addNode({ decision: 'start', confidence_score: 1 });
  const s1 = fixed.addNode({ decision: 'plan', confidence_score: 0.9 });
  fixed.addEdge(s0.state_id, s1.state_id);

  const traceJSON = fixed.toTraceJSON(0);
  assert.ok(traceJSON.includes('"state_0"'));
  assert.ok(traceJSON.includes('"event_0"'));
  assert.ok(traceJSON.includes('"2030-02-02T02:02:02.000Z"'));
});
