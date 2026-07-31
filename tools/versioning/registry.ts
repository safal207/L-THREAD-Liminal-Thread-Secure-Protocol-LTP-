import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Registry } from "./registry-types";
import { parseVersion } from "./semver";

export const REGISTRY_SCHEMA = 1;
export const DEFAULT_REGISTRY_PATH = "config/protocol-capabilities.json";

export function loadRegistry(path = DEFAULT_REGISTRY_PATH): Registry {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as Registry;
}

export function validateRegistry(registry: Registry): void {
  if (registry.schema_version !== REGISTRY_SCHEMA) throw new Error("UNSUPPORTED_REGISTRY_SCHEMA");
  const ids = registry.capabilities.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error("DUPLICATE_CAPABILITY_ID");
  const known = new Set(ids);
  const versions = registry.versions.map((entry) => entry.version);
  if (new Set(versions).size !== versions.length) throw new Error("DUPLICATE_PROTOCOL_VERSION");

  for (const capability of registry.capabilities.filter((entry) => entry.normative_v1)) {
    if (!capability.owner) throw new Error(`CAPABILITY_WITHOUT_OWNER:${capability.id}`);
    if (!capability.classification) throw new Error(`UNCLASSIFIED_V1_CAPABILITY:${capability.id}`);
  }

  for (const version of registry.versions) {
    parseVersion(version.version);
    const required = new Set(version.required_capabilities);
    for (const capability of [...version.required_capabilities, ...version.optional_capabilities]) {
      if (!known.has(capability)) throw new Error(`UNKNOWN_CAPABILITY:${version.version}:${capability}`);
    }
    for (const capability of version.optional_capabilities) {
      if (required.has(capability)) throw new Error(`AMBIGUOUS_CAPABILITY_CLASS:${capability}`);
    }
  }
}

export function supportedVersions(registry: Registry): string[] {
  return registry.versions.filter((entry) => entry.wire_supported).map((entry) => entry.version);
}
