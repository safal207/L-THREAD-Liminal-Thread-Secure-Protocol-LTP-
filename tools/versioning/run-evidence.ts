import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildMatrix, MatrixFixture } from "./matrix";
import { evaluateResume } from "./resume-contract";
import { loadRegistry, validateRegistry } from "./registry";
import {
  assertDeclaredVersionBump,
  classifySurfaceChange,
  SurfaceManifest,
} from "./surface";

export const EVIDENCE_SCHEMA = 1;

function loadSurface(name: string): SurfaceManifest {
  return JSON.parse(
    readFileSync(resolve(`fixtures/versioning/${name}`), "utf8"),
  ) as SurfaceManifest;
}

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outputPath = resolve(outIndex >= 0 ? args[outIndex + 1] : "artifacts/wp5-version-migration-evidence.json");
const registry = loadRegistry();
validateRegistry(registry);

const fixture = JSON.parse(
  readFileSync(resolve("fixtures/versioning/negotiation-cases.json"), "utf8"),
) as { cases: MatrixFixture[] };
const matrix = buildMatrix(registry, fixture.cases);
const current = registry.versions.find((entry) => entry.version === "0.6.0")!;
const candidate = registry.versions.find((entry) => entry.version === "1.0.0")!;
const snapshot = {
  protocol_version: current.version,
  snapshot_schema: current.snapshot_schema,
  canonical_envelope: current.canonical_envelope,
};
const breakingWithoutApproval = evaluateResume(registry, snapshot, candidate);
const breakingWithApproval = evaluateResume(
  registry,
  snapshot,
  candidate,
  "state-v1-to-v2-1.0",
);

const baseline = loadSurface("surface-baseline.json");
const additive = loadSurface("surface-additive-minor.json");
const invalidPatch = loadSurface("surface-invalid-patch.json");
const major = loadSurface("surface-major.json");
let undeclaredBreakDetected = false;
try {
  assertDeclaredVersionBump(baseline, invalidPatch);
} catch (error) {
  undeclaredBreakDetected = error instanceof Error && error.message === "UNDECLARED_PROTOCOL_BREAK";
}

const checks = {
  registry_valid: true,
  normative_v1_classified: registry.capabilities
    .filter((entry) => entry.normative_v1)
    .every((entry) => Boolean(entry.owner) && ["required", "optional"].includes(entry.classification)),
  matrix_all_passed: matrix.every((row) => row.verdict === "PASS"),
  unknown_required_failed_closed: matrix.some((row) => row.reason_code === "UNKNOWN_REQUIRED_CAPABILITY"),
  silent_downgrade_blocked: matrix.some((row) => row.reason_code === "DOWNGRADE_BLOCKED"),
  compatible_resume_migrated: matrix.some((row) => row.resume_verdict === "MIGRATE"),
  breaking_resume_requires_approval:
    breakingWithoutApproval.verdict === "REJECT" &&
    breakingWithoutApproval.reason_code === "MIGRATION_REQUIRED",
  approved_breaking_migration_explicit:
    breakingWithApproval.verdict === "MIGRATE" &&
    breakingWithApproval.preserves_session_identity === false,
  undeclared_break_detected: undeclaredBreakDetected,
  additive_minor_declared: classifySurfaceChange(baseline, additive) === "additive" &&
    assertDeclaredVersionBump(baseline, additive) === "additive",
  major_break_declared: classifySurfaceChange(baseline, major) === "breaking" &&
    assertDeclaredVersionBump(baseline, major) === "breaking",
};
const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
const evidence = {
  schema_version: EVIDENCE_SCHEMA,
  profile: "org.ltp.production.wp5.versioning-migration-evidence.v1",
  registry_policy_version: registry.policy_version,
  supported_wire_versions: registry.versions
    .filter((entry) => entry.wire_supported)
    .map((entry) => entry.version),
  candidate_versions: registry.versions
    .filter((entry) => !entry.wire_supported)
    .map((entry) => entry.version),
  summary: {
    checks: Object.keys(checks).length,
    passed: Object.keys(checks).length - failed.length,
    failed: failed.length,
    failed_checks: failed,
  },
  checks,
  breaking_transition: {
    without_approval: breakingWithoutApproval,
    with_approval: breakingWithApproval,
  },
  matrix,
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
if (failed.length) process.exitCode = 1;
