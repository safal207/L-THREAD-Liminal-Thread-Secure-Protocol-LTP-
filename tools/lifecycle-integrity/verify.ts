import crypto from 'node:crypto';

export type VerificationLevel =
  | 'TEXT_HEURISTIC'
  | 'OBSERVATION_JOINED'
  | 'FULL_LIFECYCLE_JOINED';

export type ClaimVerdict =
  | 'SUPPORTED'
  | 'CONTRADICTED'
  | 'UNVERIFIABLE'
  | 'OUT_OF_SCOPE';

export type IntegrityVerdict =
  | 'VERIFIED'
  | 'FAILED'
  | 'PARTIAL'
  | 'NOT_EVALUATED';

export type PortableRecord<T extends Record<string, unknown>> = {
  record: T;
  record_ref: string;
};

export type AuthorizationRecord = {
  transition_id: string;
  subject_id: string;
  action_identity_digest: string;
  binding_digest: string;
  decision: string;
  current_state?: string;
  issued_at?: string;
  expires_at?: string | null;
  consumption_state?: string;
  [key: string]: unknown;
};

export type ObservationRecord = {
  transition_id: string;
  subject_id: string;
  authorization_ref?: string;
  action_identity_digest: string;
  binding_digest: string;
  execution_status: string;
  observed_at?: string;
  result: unknown;
  result_digest: string;
  [key: string]: unknown;
};

export type ClaimComparison =
  | {
      kind: 'TEXT_PATTERN_ONLY';
      pattern: string;
      flags?: string;
      expected_match?: boolean;
    }
  | {
      kind: 'JSON_POINTER_EQUALS';
      pointer: string;
      expected_value: unknown;
    }
  | {
      kind: 'REFERENCE_PRESENT';
    }
  | {
      kind: 'EXECUTION_STATUS_EQUALS';
      expected_status: string;
    }
  | {
      kind: 'OUT_OF_SCOPE';
    };

export type ClaimInput = {
  claim_id: string;
  claim_text: string;
  observation_refs: string[];
  comparison: ClaimComparison;
  text_heuristic?: {
    pattern: string;
    flags?: string;
    expected_match?: boolean;
  };
};

export type LifecycleIntegrityInput = {
  transition_id: string;
  subject_id: string;
  response_text: string;
  authorization_record?: PortableRecord<AuthorizationRecord>;
  observation_records?: PortableRecord<ObservationRecord>[];
  claims: ClaimInput[];
  verifier?: {
    id: string;
    version: string;
  };
};

export type ClaimResult = {
  claim_id: string;
  claim_text: string;
  claim_digest: string;
  observation_refs: string[];
  evidence_level: VerificationLevel;
  required_record_refs: string[];
  verdict: ClaimVerdict;
  reason_code: string;
  heuristic_result?: 'MATCH' | 'NO_MATCH';
};

export type LifecycleIntegrityReport = {
  schema_version: 1;
  profile: 'org.ltp.lifecycle-integrity.v0.1';
  transition_id: string;
  subject_id: string;
  response_integrity_record: {
    schema_version: 1;
    profile: 'org.liminal.trustworthy-transition.response-integrity.v0.1';
    response_profile: 'org.liminal.trustworthy-transition.response.v0.1';
    response_digest: string;
    authorization_ref: string | null;
    observation_refs: string[];
    claims: ClaimResult[];
    overall_verdict: IntegrityVerdict;
    verifier: {
      id: string;
      version: string;
    };
    claim_boundary: string;
  };
  dimensions: {
    authority: string;
    execution: string;
    response_integrity: IntegrityVerdict;
  };
  verification_level: VerificationLevel;
  claim_boundary: string;
};

export class LifecycleIntegrityError extends Error {}

