export type RewindReason = 'low_confidence' | 'feedback_contradiction' | 'manual';

export interface AgentStateNode {
  state_id: string;
  context_snapshot: unknown;
  decision: string;
  confidence_score: number;
  timestamp: string;
  next_state_ids: string[];
  revisited: boolean;
  rewind_reason?: RewindReason | string;
}

export interface FeedbackEvent {
  state_id: string;
  feedback: string;
  contradictsDecision: boolean;
  timestamp: string;
}

export interface StateGraphEvent {
  event_id: string;
  event_type:
    | 'state_added'
    | 'transition_added'
    | 'feedback_received'
    | 'rewind_triggered'
    | 'state_revisited';
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface VisualizeOptions {
  highlightRewinds?: boolean;
  includeFeedbackMarkers?: boolean;
}

export interface RewindResult {
  rewound: boolean;
  from_state_id?: string;
  to_state_id?: string;
  reason?: RewindReason | string;
}

interface AddStateInput {
  context_snapshot?: unknown;
  decision: string;
  confidence_score: number;
  timestamp?: string;
}

interface GraphOptions {
  confidenceThreshold?: number;
  now?: () => string;
}

export class StateGraph {
  private readonly nodes = new Map<string, AgentStateNode>();
  private readonly parents = new Map<string, string[]>();
  private readonly feedbackByState = new Map<string, FeedbackEvent[]>();
  private readonly rewindChain: Array<{ from: string; to: string; reason: string; timestamp: string }> = [];
  private readonly events: StateGraphEvent[] = [];
  private sequence = 0;
  private confidenceThreshold: number;
  private readonly now: () => string;

  constructor(options: GraphOptions = {}) {
    this.confidenceThreshold = options.confidenceThreshold ?? 0.65;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  addNode(input: AddStateInput): AgentStateNode {
    const state_id = `state_${this.sequence++}`;
    const node: AgentStateNode = {
      state_id,
      context_snapshot: input.context_snapshot ?? null,
      decision: input.decision,
      confidence_score: input.confidence_score,
      timestamp: input.timestamp ?? this.now(),
      next_state_ids: [],
      revisited: false,
    };

    this.nodes.set(state_id, node);
    this.logEvent('state_added', { state_id, decision: node.decision, confidence_score: node.confidence_score });

    if (node.confidence_score < this.confidenceThreshold) {
      this.logEvent('rewind_triggered', {
        state_id,
        reason: 'low_confidence',
        confidence_score: node.confidence_score,
        threshold: this.confidenceThreshold,
      });
    }

    return { ...node, next_state_ids: [...node.next_state_ids] };
  }

  addEdge(fromStateId: string, toStateId: string): void {
    const from = this.getNodeRef(fromStateId);
    this.getNodeRef(toStateId);

    if (!from.next_state_ids.includes(toStateId)) {
      from.next_state_ids.push(toStateId);
    }

    const existingParents = this.parents.get(toStateId) ?? [];
    if (!existingParents.includes(fromStateId)) {
      this.parents.set(toStateId, [...existingParents, fromStateId]);
    }

    this.logEvent('transition_added', { from_state_id: fromStateId, to_state_id: toStateId });
  }

  triggerFeedback(stateId: string, feedback: string): FeedbackEvent {
    const node = this.getNodeRef(stateId);
    const contradictsDecision = this.isFeedbackContradicting(node, feedback);

    const feedbackEvent: FeedbackEvent = {
      state_id: stateId,
      feedback,
      contradictsDecision,
      timestamp: this.now(),
    };

    const current = this.feedbackByState.get(stateId) ?? [];
    this.feedbackByState.set(stateId, [...current, feedbackEvent]);

    this.logEvent('feedback_received', {
      state_id: stateId,
      feedback,
      contradicts_decision: contradictsDecision,
    });

    if (contradictsDecision) {
      const lastValid = this.findLastValidState(stateId);
      if (lastValid && lastValid.state_id !== stateId) {
        this.rewindToState(stateId, lastValid.state_id, 'feedback_contradiction');
      }
    }

    return feedbackEvent;
  }

  rewindToPrevious(stateId: string, reason: RewindReason | string = 'manual'): RewindResult {
    const parent = (this.parents.get(stateId) ?? [])[0];
    if (!parent) {
      return { rewound: false, from_state_id: stateId, reason };
    }

    return this.rewindToState(stateId, parent, reason);
  }

  visualize(options: VisualizeOptions = {}): string {
    const includeFeedbackMarkers = options.includeFeedbackMarkers ?? true;
    const highlightRewinds = options.highlightRewinds ?? true;

    const lines: string[] = ['state_graph:'];

    for (const node of this.getNodes()) {
      const rewindTag = highlightRewinds && node.revisited ? ' [REVISITED]' : '';
      lines.push(
        `- ${node.state_id}: ${node.decision} (confidence=${node.confidence_score.toFixed(2)})${rewindTag}`,
      );

      for (const nextId of node.next_state_ids) {
        const marker = this.hasFeedback(nextId) && includeFeedbackMarkers ? ' ⚠ feedback' : '';
        lines.push(`  -> ${nextId}${marker}`);
      }
    }

    if (highlightRewinds && this.rewindChain.length > 0) {
      lines.push('rewind_paths:');
      for (const rewind of this.rewindChain) {
        lines.push(`- ${rewind.from} ~~> ${rewind.to} (${rewind.reason})`);
      }
    }

    return lines.join('\n');
  }

  exportTrace(): {
    nodes: AgentStateNode[];
    events: StateGraphEvent[];
    rewind_chain: Array<{ from: string; to: string; reason: string; timestamp: string }>;
    feedback: FeedbackEvent[];
  } {
    return {
      nodes: this.getNodes(),
      events: [...this.events],
      rewind_chain: [...this.rewindChain],
      feedback: Array.from(this.feedbackByState.values()).flat(),
    };
  }

  toTraceJSON(space = 2): string {
    return JSON.stringify(this.exportTrace(), null, space);
  }

  setConfidenceThreshold(value: number): void {
    this.confidenceThreshold = value;
  }

  private rewindToState(
    fromStateId: string,
    toStateId: string,
    reason: RewindReason | string,
  ): RewindResult {
    const fromNode = this.getNodeRef(fromStateId);
    this.getNodeRef(toStateId);

    fromNode.revisited = true;
    fromNode.rewind_reason = reason;

    const timestamp = this.now();
    this.rewindChain.push({ from: fromStateId, to: toStateId, reason, timestamp });

    this.logEvent('rewind_triggered', { from_state_id: fromStateId, to_state_id: toStateId, reason });
    this.logEvent('state_revisited', { state_id: fromStateId, rewind_reason: reason });

    return {
      rewound: true,
      from_state_id: fromStateId,
      to_state_id: toStateId,
      reason,
    };
  }

  private hasFeedback(stateId: string): boolean {
    const feedback = this.feedbackByState.get(stateId);
    return Boolean(feedback && feedback.length > 0);
  }

  private isFeedbackContradicting(node: AgentStateNode, feedback: string): boolean {
    const normalizedFeedback = feedback.toLowerCase();
    const normalizedDecision = node.decision.toLowerCase();

    const contradictionKeywords = ['contradiction', 'conflict', 'invalid', 'reject', 'blocked', 'fails'];
    const feedbackSignalsContradiction = contradictionKeywords.some((keyword) =>
      normalizedFeedback.includes(keyword),
    );

    return (
      feedbackSignalsContradiction ||
      normalizedFeedback.includes(`not ${normalizedDecision}`) ||
      normalizedFeedback.includes(`against ${normalizedDecision}`)
    );
  }

  private findLastValidState(stateId: string): AgentStateNode | undefined {
    const visited = new Set<string>();
    const queue = [...(this.parents.get(stateId) ?? [])];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);
      const node = this.nodes.get(currentId);
      if (!node) {
        continue;
      }

      if (node.confidence_score >= this.confidenceThreshold && !node.revisited) {
        return node;
      }

      queue.push(...(this.parents.get(currentId) ?? []));
    }

