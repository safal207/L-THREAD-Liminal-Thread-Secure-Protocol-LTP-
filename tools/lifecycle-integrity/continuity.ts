export const REQUEST_ENVELOPE_PROFILE = 'org.ltp.request-envelope.v0.1' as const;
export const OUTCOME_ENVELOPE_PROFILE = 'org.ltp.outcome-envelope.v0.1' as const;
export const CONTINUITY_REPORT_PROFILE =
  'org.ltp.request-outcome-continuity-report.v0.1' as const;

export type RequestState = 'CREATED' | 'ACCEPTED' | 'PENDING' | 'DEFERRED';
export type TerminalStatus =
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'TIMED_OUT';
export type ContinuityStatus = 'CONTINUOUS' | 'PENDING' | 'DEFERRED' | 'BROKEN';
export type ContinuityFindingCode =
  | 'BROKEN_ORPHAN_RESPONSE'
  | 'BROKEN_MISSING_OUTCOME'
  | 'BROKEN_CONFLICTING_OUTCOMES'
  | 'BROKEN_TIME_REVERSAL'
  | 'BROKEN_PARENT_GAP'
  | 'BROKEN_RETRY_GAP'
  | 'BROKEN_ATTEMPT_GAP'
  | 'BROKEN_TRACE_MISMATCH'
  | 'BROKEN_REPLAY_GAP'
  | 'REPLAY_DETECTED';

export type RequestEnvelope = {
  schema_version: 1;
  profile: typeof REQUEST_ENVELOPE_PROFILE;
  record_type: 'REQUEST';
  request_id: string;
  trace_id: string;
  attempt_id: string;
  occurred_at: string;
  state: RequestState;
  deadline_at?: string | null;
  parent_request_id?: string | null;
  retry_of_attempt_id?: string | null;
  continuation_id?: string | null;
  payload_digest?: string | null;
  metadata?: Record<string, unknown>;
};

export type OutcomeEnvelope = {
  schema_version: 1;
  profile: typeof OUTCOME_ENVELOPE_PROFILE;
  record_type: 'OUTCOME';
  outcome_id: string;
  request_id: string;
  trace_id: string;
  attempt_id: string;
  occurred_at: string;
  terminal_status: TerminalStatus;
  result_digest?: string | null;
  replay_of_outcome_id?: string | null;
  metadata?: Record<string, unknown>;
};

export type ContinuityVerificationInput = {
  as_of: string;
  requests: RequestEnvelope[];
  outcomes: OutcomeEnvelope[];
  verifier?: { id: string; version: string };
};

export type ContinuityFinding = {
  code: ContinuityFindingCode;
  request_id: string | null;
  record_ids: string[];
  detail: string;
};

export type RequestContinuityResult = {
  request_id: string;
  trace_id: string | null;
  status: ContinuityStatus;
  attempt_ids: string[];
  effective_deadline_at: string | null;
  canonical_outcome_id: string | null;
  terminal_status: TerminalStatus | null;
  replay_outcome_ids: string[];
  findings: ContinuityFinding[];
};

export type ContinuityReport = {
  schema_version: 1;
  profile: typeof CONTINUITY_REPORT_PROFILE;
  as_of: string;
  overall_status: ContinuityStatus;
  requests: RequestContinuityResult[];
  orphan_outcome_ids: string[];
  findings: ContinuityFinding[];
  verifier: { id: string; version: string };
  claim_boundary: string;
};

export class ContinuityEnvelopeError extends Error {}

const REQUEST_STATES = new Set<RequestState>([
  'CREATED',
  'ACCEPTED',
  'PENDING',
  'DEFERRED',
]);
const TERMINAL_STATUSES = new Set<TerminalStatus>([
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'CANCELLED',
  'TIMED_OUT',
]);
const CLAIM_BOUNDARY =
  'This report evaluates continuity only across the supplied request and outcome envelopes as of the declared time. It does not prove authorization, response truth, external side effects, complete pre-observation history, or universal exactly-once execution.';

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ContinuityEnvelopeError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function identifier(value: unknown, label: string): string {
  const normalized = text(value, label);
  if (normalized !== value) {
    throw new ContinuityEnvelopeError(
      `${label} must not contain leading or trailing whitespace`,
    );
  }
  return normalized;
}

