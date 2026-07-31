import { bumpKind } from "./semver";

export interface SurfaceManifest {
  version: string;
  snapshot_schema: number;
  canonical_envelope: string;
  required_capabilities: string[];
  optional_capabilities: string[];
  stable_reason_codes: string[];
}

export type SurfaceChange = "patch" | "additive" | "breaking";
export const SURFACE_POLICY = "org.ltp.release.surface.v1";

export function classifySurfaceChange(base: SurfaceManifest, next: SurfaceManifest): SurfaceChange {
  const baseRequired = new Set(base.required_capabilities);
  const baseOptional = new Set(base.optional_capabilities);
  const nextRequired = new Set(next.required_capabilities);
  const nextOptional = new Set(next.optional_capabilities);
  const removed = [...baseRequired, ...baseOptional].some((value) =>
    !nextRequired.has(value) && !nextOptional.has(value)
  );
  const promoted = [...nextRequired].some((value) => !baseRequired.has(value));
  const reasonRemoved = base.stable_reason_codes.some((value) =>
    !next.stable_reason_codes.includes(value)
  );
  if (
    removed ||
    promoted ||
    reasonRemoved ||
    base.snapshot_schema !== next.snapshot_schema ||
    base.canonical_envelope !== next.canonical_envelope
  ) return "breaking";

  const optionalAdded = [...nextOptional].some((value) =>
    !baseOptional.has(value) && !baseRequired.has(value)
  );
  const reasonAdded = next.stable_reason_codes.some((value) =>
    !base.stable_reason_codes.includes(value)
  );
  return optionalAdded || reasonAdded ? "additive" : "patch";
}

export function assertDeclaredVersionBump(
  base: SurfaceManifest,
  next: SurfaceManifest,
): SurfaceChange {
  const change = classifySurfaceChange(base, next);
  const bump = bumpKind(base.version, next.version);
  if (change === "breaking" && bump !== "major") throw new Error("UNDECLARED_PROTOCOL_BREAK");
  if (change === "additive" && bump === "patch") throw new Error("UNDECLARED_ADDITIVE_CHANGE");
  return change;
}
