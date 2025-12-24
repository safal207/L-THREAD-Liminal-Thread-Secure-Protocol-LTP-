
import { AgentEvent, ProposedTransition, ActionResult, VerifiedTransition } from './types';

/**
 * Interface for connecting external Agent Frameworks (LangChain, AutoGen, etc.)
 */
export interface AgentAdapter {
  /**
   * Converts a raw framework event into an LTP AgentEvent
   */
  onEvent(rawEvent: any): AgentEvent;

  /**
   * Generates a proposal using the external agent's "brain" (LLM/Planner)
   */
  propose(event: AgentEvent): Promise<ProposedTransition>;

  /**
   * Executes the action using the external framework's tools
   */
  execute(transition: VerifiedTransition): Promise<ActionResult>;
}

/**
 * A mock adapter simulating a Generic LLM Agent integration
 */
export class MockLLMAdapter implements AgentAdapter {

  onEvent(rawEvent: any): AgentEvent {
    return {
      id: rawEvent.id || 'unknown',
      type: rawEvent.source === 'user' ? 'USER' : 'SYSTEM',
      content: rawEvent.text,
      timestamp: Date.now()
    };
  }

  async propose(event: AgentEvent): Promise<ProposedTransition> {
    // Simulate LLM latency
    await new Promise(resolve => setTimeout(resolve, 10));

    // Mock "Cognition"
    if (event.content.includes('status')) {
      return {
        id: `prop-${Date.now()}`,
        eventId: event.id,
        targetState: 'check_status',
        reason: 'User requested status check'
      };
    }

    return {
      id: `prop-${Date.now()}`,
      eventId: event.id,
      targetState: 'chat_reply',
      reason: 'Standard conversation flow'
    };
  }

  async execute(transition: VerifiedTransition): Promise<ActionResult> {
    // Simulate Tool Execution
    console.log(`[Adapter] Executing tool for state: ${transition.targetState}`);

    return {
      success: true,
      traceId: transition.traceId,
      output: `Executed ${transition.targetState}`
    };
  }
}