function optionalIdentifier(value: unknown, label: string): string | null {
  return value === undefined || value === null ? null : identifier(value, label);
}

const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function timestamp(value: unknown, label: string): number {
  const raw = text(value, label);
  if (raw !== value || !ISO_INSTANT.test(raw)) {
    throw new ContinuityEnvelopeError(
      `${label} must be an ISO-8601 instant with an explicit UTC offset`,
    );
  }
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    throw new ContinuityEnvelopeError(`${label} must be a valid timestamp`);
  }
  return parsed;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonical(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonical);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, item]) => [key, canonical(item)]),
  );
}

function finding(
  code: ContinuityFindingCode,
  requestId: string | null,
  recordIds: string[],
  detail: string,
): ContinuityFinding {
  return {
    code,
    request_id: requestId,
    record_ids: [...recordIds].sort(compareText),
    detail,
  };
}

function sortFindings(entries: ContinuityFinding[]): ContinuityFinding[] {
  return [...entries].sort((left, right) =>
    compareText(
      [left.code, left.request_id ?? '', left.record_ids.join('\0')].join('\0'),
      [right.code, right.request_id ?? '', right.record_ids.join('\0')].join(
        '\0',
      ),
    ),
  );
}

function isBroken(entry: ContinuityFinding): boolean {
  return entry.code.startsWith('BROKEN_');
}

function validateRequest(request: RequestEnvelope, index: number): {
  occurredAt: number;
  deadlineAt: number | null;
} {
  const label = `requests[${index}]`;
  if (!request || typeof request !== 'object') {
    throw new ContinuityEnvelopeError(`${label} must be an object`);
  }
  if (request.schema_version !== 1 || request.profile !== REQUEST_ENVELOPE_PROFILE) {
    throw new ContinuityEnvelopeError(`${label} version or profile mismatch`);
  }
  if (request.record_type !== 'REQUEST') {
    throw new ContinuityEnvelopeError(`${label}.record_type must be REQUEST`);
  }
  const requestId = identifier(request.request_id, `${label}.request_id`);
  const attemptId = identifier(request.attempt_id, `${label}.attempt_id`);
  identifier(request.trace_id, `${label}.trace_id`);
  if (!REQUEST_STATES.has(request.state)) {
    throw new ContinuityEnvelopeError(`${label}.state is not supported`);
  }
  const occurredAt = timestamp(request.occurred_at, `${label}.occurred_at`);
  const deadlineAt =
    request.deadline_at === undefined || request.deadline_at === null
      ? null
      : timestamp(request.deadline_at, `${label}.deadline_at`);
  if (deadlineAt !== null && deadlineAt < occurredAt) {
    throw new ContinuityEnvelopeError(`${label}.deadline_at cannot precede occurred_at`);
  }
  const retryOf = optionalIdentifier(
    request.retry_of_attempt_id,
    `${label}.retry_of_attempt_id`,
  );
  if (retryOf === attemptId) {
    throw new ContinuityEnvelopeError(`${label}.retry_of_attempt_id cannot reference itself`);
  }
  const parent = optionalIdentifier(
    request.parent_request_id,
    `${label}.parent_request_id`,
  );
  if (parent === requestId) {
    throw new ContinuityEnvelopeError(`${label}.parent_request_id cannot reference itself`);
  }
  const continuation = optionalIdentifier(
    request.continuation_id,
    `${label}.continuation_id`,
  );
  if (request.state === 'DEFERRED' && !continuation) {
    throw new ContinuityEnvelopeError(
      `${label}.continuation_id is required for DEFERRED state`,
    );
  }
  optionalIdentifier(request.payload_digest, `${label}.payload_digest`);
  return { occurredAt, deadlineAt };
}

