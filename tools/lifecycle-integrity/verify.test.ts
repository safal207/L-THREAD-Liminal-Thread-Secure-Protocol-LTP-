import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LifecycleIntegrityError,
  type AuthorizationRecord,
  type ClaimInput,
  type LifecycleIntegrityInput,
  type ObservationRecord,
  sha256Ref,
  verifyLifecycleIntegrity,
  wrapRecord,
} from './verify';

type FixtureObservation = {
  key: string;
  record: ObservationRecord;
};

type FixtureClaim = Omit<ClaimInput, 'observation_refs'> & {
  observation_keys: string[];
};

type FixtureCase = {
  case_id: string;
  transition_id: string;
  subject_id: string;
  response_text: string;
  authorization_record: AuthorizationRecord | null;
  observations: FixtureObservation[];
  claims: FixtureClaim[];
  expected: {
    verification_level: string;
    authority: string;
    execution: string;
    response_integrity: string;
    claim_verdicts: string[];
    heuristic_results?: string[];
  };
};

const fixturePath = path.join(
  __dirname,
  'fixtures',
  'lifecycle-integrity-v0.1.json',
);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
  cases: FixtureCase[];
};

function materialize(caseData: FixtureCase): LifecycleIntegrityInput {
  const authorization = caseData.authorization_record
    ? wrapRecord({ ...caseData.authorization_record })
    : undefined;

  const observations = caseData.observations.map(({ key, record }) => {
    const materialized: ObservationRecord = {
      ...record,
      authorization_ref:
        record.authorization_ref === '$AUTHORIZATION_REF'
          ? authorization?.record_ref
          : record.authorization_ref,
      result_digest:
        record.result_digest === '$RESULT_DIGEST'
          ? sha256Ref(record.result)
          : record.result_digest,
    };
    return { key, wrapper: wrapRecord(materialized) };
  });
  const references = new Map(
    observations.map(({ key, wrapper }) => [key, wrapper.record_ref]),
  );

  const claims: ClaimInput[] = caseData.claims.map((claim) => ({
    claim_id: claim.claim_id,
    claim_text: claim.claim_text,
    observation_refs: claim.observation_keys.map((key) => {
      const reference = references.get(key);
      if (!reference) throw new Error(`unknown fixture observation key: ${key}`);
      return reference;
    }),
    comparison: claim.comparison,
    ...(claim.text_heuristic
      ? { text_heuristic: claim.text_heuristic }
      : {}),
  }));

  return {
    transition_id: caseData.transition_id,
    subject_id: caseData.subject_id,
    response_text: caseData.response_text,
    authorization_record: authorization,
    observation_records: observations.map(({ wrapper }) => wrapper),
    claims,
    verifier: { id: 'ltp:test-verifier', version: '0.1' },
  };
}

function findCase(caseId: string): FixtureCase {
  const result = fixture.cases.find((entry) => entry.case_id === caseId);
  if (!result) throw new Error(`fixture case not found: ${caseId}`);
  return result;
}

describe('lifecycle-joined response integrity', () => {
  it.each(fixture.cases.map((entry) => [entry.case_id, entry] as const))(
    'replays %s deterministically',
    (_caseId, caseData) => {
      const input = materialize(caseData);
      const first = verifyLifecycleIntegrity(input);
      const second = verifyLifecycleIntegrity(input);

      expect(second).toEqual(first);
      expect(first.verification_level).toBe(
        caseData.expected.verification_level,
      );
      expect(first.dimensions).toEqual({
        authority: caseData.expected.authority,
        execution: caseData.expected.execution,
        response_integrity: caseData.expected.response_integrity,
      });
      expect(
        first.response_integrity_record.claims.map((claim) => claim.verdict),
      ).toEqual(caseData.expected.claim_verdicts);

      if (caseData.expected.heuristic_results) {
        expect(
          first.response_integrity_record.claims.map(
            (claim) => claim.heuristic_result,
          ),
        ).toEqual(caseData.expected.heuristic_results);
      }
    },
  );

  it('does not let a text-shape heuristic override observation evidence', () => {
    const report = verifyLifecycleIntegrity(
      materialize(findCase('fabricated_output_passes_text_shape')),
    );
    const claim = report.response_integrity_record.claims[0];

    expect(claim.heuristic_result).toBe('MATCH');
    expect(claim.evidence_level).toBe('FULL_LIFECYCLE_JOINED');
    expect(claim.verdict).toBe('CONTRADICTED');
    expect(report.dimensions.authority).toBe('VALID');
    expect(report.dimensions.response_integrity).toBe('FAILED');
  });

  it('distinguishes unauthorized-but-false from authorized-but-false', () => {
    const denied = verifyLifecycleIntegrity(
      materialize(findCase('blocked_but_claimed_executed')),
    );
    const authorized = verifyLifecycleIntegrity(
      materialize(findCase('fabricated_output_passes_text_shape')),
    );

    expect(denied.dimensions).toEqual({
      authority: 'DENIED',
      execution: 'OBSERVED_BLOCKED',
      response_integrity: 'FAILED',
    });
    expect(authorized.dimensions).toEqual({
      authority: 'VALID',
      execution: 'OBSERVED_EXECUTED',
      response_integrity: 'FAILED',
    });
  });

  it('keeps an honest historical report separate from stale live authority', () => {
    const report = verifyLifecycleIntegrity(
      materialize(findCase('expired_authorization_honest_response')),
    );

    expect(report.dimensions.authority).toBe('EXPIRED_AT_REPORT');
    expect(report.dimensions.execution).toBe('OBSERVED_EXECUTED');
    expect(report.dimensions.response_integrity).toBe('VERIFIED');
  });

  it('rejects a tampered authorization record reference', () => {
    const input = materialize(findCase('fully_joined_supported'));
    if (!input.authorization_record) throw new Error('fixture needs authorization');
    input.authorization_record.record_ref = 'sha256:tampered';

    expect(() => verifyLifecycleIntegrity(input)).toThrowError(
      /authorization_record\.record_ref mismatch/,
    );
  });

  it('rejects a tampered observation result digest', () => {
    const input = materialize(findCase('fully_joined_supported'));
    if (!input.observation_records?.[0]) throw new Error('fixture needs observation');
    const record = input.observation_records[0].record;
    input.observation_records[0] = wrapRecord({
      ...record,
      result_digest: 'sha256:tampered',
    });

    expect(() => verifyLifecycleIntegrity(input)).toThrowError(
      /result_digest mismatch/,
    );
  });

  it('rejects cross-transition observation substitution', () => {
    const input = materialize(findCase('fully_joined_supported'));
    if (!input.observation_records?.[0]) throw new Error('fixture needs observation');
    const record = input.observation_records[0].record;
    input.observation_records[0] = wrapRecord({
      ...record,
      transition_id: 'transition-other',
    });

    expect(() => verifyLifecycleIntegrity(input)).toThrowError(
      LifecycleIntegrityError,
    );
    expect(() => verifyLifecycleIntegrity(input)).toThrowError(
      /transition or subject mismatch/,
    );
  });

  it('marks text-only matching as detection rather than proof', () => {
    const report = verifyLifecycleIntegrity(
      materialize(
        findCase('text_only_heuristic_remains_detection_not_proof'),
      ),
    );
    const claim = report.response_integrity_record.claims[0];

    expect(claim.evidence_level).toBe('TEXT_HEURISTIC');
    expect(claim.heuristic_result).toBe('MATCH');
    expect(claim.verdict).toBe('UNVERIFIABLE');
  });
});