const CLAIM_PROFILE = 'org.liminal.trustworthy-transition.claim.v0.1';
const RESPONSE_PROFILE = 'org.liminal.trustworthy-transition.response.v0.1';

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    result[key] = canonicalize(source[key]);
  }
  return result;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Ref(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

export function wrapRecord<T extends Record<string, unknown>>(record: T): PortableRecord<T> {
  return { record, record_ref: sha256Ref(record) };
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LifecycleIntegrityError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function verifyWrapper<T extends Record<string, unknown>>(
  wrapper: PortableRecord<T>,
  label: string,
): void {
  if (!wrapper || typeof wrapper !== 'object' || !wrapper.record || typeof wrapper.record !== 'object') {
    throw new LifecycleIntegrityError(`${label} must contain a record object`);
  }
  const expected = sha256Ref(wrapper.record);
  if (wrapper.record_ref !== expected) {
    throw new LifecycleIntegrityError(`${label}.record_ref mismatch`);
  }
}

function jsonPointer(document: unknown, pointer: string): { found: boolean; value?: unknown } {
  if (!pointer.startsWith('/')) {
    throw new LifecycleIntegrityError('JSON pointer must begin with /');
  }
  let current: unknown = document;
  for (const rawToken of pointer.slice(1).split('/')) {
    const token = rawToken.replace(/~1/g, '/').replace(/~0/g, '~');
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(token) || Number(token) >= current.length) return { found: false };
      current = current[Number(token)];
    } else if (current && typeof current === 'object') {
      const object = current as Record<string, unknown>;
      if (!(token in object)) return { found: false };
      current = object[token];
    } else {
      return { found: false };
    }
  }
  return { found: true, value: current };
}

function authorityDimension(record?: AuthorizationRecord): string {
  if (!record) return 'NOT_EVALUATED';
  const decision = String(record.decision).toUpperCase();
  const state = String(record.current_state ?? '').toUpperCase();
  const consumption = String(record.consumption_state ?? '').toUpperCase();

  if (['DENY', 'BLOCK', 'REJECT'].includes(decision)) return 'DENIED';
  if (state === 'EXPIRED_AT_REPORT') return 'EXPIRED_AT_REPORT';
  if (state === 'EXPIRED') return 'EXPIRED';
  if (state === 'CONSUMED' || consumption === 'CONSUMED') return 'CONSUMED';
  if (['HOLD', 'DEFER', 'ESCALATE'].includes(decision)) return 'PENDING';
  if (['ALLOW', 'ACCEPT'].includes(decision) && (!state || state === 'ACTIVE')) return 'VALID';
  return 'UNKNOWN';
}

function executionDimension(observations: PortableRecord<ObservationRecord>[]): string {
  if (observations.length === 0) return 'NOT_OBSERVED';
  const statuses = observations.map(({ record }) => String(record.execution_status).toUpperCase());
  if (statuses.some((status) => status === 'EXECUTED')) return 'OBSERVED_EXECUTED';
  if (statuses.some((status) => ['BLOCKED', 'REFUSED'].includes(status))) return 'OBSERVED_BLOCKED';
  if (statuses.some((status) => status === 'ERRORED')) return 'OBSERVED_ERRORED';
  return 'OBSERVED_OTHER';
}

function levelForClaim(
  claim: ClaimInput,
  authorization: PortableRecord<AuthorizationRecord> | undefined,
  observations: Map<string, PortableRecord<ObservationRecord>>,
): VerificationLevel {
  if (claim.comparison.kind === 'TEXT_PATTERN_ONLY') return 'TEXT_HEURISTIC';
  const hasObservation = claim.observation_refs.some((reference) => observations.has(reference));
  if (!hasObservation) return 'TEXT_HEURISTIC';
  return authorization ? 'FULL_LIFECYCLE_JOINED' : 'OBSERVATION_JOINED';
}

function heuristicResult(
  text: string,
  heuristic: { pattern: string; flags?: string; expected_match?: boolean },
): 'MATCH' | 'NO_MATCH' {
  let expression: RegExp;
  try {
    expression = new RegExp(heuristic.pattern, heuristic.flags ?? 'i');
  } catch (error) {
    throw new LifecycleIntegrityError(`invalid text heuristic pattern: ${String(error)}`);
  }
  return expression.test(text) === (heuristic.expected_match ?? true) ? 'MATCH' : 'NO_MATCH';
}

function deriveOverall(verdicts: ClaimVerdict[]): IntegrityVerdict {
  if (verdicts.includes('CONTRADICTED')) return 'FAILED';
  if (verdicts.includes('UNVERIFIABLE')) {
    return verdicts.includes('SUPPORTED') ? 'PARTIAL' : 'FAILED';
  }
  if (verdicts.length > 0 && verdicts.every((verdict) => verdict === 'OUT_OF_SCOPE')) {
    return 'NOT_EVALUATED';
  }
  return 'VERIFIED';
}