function validateOutcome(outcome: OutcomeEnvelope, index: number): number {
  const label = `outcomes[${index}]`;
  if (!outcome || typeof outcome !== 'object') {
    throw new ContinuityEnvelopeError(`${label} must be an object`);
  }
  if (outcome.schema_version !== 1 || outcome.profile !== OUTCOME_ENVELOPE_PROFILE) {
    throw new ContinuityEnvelopeError(`${label} version or profile mismatch`);
  }
  if (outcome.record_type !== 'OUTCOME') {
    throw new ContinuityEnvelopeError(`${label}.record_type must be OUTCOME`);
  }
  const outcomeId = identifier(outcome.outcome_id, `${label}.outcome_id`);
  identifier(outcome.request_id, `${label}.request_id`);
  identifier(outcome.trace_id, `${label}.trace_id`);
  identifier(outcome.attempt_id, `${label}.attempt_id`);
  if (!TERMINAL_STATUSES.has(outcome.terminal_status)) {
    throw new ContinuityEnvelopeError(`${label}.terminal_status is not supported`);
  }
  const replayOf = optionalIdentifier(
    outcome.replay_of_outcome_id,
    `${label}.replay_of_outcome_id`,
  );
  if (replayOf === outcomeId) {
    throw new ContinuityEnvelopeError(
      `${label}.replay_of_outcome_id cannot reference itself`,
    );
  }
  optionalIdentifier(outcome.result_digest, `${label}.result_digest`);
  return timestamp(outcome.occurred_at, `${label}.occurred_at`);
}

function terminalSignature(outcome: OutcomeEnvelope): string {
  return JSON.stringify(
    canonical({
      request_id: outcome.request_id,
      trace_id: outcome.trace_id,
      attempt_id: outcome.attempt_id,
      terminal_status: outcome.terminal_status,
      result_digest: outcome.result_digest ?? null,
    }),
  );
}

