import { NegotiationResult, ResumeDecision, SnapshotIdentity } from "./negotiation-types";
import { Registry, VersionProfile } from "./registry-types";
import { compareVersions } from "./semver";

export const RESUME_VERSIONING = "v1";

export function evaluateResume(
  registry: Registry,
  snapshot: SnapshotIdentity,
  target: VersionProfile,
  approvedMigrationId?: string,
): ResumeDecision {
  if (compareVersions(target.version, snapshot.protocol_version) < 0) {
    return { verdict: "REJECT", reason_code: "DOWNGRADE_BLOCKED" };
  }
  if (
    target.version === snapshot.protocol_version &&
    target.snapshot_schema === snapshot.snapshot_schema &&
    target.canonical_envelope === snapshot.canonical_envelope
  ) {
    return {
      verdict: "RESUME",
      reason_code: "NEGOTIATED",
      preserves_session_identity: true,
      target_snapshot_schema: target.snapshot_schema,
    };
  }
  const migration = registry.migrations.find((entry) =>
    entry.from_version === snapshot.protocol_version &&
    entry.to_version === target.version &&
    entry.from_snapshot_schema === snapshot.snapshot_schema &&
    entry.to_snapshot_schema === target.snapshot_schema
  );
  if (!migration) return { verdict: "REJECT", reason_code: "INCOMPATIBLE_STATE_VERSION" };
  if (migration.requires_explicit_approval && approvedMigrationId !== migration.id) {
    return {
      verdict: "REJECT",
      reason_code: "MIGRATION_REQUIRED",
      migration_id: migration.id,
      preserves_session_identity: migration.preserves_session_identity,
      target_snapshot_schema: migration.to_snapshot_schema,
    };
  }
  return {
    verdict: "MIGRATE",
    reason_code: "NEGOTIATED",
    migration_id: migration.id,
    preserves_session_identity: migration.preserves_session_identity,
    target_snapshot_schema: migration.to_snapshot_schema,
  };
}

export function resumeFailure(result: ResumeDecision): NegotiationResult | null {
  if (result.verdict !== "REJECT") return null;
  return {
    ok: false,
    reason_code: result.reason_code as Exclude<typeof result.reason_code, "NEGOTIATED">,
    detail: "same-session resume requires rejection or explicit migration",
    supported_versions: [],
  };
}
