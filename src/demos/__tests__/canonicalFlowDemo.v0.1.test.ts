import { describe, expect, it } from "vitest";
import { buildCanonicalFrames, renderCanonicalDemo } from "../canonicalFlowDemo.v0.1";

describe("canonical v0.1 demo", () => {
  it("builds the expected frame sequence", () => {
    const frames = buildCanonicalFrames();
    const types = frames.map((frame) => frame.type);
    expect(types).toEqual(["hello", "heartbeat", "orientation", "route_request", "route_response"]);
    const routeResponse = frames.find((frame) => frame.type === "route_response");
    expect(routeResponse?.payload).toBeDefined();
  });

  it("renders a readable transcript", () => {
    const output = renderCanonicalDemo();
    expect(output).toContain("Frame timeline");
    expect(output).toContain("Routing branches");
    expect(output).toContain("Explainability factors");
    expect(output).toContain("primary: 64.0%");
    expect(output).toContain("selection: primary");
  });
});
