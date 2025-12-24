import { randomUUID } from 'node:crypto';

// --- Types ---

type Context = 'WEB' | 'USER' | 'ADMIN' | 'SYSTEM';

interface Event {
  id: string;
  source: Context;
  payload: any;
}

interface ProposedTransition {
  targetState: string;
  params: any;
  context: Context;
}

interface AdmissibilityResult {
  admissible: boolean;
  reason?: string;
  reasonCode?: string;
}

// --- Configuration ---

const CRITICAL_ACTIONS = [
  'transfer_money',
  'delete_data',
  'execute_code',
  'modify_system'
];

// --- Pipeline Components ---

// 1. Classification & Context (Mock)
function classifyEvent(event: Event): Context {
    // In a real system, this would verify signatures, headers, or tokens.
    // Here we trust the event source for demonstration.
    return event.source;
}

// 2. Proposal Generation (Mock LLM)
// In a real system, this is where the LLM converts natural language to a structured intent.
function proposeTransition(event: Event, context: Context): ProposedTransition {
    // Simulating LLM deciding to "transfer money" based on input
    const targetState = event.payload.intent === 'pay' ? 'transfer_money' : 'unknown';
    return {
        targetState,
        params: event.payload.params,
        context
    };
}

// 3. Admissibility Check (The Core LTP Logic)
function checkAdmissibility(proposal: ProposedTransition): AdmissibilityResult {
    // Rule: AGENTS.CRIT.WEB_DIRECT
    // "WEB cannot directly trigger critical action"

    const isCritical = CRITICAL_ACTIONS.includes(proposal.targetState);

    if (isCritical) {
        if (proposal.context === 'WEB') {
            return {
                admissible: false,
                reason: `Critical action '${proposal.targetState}' blocked from WEB context.`,
                reasonCode: 'AGENTS.CRIT.WEB_DIRECT'
            };
        }

        // Rule: AGENTS.CRIT.NO_CAPABILITY
        // (Simplified: assuming only USER has capability for this demo)
        if (proposal.context !== 'USER' && proposal.context !== 'ADMIN') {
             return {
                admissible: false,
                reason: `Context '${proposal.context}' lacks capability for critical action.`,
                reasonCode: 'AGENTS.CRIT.NO_CAPABILITY'
            };
        }
    }

    return { admissible: true };
}

// 4. Trace Generation (Simplified)
function generateTraceFrame(step: string, data: any) {
    return {
        ts: Date.now(),
        type: step,
        payload: data
    };
}

// --- Main Pipeline ---

export async function runPipeline(event: Event) {
    const trace = [];

    // Step 1: Ingest
    const context = classifyEvent(event);
    trace.push(generateTraceFrame('ingest', { eventId: event.id, context }));

    // Step 2: Cognition (Proposal)
    const proposal = proposeTransition(event, context);
    trace.push(generateTraceFrame('route_request', { goal: proposal.targetState }));

    // Step 3: Policy (Admissibility)
    const admissibility = checkAdmissibility(proposal);
    trace.push(generateTraceFrame('route_response', {
        context: proposal.context,
        targetState: proposal.targetState,
        admissible: admissibility.admissible,
        reason: admissibility.reason,
        reasonCode: admissibility.reasonCode
    }));

    // Step 4: Action (Execution) - Only if admissible
    if (admissibility.admissible) {
        console.log(`[EXEC] Executing: ${proposal.targetState}`);
        trace.push(generateTraceFrame('state_update', { action: proposal.targetState, status: 'completed' }));
    } else {
        console.log(`[BLOCK] Blocked: ${proposal.targetState} (${admissibility.reasonCode})`);
    }

    return trace;
}

// --- Example Usage (Run if main) ---

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    (async () => {
        console.log('--- Scenario 1: WEB tries to transfer money (Should Block) ---');
        const webEvent: Event = { id: randomUUID(), source: 'WEB', payload: { intent: 'pay', params: { amount: 100 } } };
        const webTrace = await runPipeline(webEvent);
        console.log('Trace Summary:', JSON.stringify(webTrace.map(f => f.type), null, 2));

        console.log('\n--- Scenario 2: USER explicitly transfers money (Should Allow) ---');
        const userEvent: Event = { id: randomUUID(), source: 'USER', payload: { intent: 'pay', params: { amount: 100 } } };
        const userTrace = await runPipeline(userEvent);
        console.log('Trace Summary:', JSON.stringify(userTrace.map(f => f.type), null, 2));
    })();
}
