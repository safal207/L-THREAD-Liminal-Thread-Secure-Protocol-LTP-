export type ReasonCode =
  | "NEGOTIATED"
  | "INVALID_VERSION"
  | "UNSUPPORTED_VERSION"
  | "UNKNOWN_REQUIRED_CAPABILITY"
  | "MISSING_REQUIRED_CAPABILITY"
  | "REQUIRED_CAPABILITY_UNAVAILABLE"
  | "DOWNGRADE_BLOCKED"
  | "INCOMPATIBLE_STATE_VERSION"
  | "MIGRATION_REQUIRED";

export interface SnapshotIdentity {
  protocol_version: string;
  snapshot_schema: number;
  canonical_envelope: string;
}

export interface NegotiationInput {
  client_versions: string[];
  client_capabilities: string[];
  required_capabilities?: string[];
  minimum_version?: string;
  prior_session?: SnapshotIdentity;
  approved_migration_id?: string;
}

export interface ResumeDecision {
  verdict: "RESUME" | "MIGRATE" | "REJECT";
  reason_code: ReasonCode;
  migration_id?: string;
  preserves_session_identity?: boolean;
  target_snapshot_schema?: number;
}

export type NegotiationResult =
  | {
      ok: true;
      reason_code: "NEGOTIATED";
      selected_version: string;
      selected_snapshot_schema: number;
      negotiated_capabilities: string[];
      resume?: ResumeDecision;
    }
  | {
      ok: false;
      reason_code: Exclude<ReasonCode, "NEGOTIATED">;
      detail: string;
      supported_versions: string[];
    };
