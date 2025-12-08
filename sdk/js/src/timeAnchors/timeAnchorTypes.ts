import type {
  TimeBranch,
  TimeNode,
  TimePhase,
  TimeTick,
  TimeWeave,
} from '../time/timeWeaveTypes';
import type { OrientationWeb, OrientationWebUpdate } from '../orientation/orientationWeb.types';

export type OrientationEvent = OrientationWebUpdate & {
  threadId?: string;
  /** Optional explicit intensity for the anchor (0..1 recommended) */
  activationLevel?: number;
  /** Optional timestamp to map into TimeWeave ticks */
  timestamp?: TimeTick;
  /** Optional hint for phase mapping into TimeWeave */
  phaseHint?: string;
};

export interface TimeAnchorContext {
  weave: TimeWeave;
  web?: OrientationWeb;
  defaultIntensity?: number;
  defaultPhase?: TimePhase;
}

export interface AnchorResult {
  weave: TimeWeave;
  anchorNode: TimeNode;
  branch: TimeBranch;
}
