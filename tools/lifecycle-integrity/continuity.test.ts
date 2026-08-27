import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ContinuityEnvelopeError,
  type ContinuityVerificationInput,
  verifyRequestOutcomeContinuity,
} from './continuity';

type FixtureCase = {
  case_id: string;
  input: ContinuityVerificationInput;
  expected: {
    overall_status: string;
    request_statuses: string[];
    finding_codes: string[];
    orphan_outcome_ids: string[];
    canonical_outcome_ids: Array<string | null>;
    replay_outcome_ids?: string[][];
    attempt_ids?: string[][];
  };
};

const fixturePath = path.join(
  __dirname,
  'fixtures',
  'request-outcome-continuity-v0.1.json',
);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
  schema_version: number;
  profile: string;
  cases: FixtureCase[];
};

function findCase(caseId: string): FixtureCase {
  const result = fixture.cases.find((entry) => entry.case_id === caseId);
  if (!result) throw new Error(`fixture case not found: ${caseId}`);
  return result;
}

describe('request/outcome continuity', () => {
  it('uses the versioned machine-readable fixture profile', () => {
    expect(fixture.schema_version).toBe(1);
    expect(fixture.profile).toBe(
      'org.ltp.request-outcome-continuity-fixtures.v0.1',
    );
  });

  it.each(fixture.cases.map((entry) => [entry.case_id, entry] as const))(
    'replays %s deterministically',
    (_caseId, caseData) => {
      const first = verifyRequestOutcomeContinuity(caseData.input);
      const second = verifyRequestOutcomeContinuity(caseData.input);

      expect(second).toEqual(first);
      expect(first.overall_status).toBe(caseData.expected.overall_status);
      expect(first.requests.map((request) => request.status)).toEqual(
        caseData.expected.request_statuses,
      );
      expect(first.findings.map((entry) => entry.code)).toEqual(
        caseData.expected.finding_codes,
      );
      expect(first.orphan_outcome_ids).toEqual(
        caseData.expected.orphan_outcome_ids,
      );
      expect(
        first.requests.map((request) => request.canonical_outcome_id),
      ).toEqual(caseData.expected.canonical_outcome_ids);

      if (caseData.expected.replay_outcome_ids) {
        expect(
          first.requests.map((request) => request.replay_outcome_ids),
        ).toEqual(caseData.expected.replay_outcome_ids);
      }
      if (caseData.expected.attempt_ids) {
        expect(first.requests.map((request) => request.attempt_ids)).toEqual(
          caseData.expected.attempt_ids,
        );
      }
    },
  );

  it('keeps restart attempts under one logical request', () => {
    const report = verifyRequestOutcomeContinuity(
      findCase('restart_retry_preserves_logical_request_identity').input,
    );

    expect(report.requests).toHaveLength(1);
    expect(report.requests[0].request_id).toBe('req-8');
    expect(report.requests[0].attempt_ids).toEqual([
      'attempt-8a',
      'attempt-8b',
    ]);
    expect(report.requests[0].status).toBe('CONTINUOUS');
  });

  it('detects replay without creating a second canonical completion', () => {
    const report = verifyRequestOutcomeContinuity(
      findCase('explicit_replay_keeps_one_canonical_outcome').input,
    );
    const request = report.requests[0];

    expect(request.canonical_outcome_id).toBe('outcome-7a');
    expect(request.replay_outcome_ids).toEqual(['outcome-7b']);
    expect(request.terminal_status).toBe('COMPLETED');
    expect(request.status).toBe('CONTINUOUS');
    expect(report.findings.map((entry) => entry.code)).toEqual([
      'REPLAY_DETECTED',
    ]);
  });

  it('rejects a deferred envelope without a continuation reference', () => {
    const input = structuredClone(
      findCase('durable_defer_is_not_a_silent_gap').input,
    );
    delete input.requests[0].continuation_id;

    expect(() => verifyRequestOutcomeContinuity(input)).toThrowError(
      ContinuityEnvelopeError,
    );
    expect(() => verifyRequestOutcomeContinuity(input)).toThrowError(
      /continuation_id is required for DEFERRED state/,
    );
  });

  it('keeps the external-effect and exactly-once claims out of scope', () => {
    const report = verifyRequestOutcomeContinuity(
      findCase('request_with_terminal_outcome_is_continuous').input,
    );

    expect(report.claim_boundary).toContain('does not prove authorization');
    expect(report.claim_boundary).toContain('external side effects');
    expect(report.claim_boundary).toContain('exactly-once execution');
  });
});
