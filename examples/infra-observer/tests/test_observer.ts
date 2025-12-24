import { InfraObserver } from '../src/observer';
import { InfraEvents, InfraState } from '../src/types';
import * as assert from 'assert';

console.log("Running InfraObserver Tests...");

const observer = new InfraObserver();

// Test Initial State
assert.strictEqual(observer.getCurrentState(), InfraState.HEALTHY, "Initial state should be HEALTHY");

// Test Transition: Healthy -> Degraded
const t1 = observer.evaluateEvent(InfraEvents.CONNECTION_BACKLOG_GROWING);
assert.ok(t1, "Should propose transition");
assert.strictEqual(t1?.to, InfraState.DEGRADED, "Should transition to DEGRADED");
observer.commitTransition(t1!);
assert.strictEqual(observer.getCurrentState(), InfraState.DEGRADED, "State should be DEGRADED");

// Test Transition: Degraded -> Saturated
const t2 = observer.evaluateEvent(InfraEvents.QUEUE_LATENCY_SPIKE);
assert.ok(t2, "Should propose transition");
assert.strictEqual(t2?.to, InfraState.SATURATED, "Should transition to SATURATED");
assert.strictEqual(t2?.recommended_pause, true, "Should recommend pause");
observer.commitTransition(t2!);
assert.strictEqual(observer.getCurrentState(), InfraState.SATURATED, "State should be SATURATED");

// Test Transition: Saturated -> Failed
const t3 = observer.evaluateEvent(InfraEvents.HEARTBEAT_TIMEOUT_CLUSTER);
assert.ok(t3, "Should propose transition");
assert.strictEqual(t3?.to, InfraState.FAILED, "Should transition to FAILED");
observer.commitTransition(t3!);
assert.strictEqual(observer.getCurrentState(), InfraState.FAILED, "State should be FAILED");

// Test Recovery
const t4 = observer.evaluateEvent(InfraEvents.METRICS_STABILIZED);
assert.ok(t4, "Should propose transition");
assert.strictEqual(t4?.to, InfraState.RECOVERING, "Should transition to RECOVERING");
observer.commitTransition(t4!);

const t5 = observer.evaluateEvent(InfraEvents.RECOVERY_COMPLETE);
assert.ok(t5, "Should propose transition");
assert.strictEqual(t5?.to, InfraState.HEALTHY, "Should transition to HEALTHY");
observer.commitTransition(t5!);
assert.strictEqual(observer.getCurrentState(), InfraState.HEALTHY, "State should be HEALTHY");

console.log("All tests passed!");