export function verifyRequestOutcomeContinuity(
  input: ContinuityVerificationInput,
): ContinuityReport {
  if (!input || typeof input !== 'object') {
    throw new ContinuityEnvelopeError('input must be an object');
  }
  const asOf = text(input.as_of, 'as_of');
  const asOfTime = timestamp(input.as_of, 'as_of');
  if (!Array.isArray(input.requests) || !Array.isArray(input.outcomes)) {
    throw new ContinuityEnvelopeError('requests and outcomes must be arrays');
  }
  if (input.requests.length === 0 && input.outcomes.length === 0) {
    throw new ContinuityEnvelopeError('at least one envelope is required');
  }

  const requestTime = new Map<RequestEnvelope, number>();
  const requestDeadline = new Map<RequestEnvelope, number | null>();
  const attemptOwners = new Map<string, string>();
  const requestsById = new Map<string, RequestEnvelope[]>();

  input.requests.forEach((request, index) => {
    const validated = validateRequest(request, index);
    if (validated.occurredAt > asOfTime) {
      throw new ContinuityEnvelopeError(
        `requests[${index}].occurred_at cannot be after as_of`,
      );
    }
    if (attemptOwners.has(request.attempt_id)) {
      throw new ContinuityEnvelopeError(`duplicate attempt_id: ${request.attempt_id}`);
    }
    requestTime.set(request, validated.occurredAt);
    requestDeadline.set(request, validated.deadlineAt);
    attemptOwners.set(request.attempt_id, request.request_id);
    requestsById.set(request.request_id, [
      ...(requestsById.get(request.request_id) ?? []),
      request,
    ]);
  });

  const outcomeTime = new Map<OutcomeEnvelope, number>();
  const outcomeOwners = new Map<string, string>();
  const outcomesByRequest = new Map<string, OutcomeEnvelope[]>();
  input.outcomes.forEach((outcome, index) => {
    const occurredAt = validateOutcome(outcome, index);
    if (occurredAt > asOfTime) {
      throw new ContinuityEnvelopeError(
        `outcomes[${index}].occurred_at cannot be after as_of`,
      );
    }
    const existingOwner = outcomeOwners.get(outcome.outcome_id);
    if (existingOwner && existingOwner !== outcome.request_id) {
      throw new ContinuityEnvelopeError(
        `outcome_id ${outcome.outcome_id} cannot belong to multiple requests`,
      );
    }
    outcomeTime.set(outcome, occurredAt);
    outcomeOwners.set(outcome.outcome_id, outcome.request_id);
    outcomesByRequest.set(outcome.request_id, [
      ...(outcomesByRequest.get(outcome.request_id) ?? []),
      outcome,
    ]);
  });

  const requestIds = new Set(requestsById.keys());
  const findings: ContinuityFinding[] = [];
  const orphanOutcomeIds: string[] = [];
  const seenOrphanOutcomeIds = new Set<string>();
  for (const outcome of input.outcomes) {
    if (
      !requestIds.has(outcome.request_id) &&
      !seenOrphanOutcomeIds.has(outcome.outcome_id)
    ) {
      seenOrphanOutcomeIds.add(outcome.outcome_id);
      orphanOutcomeIds.push(outcome.outcome_id);
      findings.push(
        finding(
          'BROKEN_ORPHAN_RESPONSE',
          outcome.request_id,
          [outcome.outcome_id],
          `Outcome ${outcome.outcome_id} references unknown request ${outcome.request_id}.`,
        ),
      );
    }
  }

  const requestResults: RequestContinuityResult[] = [];
  for (const requestId of [...requestIds].sort(compareText)) {
    const attempts = [...(requestsById.get(requestId) ?? [])].sort(
      (left, right) =>
        (requestTime.get(left) ?? 0) - (requestTime.get(right) ?? 0) ||
        compareText(left.attempt_id, right.attempt_id),
    );
    const local: ContinuityFinding[] = [];
    const attemptById = new Map(attempts.map((item) => [item.attempt_id, item]));
    const traceIds = [...new Set(attempts.map((item) => item.trace_id))];
    if (traceIds.length !== 1) {
      local.push(
        finding(
          'BROKEN_TRACE_MISMATCH',
          requestId,
          attempts.map((item) => item.attempt_id),
          `Attempts for ${requestId} do not share one trace_id.`,
        ),
      );
    }

    attempts.forEach((attempt, index) => {
      const retryOf = attempt.retry_of_attempt_id ?? null;
      if (index === 0 && retryOf) {
        local.push(
          finding(
            'BROKEN_RETRY_GAP',
            requestId,
            [attempt.attempt_id, retryOf],
            `Initial observed attempt ${attempt.attempt_id} has an unobserved retry parent.`,
          ),
        );
      } else if (index > 0) {
        const parent = retryOf ? attemptById.get(retryOf) : undefined;
        if (
          !parent ||
          (requestTime.get(parent) ?? Infinity) >= (requestTime.get(attempt) ?? -Infinity)
        ) {
          local.push(
            finding(
              'BROKEN_RETRY_GAP',
              requestId,
              [attempt.attempt_id, ...(retryOf ? [retryOf] : [])],
              `Attempt ${attempt.attempt_id} does not reference an earlier observed attempt.`,
            ),
          );
        }
      }
    });

    const parentIds = [
      ...new Set(
        attempts
          .map((item) => item.parent_request_id ?? null)
          .filter((item): item is string => Boolean(item)),
      ),
    ];
    for (const parentId of parentIds) {
      const parentAttempts = requestsById.get(parentId);
      if (!parentAttempts) {
        local.push(
          finding(
            'BROKEN_PARENT_GAP',
            requestId,
            [parentId],
            `Request ${requestId} references unknown parent ${parentId}.`,
          ),
        );
      } else {
        const parentStartedAt = Math.min(
          ...parentAttempts.map((item) => requestTime.get(item) ?? Infinity),
        );
        const childStartedAt = requestTime.get(attempts[0]) ?? -Infinity;
        if (parentStartedAt > childStartedAt) {
          local.push(
            finding(
              'BROKEN_TIME_REVERSAL',
              requestId,
              [parentId, attempts[0].attempt_id],
              `Parent request ${parentId} begins after child request ${requestId}.`,
            ),
          );
        }
      }
    }
    if (parentIds.length > 1) {
      local.push(
        finding(
          'BROKEN_PARENT_GAP',
          requestId,
          parentIds,
          `Attempts for ${requestId} disagree about the parent request.`,
        ),
      );
    }

    const byOutcomeId = new Map<string, OutcomeEnvelope[]>();
    for (const outcome of outcomesByRequest.get(requestId) ?? []) {
      byOutcomeId.set(outcome.outcome_id, [
        ...(byOutcomeId.get(outcome.outcome_id) ?? []),
        outcome,
      ]);
    }

    const uniqueOutcomes: OutcomeEnvelope[] = [];
    const replayIds = new Set<string>();
    for (const outcomeId of [...byOutcomeId.keys()].sort(compareText)) {
      const copies = byOutcomeId.get(outcomeId) ?? [];
      const first = copies[0];
      uniqueOutcomes.push(first);
      if (copies.length > 1) {
        const firstValue = JSON.stringify(canonical(first));
        const changed = copies.some(
          (copy) => JSON.stringify(canonical(copy)) !== firstValue,
        );
        local.push(
          changed
            ? finding(
                'BROKEN_CONFLICTING_OUTCOMES',
                requestId,
                [outcomeId],
                `Outcome id ${outcomeId} was reused with different content.`,
              )
            : finding(
                'REPLAY_DETECTED',
                requestId,
                [outcomeId],
                `Outcome ${outcomeId} was delivered more than once.`,
              ),
        );
        if (!changed) replayIds.add(outcomeId);
      }
    }

    const canonicalOutcomes = uniqueOutcomes
      .filter((item) => !item.replay_of_outcome_id)
      .sort((left, right) => compareText(left.outcome_id, right.outcome_id));
    const canonicalOutcome =
      canonicalOutcomes.length === 1 ? canonicalOutcomes[0] : null;
    if (uniqueOutcomes.length > 0 && canonicalOutcomes.length === 0) {
      local.push(
        finding(
          'BROKEN_REPLAY_GAP',
          requestId,
          uniqueOutcomes.map((item) => item.outcome_id),
          `All outcomes for ${requestId} claim to be replays without a canonical outcome.`,
        ),
      );
    }
    if (canonicalOutcomes.length > 1) {
      local.push(
        finding(
          'BROKEN_CONFLICTING_OUTCOMES',
          requestId,
          canonicalOutcomes.map((item) => item.outcome_id),
          `Request ${requestId} has more than one canonical terminal outcome.`,
        ),
      );
    }

    if (canonicalOutcome) {
      for (const replay of uniqueOutcomes.filter((item) => item.replay_of_outcome_id)) {
        if (replay.replay_of_outcome_id !== canonicalOutcome.outcome_id) {
          local.push(
            finding(
              'BROKEN_REPLAY_GAP',
              requestId,
              [replay.outcome_id, replay.replay_of_outcome_id ?? ''],
              `Replay ${replay.outcome_id} does not reference the canonical outcome.`,
            ),
          );
        } else if (
          (outcomeTime.get(replay) ?? -Infinity) <
          (outcomeTime.get(canonicalOutcome) ?? Infinity)
        ) {
          local.push(
            finding(
              'BROKEN_TIME_REVERSAL',
              requestId,
              [canonicalOutcome.outcome_id, replay.outcome_id],
              `Replay ${replay.outcome_id} precedes its canonical outcome.`,
            ),
          );
        } else if (terminalSignature(replay) !== terminalSignature(canonicalOutcome)) {
          local.push(
            finding(
              'BROKEN_CONFLICTING_OUTCOMES',
              requestId,
              [canonicalOutcome.outcome_id, replay.outcome_id],
              `Replay ${replay.outcome_id} changes the canonical terminal content.`,
            ),
          );
        } else {
          replayIds.add(replay.outcome_id);
          local.push(
            finding(
              'REPLAY_DETECTED',
              requestId,
              [canonicalOutcome.outcome_id, replay.outcome_id],
              `Outcome ${replay.outcome_id} replays ${canonicalOutcome.outcome_id}.`,
            ),
          );
        }
      }
    }

    for (const outcome of uniqueOutcomes) {
      const attempt = attemptById.get(outcome.attempt_id);
      if (!attempt) {
        local.push(
          finding(
            'BROKEN_ATTEMPT_GAP',
            requestId,
            [outcome.outcome_id, outcome.attempt_id],
            `Outcome ${outcome.outcome_id} references unknown attempt ${outcome.attempt_id}.`,
          ),
        );
      } else {
        if (outcome.trace_id !== attempt.trace_id) {
          local.push(
            finding(
              'BROKEN_TRACE_MISMATCH',
              requestId,
              [attempt.attempt_id, outcome.outcome_id],
              `Outcome ${outcome.outcome_id} does not share the attempt trace_id.`,
            ),
          );
        }
        if ((outcomeTime.get(outcome) ?? -Infinity) < (requestTime.get(attempt) ?? Infinity)) {
          local.push(
            finding(
              'BROKEN_TIME_REVERSAL',
              requestId,
              [attempt.attempt_id, outcome.outcome_id],
              `Outcome ${outcome.outcome_id} precedes its request attempt.`,
            ),
          );
        }
      }
    }

    const deadlines = attempts
      .map((item) => ({ text: item.deadline_at ?? null, time: requestDeadline.get(item) }))
      .filter(
        (item): item is { text: string; time: number } =>
          item.text !== null && item.time !== null && item.time !== undefined,
      );
    const deadline = deadlines.length > 0 ? deadlines[deadlines.length - 1] : null;
    const latestAttempt = attempts[attempts.length - 1];
    if (
      uniqueOutcomes.length === 0 &&
      latestAttempt.state !== 'DEFERRED' &&
      deadline &&
      asOfTime > deadline.time
    ) {
      local.push(
        finding(
          'BROKEN_MISSING_OUTCOME',
          requestId,
          attempts.map((item) => item.attempt_id),
          `Request ${requestId} has no terminal outcome after its declared deadline.`,
        ),
      );
    }

    const requestFindings = sortFindings(local);
    const status: ContinuityStatus = requestFindings.some(isBroken)
      ? 'BROKEN'
      : canonicalOutcome
        ? 'CONTINUOUS'
        : latestAttempt.state === 'DEFERRED'
          ? 'DEFERRED'
          : 'PENDING';
    requestResults.push({
      request_id: requestId,
      trace_id: traceIds.length === 1 ? traceIds[0] : null,
      status,
      attempt_ids: attempts.map((item) => item.attempt_id),
      effective_deadline_at: deadline?.text ?? null,
      canonical_outcome_id: canonicalOutcome?.outcome_id ?? null,
      terminal_status: canonicalOutcome?.terminal_status ?? null,
      replay_outcome_ids: [...replayIds].sort(compareText),
      findings: requestFindings,
    });
    findings.push(...requestFindings);
  }

  const sortedFindings = sortFindings(findings);
  const overallStatus: ContinuityStatus = sortedFindings.some(isBroken)
    ? 'BROKEN'
    : requestResults.some((item) => item.status === 'PENDING')
      ? 'PENDING'
      : requestResults.some((item) => item.status === 'DEFERRED')
        ? 'DEFERRED'
        : 'CONTINUOUS';
  const verifier = input.verifier
    ? {
        id: text(input.verifier.id, 'verifier.id'),
        version: text(input.verifier.version, 'verifier.version'),
      }
    : { id: 'ltp:request-outcome-continuity', version: '0.1' };

  return {
    schema_version: 1,
    profile: CONTINUITY_REPORT_PROFILE,
    as_of: asOf,
    overall_status: overallStatus,
    requests: requestResults,
    orphan_outcome_ids: [...orphanOutcomeIds].sort(compareText),
    findings: sortedFindings,
    verifier,
    claim_boundary: CLAIM_BOUNDARY,
  };
}
