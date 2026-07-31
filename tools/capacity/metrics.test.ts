import { describe, expect, it } from "vitest";
import { parseGnuTime, quantiles, renderLineSvg } from "./metrics";

describe("WP4 capacity metrics", () => {
  it("computes deterministic nearest-rank quantiles", () => {
    expect(quantiles([10, 1, 4, 2, 3, 5, 6, 7, 8, 9])).toEqual({
      count: 10,
      min: 1,
      p50: 5,
      p95: 10,
      p99: 10,
      max: 10,
      mean: 5.5,
    });
  });

  it("parses GNU time resource evidence", () => {
    expect(parseGnuTime("noise\n__WP4_TIME__:1.25:0.50:12345\n")).toEqual({
      wallMs: 0,
      userCpuSeconds: 1.25,
      systemCpuSeconds: 0.5,
      maxRssKiB: 12345,
    });
  });

  it("renders standalone reviewer-readable SVG", () => {
    const svg = renderLineSvg("RSS", [1, 2, 3], "MiB");
    expect(svg).toContain("<svg");
    expect(svg).toContain("samples=3");
    expect(svg).toContain("<polyline");
  });
});