    return undefined;
  }

  private getNodeRef(stateId: string): AgentStateNode {
    const node = this.nodes.get(stateId);
    if (!node) {
      throw new Error(`Unknown state_id: ${stateId}`);
    }

    return node;
  }

  private getNodes(): AgentStateNode[] {
    return Array.from(this.nodes.values()).map((node) => ({
      ...node,
      next_state_ids: [...node.next_state_ids],
    }));
  }

  private logEvent(type: StateGraphEvent['event_type'], payload: Record<string, unknown>): void {
    this.events.push({
      event_id: `event_${this.events.length}`,
      event_type: type,
      timestamp: this.now(),
      payload,
    });
  }
}

export function simulateFeedbackLoop(): {
  graph: StateGraph;
  visualization: string;
  traceJSON: string;
} {
  const graph = new StateGraph({ confidenceThreshold: 0.7 });

  const state0 = graph.addNode({ decision: 'start', confidence_score: 1, context_snapshot: { step: 0 } });
  const state1 = graph.addNode({ decision: 'plan A', confidence_score: 0.82, context_snapshot: { step: 1 } });
  const state2 = graph.addNode({
    decision: 'execute plan A',
    confidence_score: 0.68,
    context_snapshot: { step: 2 },
  });

  graph.addEdge(state0.state_id, state1.state_id);
  graph.addEdge(state1.state_id, state2.state_id);

  graph.triggerFeedback(state2.state_id, 'contradiction with env: execution blocked');

  return {
    graph,
    visualization: graph.visualize({ highlightRewinds: true, includeFeedbackMarkers: true }),
    traceJSON: graph.toTraceJSON(),
  };
}
