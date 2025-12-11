import {
  ThreadEvent,
  ThreadLifeTransition,
  ThreadMap,
  ThreadPhase,
  ThreadVector,
} from './threadLifeModel.types';

const ENERGY_WEAKEN_THRESHOLD = 0.3;
const ENERGY_ARCHIVE_THRESHOLD = 0.1;
const RESONANCE_SWITCH_DELTA = 0.05;

function clampLevel(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function isActivationEvent(event: ThreadEvent): boolean {
  return event.type === 'goal-updated' || event.type === 'new-opportunity';
}

function isSwitchEvent(event: ThreadEvent): boolean {
  return event.type === 'new-opportunity' || event.type === 'family-resonance';
}

function deriveResonanceHint(event: ThreadEvent, currentResonance: number): number {
  const payloadResonance = event.payload?.resonanceLevel;
  if (typeof payloadResonance === 'number') {
    return clampLevel(payloadResonance);
  }
  // Default heuristic: opportunities nudge resonance up slightly
  return clampLevel(currentResonance + 0.1);
}

export function computeNextPhase(
  thread: ThreadVector,
  event: ThreadEvent
): ThreadLifeTransition {
  const normalizedEnergy = clampLevel(thread.energyLevel);
  const normalizedResonance = clampLevel(thread.resonanceLevel);

  if (event.type === 'shutdown-request' || normalizedEnergy < ENERGY_ARCHIVE_THRESHOLD) {
    return {
      from: thread.phase,
      to: 'archived',
      reason:
        event.type === 'shutdown-request'
          ? 'Shutdown requested for thread lifecycle.'
          : 'Energy depleted below archival threshold.',
    };
  }

  switch (thread.phase) {
    case 'birth': {
      if (isActivationEvent(event)) {
        return {
          from: 'birth',
          to: 'active',
          reason: 'Initial intent or opportunity activated the thread.',
        };
      }
      break;
    }
    case 'active': {
      if (event.type === 'drop-in-attention' || normalizedEnergy < ENERGY_WEAKEN_THRESHOLD) {
        return {
          from: 'active',
          to: 'weakening',
          reason: 'Attention dropped or energy dipped below healthy range.',
        };
      }
      break;
    }
    case 'weakening': {
      if (isSwitchEvent(event)) {
        const hintedResonance = deriveResonanceHint(event, normalizedResonance);
        if (hintedResonance > normalizedResonance + RESONANCE_SWITCH_DELTA) {
          return {
            from: 'weakening',
            to: 'switching',
            reason: 'New opportunity with stronger resonance detected.',
          };
        }
      }
      break;
    }
    case 'switching': {
      if (event.type === 'goal-updated' || event.type === 'success') {
        return {
          from: 'switching',
          to: 'active',
          reason: 'New trajectory confirmed through intent or success.',
        };
      }
      break;
    }
    case 'archived': {
      return {
        from: 'archived',
        to: 'archived',
        reason: 'Thread remains archived.',
      };
    }
    default:
      break;
  }

  return {
    from: thread.phase,
    to: thread.phase,
    reason: 'No transition triggered by event.',
  };
}

function adjustEnergyLevel(phase: ThreadPhase, current: number): number {
  if (phase === 'active') {
    return clampLevel(current + 0.05);
  }
  if (phase === 'weakening') {
    return clampLevel(current - 0.05);
  }
  if (phase === 'archived') {
    return 0;
  }
  return current;
}

function adjustResonanceLevel(transition: ThreadLifeTransition, current: number): number {
  if (transition.to === 'active') {
    return clampLevel(current + 0.05);
  }
  if (transition.to === 'weakening') {
    return clampLevel(current - 0.03);
  }
  if (transition.to === 'archived') {
    return clampLevel(current - 0.1);
  }
  if (transition.reason.toLowerCase().includes('success')) {
    return clampLevel(current + 0.05);
  }
  return current;
}

export function applyTransition(
  thread: ThreadVector,
  transition: ThreadLifeTransition,
  timestamp: string
): ThreadVector {
  const nextEnergy = adjustEnergyLevel(transition.to, thread.energyLevel);
  const nextResonance = adjustResonanceLevel(transition, thread.resonanceLevel);

  return {
    ...thread,
    phase: transition.to,
    updatedAt: timestamp,
    energyLevel: nextEnergy,
    resonanceLevel: nextResonance,
  };
}

export function registerNewThread(map: ThreadMap, thread: ThreadVector): ThreadMap {
  if (map.threads.some((existing) => existing.threadId === thread.threadId)) {
    return map;
  }
  return {
    ...map,
    threads: [...map.threads, thread],
  };
}

export function updateThreadFromEvent(
  map: ThreadMap,
  threadId: string,
  event: ThreadEvent,
  timestamp: string
): ThreadMap {
  const threads = map.threads.map((thread) => {
    if (thread.threadId !== threadId) {
      return thread;
    }
    const transition = computeNextPhase(thread, event);
    return applyTransition(thread, transition, timestamp);
  });

  return { ...map, threads };
}

export function summarizeThreadMap(map: ThreadMap): {
  averageEnergy: number;
  averageResonance: number;
  volatility: number;
} {
  if (!map.threads.length) {
    return { averageEnergy: 0.5, averageResonance: 0.5, volatility: 0.2 };
  }

  const energyLevels = map.threads.map((thread) => clampLevel(thread.energyLevel));
  const resonanceLevels = map.threads.map((thread) => clampLevel(thread.resonanceLevel));

  const averageEnergy = energyLevels.reduce((sum, value) => sum + value, 0) / energyLevels.length;
  const averageResonance = resonanceLevels.reduce((sum, value) => sum + value, 0) / resonanceLevels.length;

  const energyVariance =
    energyLevels.reduce((variance, value) => variance + (value - averageEnergy) ** 2, 0) / energyLevels.length;
  const resonanceVariance =
    resonanceLevels.reduce((variance, value) => variance + (value - averageResonance) ** 2, 0) / resonanceLevels.length;

  const volatility = clampLevel((Math.sqrt(energyVariance + resonanceVariance) * 0.7 + (1 - averageResonance) * 0.3) / 1.5);

  return { averageEnergy, averageResonance, volatility };
}
