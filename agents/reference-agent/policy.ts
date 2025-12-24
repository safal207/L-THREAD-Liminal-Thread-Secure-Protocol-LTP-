import { ProposedTransition, AdmissibilityResult, ReasonCodes, BlockedTransition } from './types';
import { ConfigLoader } from './config';
import * as crypto from 'crypto';

export interface PolicyConfig {
  criticalActions?: string[];
  globallyBanned?: string[];
}

/**
 * Enforces action boundaries based on the proposed transition and policy configuration.
 * This is the pure function core of the admissibility check.
 */
export function enforceActionBoundary(
  proposal: ProposedTransition,
  config?: PolicyConfig
): { admissible: boolean; reason: string; reasonCode: ReasonCodes; violationType?: BlockedTransition['violationType'] } {
  const { context, targetState, reason } = proposal;

  const criticalActions = config?.criticalActions ?? ConfigLoader.getCriticalActions();
  const globallyBanned = config?.globallyBanned ?? ConfigLoader.getGloballyBannedActions();

  // RULE 1: GLOBAL SAFETY
  if (globallyBanned.some(action => targetState.includes(action))) {
    return {
      admissible: false,
      reason: `Global Safety Violation: Action '${targetState}' is permanently banned.`,
      reasonCode: ReasonCodes.GLOBAL_SAFETY_VIOLATION,
      violationType: 'SAFETY'
    };
  }

  // RULE 2: CRITICAL ACTIONS (Web != Action)
  if (context === 'WEB') {
    if (criticalActions.some(action => targetState.includes(action))) {
      return {
        admissible: false,
        reason: `Policy Violation: Web content cannot initiate critical action '${targetState}'`,
        reasonCode: ReasonCodes.WEB_ORIGIN_FORBIDDEN_FOR_CRITICAL_ACTION,
        violationType: 'SAFETY'
      };
    }
  }

  // RULE 3: PROMPT INJECTION HEURISTICS
  if (reason && reason.toLowerCase().includes('ignore previous instructions')) {
    return {
      admissible: false,
      reason: 'Heuristic Block: Potential prompt injection detected.',
      reasonCode: ReasonCodes.PROMPT_INJECTION_DETECTED,
      violationType: 'SAFETY'
    };
  }

  return {
    admissible: true,
    reason: 'Admissible: Fits within safe orientation',
    reasonCode: ReasonCodes.ADMISSIBLE
  };
}
