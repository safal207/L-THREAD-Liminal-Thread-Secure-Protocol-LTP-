import { NegotiationInput, NegotiationResult, ReasonCode } from "./negotiation-types";
import { Registry } from "./registry-types";
import { evaluateResume } from "./resume-contract";
import { compareVersions, parseVersion } from "./semver";
import { supportedVersions, validateRegistry } from "./registry";

export const NEGOTIATION_PROFILE = "org.ltp.protocol.negotiation.v1";

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function fail(
  registry: Registry,
  reason: Exclude<ReasonCode, "NEGOTIATED">,
  detail: string,
): NegotiationResult {
  return { ok: false, reason_code: reason, detail, supported_versions: supportedVersions(registry) };
}

export function negotiate(registry: Registry, input: NegotiationInput): NegotiationResult {
  validateRegistry(registry);
  const known = new Set(registry.capabilities.map((entry) => entry.id));
  const offered = new Set(input.client_capabilities);
  const requiredByClient = unique(input.required_capabilities ?? []);

  for (const capability of requiredByClient) {
    if (!known.has(capability)) {
      return fail(registry, "UNKNOWN_REQUIRED_CAPABILITY", `unknown required capability ${capability}`);
    }
  }

  try {
    input.client_versions.forEach(parseVersion);
    if (input.minimum_version) parseVersion(input.minimum_version);
  } catch {
    return fail(registry, "INVALID_VERSION", "protocol versions must use numeric major.minor.patch");
  }

  const common = registry.versions
    .filter((profile) => profile.wire_supported && input.client_versions.includes(profile.version))
    .sort((left, right) => compareVersions(right.version, left.version));
  if (!common.length) {
    return fail(registry, "UNSUPPORTED_VERSION", "no wire-supported version is shared");
  }

  const floor = input.minimum_version ?? input.prior_session?.protocol_version;
  const eligible = floor
    ? common.filter((profile) => compareVersions(profile.version, floor) >= 0)
    : common;
  if (!eligible.length) {
    return fail(registry, "DOWNGRADE_BLOCKED", `all common versions are below ${floor}`);
  }

  const selected = eligible[0];
  const allowed = new Set([...selected.required_capabilities, ...selected.optional_capabilities]);
  for (const capability of selected.required_capabilities) {
    if (!offered.has(capability)) {
      return fail(
        registry,
        "MISSING_REQUIRED_CAPABILITY",
        `client did not offer ${capability} for ${selected.version}`,
      );
    }
  }
  for (const capability of requiredByClient) {
    if (!allowed.has(capability)) {
      return fail(
        registry,
        "REQUIRED_CAPABILITY_UNAVAILABLE",
        `${selected.version} cannot provide ${capability}`,
      );
    }
  }

  let resume;
  if (input.prior_session) {
    resume = evaluateResume(registry, input.prior_session, selected, input.approved_migration_id);
    if (resume.verdict === "REJECT") {
      const reason = resume.reason_code === "NEGOTIATED"
        ? "INCOMPATIBLE_STATE_VERSION"
        : resume.reason_code;
      return fail(registry, reason, "same-session resume was not compatible or explicitly migrated");
    }
  }

  return {
    ok: true,
    reason_code: "NEGOTIATED",
    selected_version: selected.version,
    selected_snapshot_schema: selected.snapshot_schema,
    negotiated_capabilities: unique([...offered].filter((capability) => allowed.has(capability))),
    resume,
  };
}
