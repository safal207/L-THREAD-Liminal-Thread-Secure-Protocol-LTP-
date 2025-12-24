import { InfraObserver } from './observer';
import { InfraEvents, InfraEvent } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Minimal Trace Schema for LTP v0.1 compat
interface TraceEntry {
  hash: string;
  previous_hash: string;
  timestamp: string;
  type: string;
  payload: any;
}

function sha256(data: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

async function runSimulation() {
  const observer = new InfraObserver();
  const trace: TraceEntry[] = [];
  let previousHash = "0000000000000000000000000000000000000000000000000000000000000000";

  // Defined scenario: 7 events showing progression and recovery
  const events: InfraEvent[] = [
    'CONNECTION_BACKLOG_GROWING', // -> DEGRADED
    'CONNECTION_BACKLOG_GROWING', // (Stay DEGRADED)
    'QUEUE_LATENCY_SPIKE',        // -> SATURATED
    'WS_RECONNECT_STORM',         // (Stay SATURATED)
    'HEARTBEAT_TIMEOUT_CLUSTER',  // -> FAILED
    'METRICS_STABILIZED',         // -> RECOVERING
    'RECOVERY_COMPLETE'           // -> HEALTHY
  ];

  console.log(`Starting simulation. Initial State: ${observer.getCurrentState()}`);

  // 1. Initial State Record
  const initPayload = {
    state: observer.getCurrentState(),
    message: "Simulation Start"
  };
  const initEntry: TraceEntry = {
    hash: "",
    previous_hash: previousHash,
    timestamp: new Date().toISOString(),
    type: "orientation", // Using standard frame type
    payload: initPayload,
    // @ts-ignore
    v: "0.1"
  };
  initEntry.hash = sha256({ previous_hash: initEntry.previous_hash, timestamp: initEntry.timestamp, type: initEntry.type, payload: initEntry.payload });
  trace.push(initEntry);
  previousHash = initEntry.hash;

  // 2. Event Loop
  for (const event of events) {
    console.log(`\nEvent: ${event}`);

    // Log the event itself (ContentEvent in LTP terms)
    const eventPayload = { event };
    const eventEntry: TraceEntry = {
      hash: "",
      previous_hash: previousHash,
      timestamp: new Date().toISOString(),
      type: "hello", // Mapping generic event to hello/heartbeat or custom for now, using hello as generic signal in this simplifed trace
      payload: eventPayload,
      // @ts-ignore
      v: "0.1"
    };
    eventEntry.hash = sha256({ previous_hash: eventEntry.previous_hash, timestamp: eventEntry.timestamp, type: eventEntry.type, payload: eventEntry.payload });
    trace.push(eventEntry);
    previousHash = eventEntry.hash;

    const proposal = observer.evaluateEvent(event);
    if (proposal) {
      console.log(`  -> Proposed Transition: ${proposal.from} -> ${proposal.to}`);
      console.log(`     Reason: ${proposal.explanation}`);

      // Log Proposed Transition
      const propEntry: TraceEntry = {
        hash: "",
        previous_hash: previousHash,
        timestamp: new Date().toISOString(),
        type: "route_request", // Mapping proposal to route_request
        payload: {
          target_urn: "urn:ltp:infra:state-manager",
          transition: proposal
        },
        // @ts-ignore
        v: "0.1"
      };
      propEntry.hash = sha256({ previous_hash: propEntry.previous_hash, timestamp: propEntry.timestamp, type: propEntry.type, payload: propEntry.payload });
      trace.push(propEntry);
      previousHash = propEntry.hash;

      // Commit Transition (Admissibility -> route_response)
      observer.commitTransition(proposal);

      const responseEntry: TraceEntry = {
        hash: "",
        previous_hash: previousHash,
        timestamp: new Date().toISOString(),
        type: "route_response",
        payload: {
            allowed: true,
            new_orientation: proposal.to
        },
        // @ts-ignore
        v: "0.1"
      };
      responseEntry.hash = sha256({ previous_hash: responseEntry.previous_hash, timestamp: responseEntry.timestamp, type: responseEntry.type, payload: responseEntry.payload });
      trace.push(responseEntry);
      previousHash = responseEntry.hash;

    } else {
      console.log("  -> No state change.");
    }
  }

  // Write Trace
  const tracePath = path.join(__dirname, '../infra.trace.json');
  fs.writeFileSync(tracePath, JSON.stringify(trace, null, 2));
  console.log(`\nTrace generated at: ${tracePath}`);
}

runSimulation().catch(console.error);
