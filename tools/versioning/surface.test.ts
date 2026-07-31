import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertDeclaredVersionBump,
  classifySurfaceChange,
  SurfaceManifest,
} from "./surface";

function load(name: string): SurfaceManifest {
  return JSON.parse(
    readFileSync(resolve(`fixtures/versioning/${name}`), "utf8"),
  ) as SurfaceManifest;
}

const baseline = load("surface-baseline.json");

describe("WP5 release surface declaration", () => {
  it("allows additive protocol changes with a minor bump", () => {
    const next = load("surface-additive-minor.json");
    expect(classifySurfaceChange(baseline, next)).toBe("additive");
    expect(assertDeclaredVersionBump(baseline, next)).toBe("additive");
  });

  it("detects a removed security capability hidden in a patch bump", () => {
    const next = load("surface-invalid-patch.json");
    expect(classifySurfaceChange(baseline, next)).toBe("breaking");
    expect(() => assertDeclaredVersionBump(baseline, next)).toThrow("UNDECLARED_PROTOCOL_BREAK");
  });

  it("allows a declared major transition", () => {
    const next = load("surface-major.json");
    expect(classifySurfaceChange(baseline, next)).toBe("breaking");
    expect(assertDeclaredVersionBump(baseline, next)).toBe("breaking");
  });
});
