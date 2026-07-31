export interface Capability {
  id: string;
  classification: "required" | "optional";
  status: "stable" | "candidate" | "experimental" | "deprecated";
  owner: string;
  since: string;
  normative_v1: boolean;
  description: string;
}

export interface VersionProfile {
  version: string;
  status: "legacy" | "current" | "candidate" | "deprecated";
  wire_supported: boolean;
  snapshot_schema: number;
  canonical_envelope: string;
  required_capabilities: string[];
  optional_capabilities: string[];
}

export interface MigrationRule {
  id: string;
  from_version: string;
  to_version: string;
  from_snapshot_schema: number;
  to_snapshot_schema: number;
  classification: "compatible" | "breaking";
  requires_explicit_approval: boolean;
  preserves_session_identity: boolean;
}

export interface Registry {
  schema_version: number;
  profile: string;
  policy_version: string;
  capabilities: Capability[];
  versions: VersionProfile[];
  migrations: MigrationRule[];
}