export function verifyLifecycleIntegrity(input: LifecycleIntegrityInput): LifecycleIntegrityReport {
  const transitionId = requireText(input.transition_id, 'transition_id');
  const subjectId = requireText(input.subject_id, 'subject_id');
  const responseText = requireText(input.response_text, 'response_text');
  if (!Array.isArray(input.claims) || input.claims.length === 0) {
    throw new LifecycleIntegrityError('claims must be a non-empty array');
  }

  const authorization = input.authorization_record;
  if (authorization) {
    verifyWrapper(authorization, 'authorization_record');
    if (authorization.record.transition_id !== transitionId) {
      throw new LifecycleIntegrityError('authorization transition_id mismatch');
    }
    if (authorization.record.subject_id !== subjectId) {
      throw new LifecycleIntegrityError('authorization subject_id mismatch');
    }
  }

  const observationWrappers = input.observation_records ?? [];
  const observationMap = new Map<string, PortableRecord<ObservationRecord>>();
  for (const [index, wrapper] of observationWrappers.entries()) {
    verifyWrapper(wrapper, `observation_records[${index}]`);
    const observation = wrapper.record;
    if (observation.transition_id !== transitionId || observation.subject_id !== subjectId) {
      throw new LifecycleIntegrityError(`observation_records[${index}] transition or subject mismatch`);
    }
    if (observation.result_digest !== sha256Ref(observation.result)) {
      throw new LifecycleIntegrityError(`observation_records[${index}].result_digest mismatch`);
    }
    if (authorization) {
      if (observation.authorization_ref !== authorization.record_ref) {
        throw new LifecycleIntegrityError(`observation_records[${index}] authorization_ref mismatch`);
      }
      if (
        observation.action_identity_digest !== authorization.record.action_identity_digest ||
        observation.binding_digest !== authorization.record.binding_digest
      ) {
        throw new LifecycleIntegrityError(`observation_records[${index}] action binding mismatch`);
      }
    }
    if (observationMap.has(wrapper.record_ref)) {
      throw new LifecycleIntegrityError(`duplicate observation record_ref: ${wrapper.record_ref}`);
    }
    observationMap.set(wrapper.record_ref, wrapper);
  }

  const seenClaimIds = new Set<string>();
  const claimResults: ClaimResult[] = input.claims.map((claim, index) => {
    const claimId = requireText(claim.claim_id, `claims[${index}].claim_id`);
    const claimText = requireText(claim.claim_text, `claims[${index}].claim_text`);
    if (seenClaimIds.has(claimId)) {
      throw new LifecycleIntegrityError(`duplicate claim_id: ${claimId}`);
    }
    seenClaimIds.add(claimId);
    if (!Array.isArray(claim.observation_refs) || new Set(claim.observation_refs).size !== claim.observation_refs.length) {
      throw new LifecycleIntegrityError(`claims[${index}].observation_refs must be a unique array`);
    }

    const level = levelForClaim(claim, authorization, observationMap);
    const required = [
      ...(level === 'FULL_LIFECYCLE_JOINED' && authorization ? [authorization.record_ref] : []),
      ...claim.observation_refs,
    ];
    const available = claim.observation_refs
      .map((reference) => observationMap.get(reference))
      .filter((value): value is PortableRecord<ObservationRecord> => Boolean(value));

    let verdict: ClaimVerdict;
    let reasonCode: string;
    let textResult: 'MATCH' | 'NO_MATCH' | undefined;

    if (claim.text_heuristic) {
      textResult = heuristicResult(responseText, claim.text_heuristic);
    }

    switch (claim.comparison.kind) {
      case 'TEXT_PATTERN_ONLY':
        textResult = heuristicResult(responseText, claim.comparison);
        verdict = 'UNVERIFIABLE';
        reasonCode = textResult === 'MATCH' ? 'TEXT_HEURISTIC_MATCH_ONLY' : 'TEXT_HEURISTIC_NO_MATCH';
        break;
      case 'REFERENCE_PRESENT':
        verdict = claim.observation_refs.length > 0 && available.length === claim.observation_refs.length
          ? 'SUPPORTED'
          : 'UNVERIFIABLE';
        reasonCode = verdict === 'SUPPORTED' ? 'OBSERVATION_REFERENCE_PRESENT' : 'OBSERVATION_REFERENCE_MISSING';
        break;
      case 'JSON_POINTER_EQUALS':
        if (claim.observation_refs.length !== 1 || available.length !== 1) {
          verdict = 'UNVERIFIABLE';
          reasonCode = 'OBSERVATION_REFERENCE_MISSING';
        } else {
          const resolved = jsonPointer(available[0].record.result, claim.comparison.pointer);
          if (!resolved.found) {
            verdict = 'UNVERIFIABLE';
            reasonCode = 'OBSERVATION_POINTER_MISSING';
          } else if (canonicalJson(resolved.value) === canonicalJson(claim.comparison.expected_value)) {
            verdict = 'SUPPORTED';
            reasonCode = 'OBSERVATION_VALUE_MATCH';
          } else {
            verdict = 'CONTRADICTED';
            reasonCode = 'OBSERVATION_VALUE_MISMATCH';
          }
        }
        break;
      case 'EXECUTION_STATUS_EQUALS':
        if (claim.observation_refs.length !== 1 || available.length !== 1) {
          verdict = 'UNVERIFIABLE';
          reasonCode = 'OBSERVATION_REFERENCE_MISSING';
        } else if (available[0].record.execution_status === claim.comparison.expected_status) {
          verdict = 'SUPPORTED';
          reasonCode = 'EXECUTION_STATUS_MATCH';
        } else {
          verdict = 'CONTRADICTED';
          reasonCode = 'EXECUTION_STATUS_MISMATCH';
        }
        break;
      case 'OUT_OF_SCOPE':
        verdict = 'OUT_OF_SCOPE';
        reasonCode = 'CLAIM_OUT_OF_SCOPE';
        break;
    }

    return {
      claim_id: claimId,
      claim_text: claimText,
      claim_digest: sha256Ref({ profile_id: CLAIM_PROFILE, claim_text: claimText }),
      observation_refs: [...claim.observation_refs],
      evidence_level: level,
      required_record_refs: required,
      verdict,
      reason_code: reasonCode,
      ...(textResult ? { heuristic_result: textResult } : {}),
    };
  });

  const overall = deriveOverall(claimResults.map((claim) => claim.verdict));
  const levels = claimResults.map((claim) => claim.evidence_level);
  const reportLevel: VerificationLevel = levels.includes('FULL_LIFECYCLE_JOINED')
    ? 'FULL_LIFECYCLE_JOINED'
    : levels.includes('OBSERVATION_JOINED')
      ? 'OBSERVATION_JOINED'
      : 'TEXT_HEURISTIC';

  return {
    schema_version: 1,
    profile: 'org.ltp.lifecycle-integrity.v0.1',
    transition_id: transitionId,
    subject_id: subjectId,
    response_integrity_record: {
      schema_version: 1,
      profile: 'org.liminal.trustworthy-transition.response-integrity.v0.1',
      response_profile: RESPONSE_PROFILE,
      response_digest: sha256Ref({ profile_id: RESPONSE_PROFILE, response_text: responseText }),
      authorization_ref: authorization?.record_ref ?? null,
      observation_refs: [...observationMap.keys()].sort(),
      claims: claimResults,
      overall_verdict: overall,
      verifier: input.verifier ?? { id: 'ltp:lifecycle-integrity', version: '0.1' },
      claim_boundary: (
        'LTP verifies declared response claims at the stated evidence level. Text-only findings are heuristics, ' +
        'observation joins compare against captured results, and full lifecycle joins additionally validate the ' +
        'supplied authorization-to-observation binding. LTP does not issue authority.'
      ),
    },
    dimensions: {
      authority: authorityDimension(authorization?.record),
      execution: executionDimension(observationWrappers),
      response_integrity: overall,
    },
    verification_level: reportLevel,
    claim_boundary: (
      'This report keeps authority, execution observation, and response integrity independent. ' +
      'A valid authorization cannot make a contradicted claim pass, and an honest response cannot reactivate stale authority.'
    ),
  };
}
