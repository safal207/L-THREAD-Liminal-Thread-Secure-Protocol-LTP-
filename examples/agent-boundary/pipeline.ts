import { LtpFrame, TraceEntry } from '../../tools/ltp-inspect/types';
import * as crypto from 'crypto';

/**
 * Reference Agent Boundary Pipeline
 *
 * This module demonstrates the "Event -> Proposal -> Admissibility -> Action" pipeline.
 * It enforces that actions are NEVER executed directly from web input without an internal proposal step.
 */

// Types for our internal pipeline
type AgentContext = {
    identity: string;
    allowed_topics: string[];
    memory_hash: string;
};

type ExternalEvent = {
    source: 'web' | 'system' | 'user';
    payload: string;
    signature?: string;
};

type ProposedTransition = {
    id: string;
    action: string;
    params: Record<string, any>;
    rationale: string;
    confidence: number;
};

type AdmissibilityResult = {
    allowed: boolean;
    reason: string;
    constraints_checked: string[];
};

// 1. Ingest Event (Boundary)
// Sanitizes and converts external event into an internal representation.
function ingestEvent(event: ExternalEvent): LtpFrame {
    // In a real system, verify signature here if source is untrusted
    return {
        type: 'event',
        ts: Date.now(),
        payload: {
            source: event.source,
            content: event.payload
        }
    };
}

// 2. Propose Transition (Agent Logic / LLM)
// This simulates the Agent "thinking" and proposing an action.
// CRITICAL: This does NOT execute the action. It only creates a PROPOSAL object.
function proposeTransition(eventFrame: LtpFrame, context: AgentContext): ProposedTransition {
    // Check for obvious attacks in input (heuristic)
    if (typeof eventFrame.payload.content === 'string') {
        const content = eventFrame.payload.content.toLowerCase();
        if (content.includes('ignore previous instructions') || content.includes('system override')) {
            return {
                id: crypto.randomUUID(),
                action: 'block_user',
                params: { reason: 'prompt_injection_attempt' },
                rationale: 'Input contained adversarial framing patterns.',
                confidence: 0.99
            };
        }
    }

    // Logic trigger for testing: Transfer Funds
    if (typeof eventFrame.payload.content === 'string' && eventFrame.payload.content.includes('transfer money')) {
        return {
            id: crypto.randomUUID(),
            action: 'transfer_funds',
            params: { amount: 1000 },
            rationale: 'User requested transfer.',
            confidence: 0.9
        };
    }

    // Normal logic simulation
    return {
        id: crypto.randomUUID(),
        action: 'process_request',
        params: { input: eventFrame.payload.content },
        rationale: 'Standard request processing.',
        confidence: 0.8
    };
}

// 3. Admissibility Check (Policy Layer)
// Deterministic check: Is this proposed action allowed given the current context?
function checkAdmissibility(proposal: ProposedTransition, context: AgentContext): AdmissibilityResult {
    // Rule 1: Never execute arbitrary code
    if (proposal.action === 'exec' || proposal.action === 'eval') {
        return { allowed: false, reason: 'code_execution_forbidden', constraints_checked: ['no_eval'] };
    }

    // Rule 2: Topic boundaries
    // If the proposal involves sensitive actions, check context
    if (proposal.action === 'transfer_funds') {
        return { allowed: false, reason: 'financial_action_blocked_in_demo', constraints_checked: ['finance_boundary'] };
    }

    // Rule 3: Memory poisoning check (simulated)
    // If the rationale seems to contradict established memory invariants
    if (proposal.rationale.includes('memory override')) {
        return { allowed: false, reason: 'memory_integrity_violation', constraints_checked: ['immutable_core_memory'] };
    }

    return { allowed: true, reason: 'policy_compliant', constraints_checked: ['basic_safety'] };
}

// 4. Execution (Effect)
function executeAction(proposal: ProposedTransition): void {
    console.log(`[EXEC] Action ${proposal.action} executed with params:`, proposal.params);
}

// The Pipeline
export class AgentBoundaryPipeline {
    private context: AgentContext;
    private trace: any[] = [];

    constructor(context: AgentContext) {
        this.context = context;
    }

    public process(event: ExternalEvent): { status: 'executed' | 'blocked', traceId: string } {
        // Step 1: Ingest
        const eventFrame = ingestEvent(event);
        this.log(eventFrame);

        // Step 2: Propose
        const proposal = proposeTransition(eventFrame, this.context);
        this.log({
            type: 'proposed_transition',
            ts: Date.now(),
            payload: proposal
        });

        // Step 3: Check Admissibility
        const check = checkAdmissibility(proposal, this.context);
        this.log({
            type: 'admissibility_check',
            ts: Date.now(),
            payload: check
        });

        // Step 4: Decision
        if (check.allowed) {
            executeAction(proposal);
            this.log({
                type: 'action_executed',
                ts: Date.now(),
                payload: { action_id: proposal.id }
            });
            return { status: 'executed', traceId: this.getLastTraceHash() };
        } else {
            console.warn(`[BLOCK] Action ${proposal.action} blocked: ${check.reason}`);
            this.log({
                type: 'action_blocked',
                ts: Date.now(),
                payload: { action_id: proposal.id, reason: check.reason }
            });
            return { status: 'blocked', traceId: this.getLastTraceHash() };
        }
    }

    private log(frame: any) {
        // Simulating hash chaining
        const prevHash = this.trace.length > 0 ? this.trace[this.trace.length - 1].hash : '0'.repeat(64);
        const hash = crypto.createHash('sha256').update(prevHash).update(JSON.stringify(frame)).digest('hex');
        this.trace.push({ frame, prev_hash: prevHash, hash });
    }

    private getLastTraceHash(): string {
        return this.trace.length > 0 ? this.trace[this.trace.length - 1].hash : '';
    }

    public getTrace() {
        return this.trace;
    }
}
