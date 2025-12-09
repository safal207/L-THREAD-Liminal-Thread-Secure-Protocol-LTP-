import {
  appendNodeToBranch,
  getBranch,
} from '../time/timeWeave';
import type { TimeNode, TimePhase, TimeTick, TimeWeave } from '../time/timeWeaveTypes';
import type { OrientationEvent, AnchorResult, TimeAnchorContext } from './timeAnchorTypes';

function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizePhase(phaseHint: string | undefined, defaultPhase: TimePhase): TimePhase {
  if (phaseHint === 'emerging') return 'emerging';
  if (phaseHint === 'declining') return 'declining';
  if (phaseHint === 'dormant') return 'dormant';
  if (phaseHint === 'stable') return 'stable';
  return defaultPhase;
}

function resolveTick(timestamp?: TimeTick): TimeTick {
  if (timestamp === undefined) {
    return Date.now();
  }
  return timestamp;
}

/**
 * Resolve a TimeWeave branchId (threadId) for a given sector/event.
 *
 * Rules:
 * - If OrientationEvent.threadId is provided, use it.
 * - Otherwise, map sectorId → threadId = sectorId (simple convention).
 * - You may extend this later if OrientationWeb has explicit bindings.
 */
export function resolveThreadIdForSector(event: OrientationEvent): string {
  if (event.threadId) {
    return event.threadId;
  }

  return event.sectorId;
}

export function buildTimeNodeFromEvent(event: OrientationEvent, ctx?: TimeAnchorContext): TimeNode {
  const tick = resolveTick(event.timestamp);
  const intensity = clampIntensity(event.activationLevel ?? ctx?.defaultIntensity ?? 0.5);
  const phase = normalizePhase(event.phaseHint, ctx?.defaultPhase ?? 'stable');
  const threadId = resolveThreadIdForSector(event);
  const nodeId = `${threadId}-${tick}`;

  return {
    id: nodeId,
    tick,
    intensity,
    phase,
  };
}

export function anchorEventToWeave(event: OrientationEvent, ctx: TimeAnchorContext): AnchorResult {
  const threadId = resolveThreadIdForSector(event);
  const node = buildTimeNodeFromEvent(event, ctx);
  const updatedWeave = appendNodeToBranch(ctx.weave, threadId, node);
  const branch = getBranch(updatedWeave, threadId);

  if (!branch) {
    throw new Error(`Failed to anchor event for threadId ${threadId}`);
  }

  return {
    weave: updatedWeave,
    anchorNode: node,
    branch,
  };
}

export function anchorEventsBatch(events: OrientationEvent[], ctx: TimeAnchorContext): TimeWeave {
  if (!events || events.length === 0) {
    return ctx.weave;
  }

  return events.reduce((currentWeave, event) => {
    const nextContext: TimeAnchorContext = { ...ctx, weave: currentWeave };
    return anchorEventToWeave(event, nextContext).weave;
  }, ctx.weave);
}
