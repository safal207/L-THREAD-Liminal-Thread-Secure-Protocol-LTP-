import { describe, expect, it } from "vitest";
import { deriveModeHint, focusMomentumToBand, timeWeaveDepthToBand, type TurtleSnapshotLike } from "./hud";

describe("HUD mapping helpers", () => {
  it("maps focus momentum bands", () => {
    expect(focusMomentumToBand(0.1)).toBe("low");
    expect(focusMomentumToBand(0.35)).toBe("medium");
    expect(focusMomentumToBand(0.72)).toBe("high");
  });

  it("maps time weave depth bands", () => {
    expect(timeWeaveDepthToBand(0.1)).toBe("shallow");
    expect(timeWeaveDepthToBand(0.5)).toBe("layered");
    expect(timeWeaveDepthToBand(0.9)).toBe("deep");
  });

  it("derives mode hints from snapshot", () => {
    const base: TurtleSnapshotLike = {
      mainTimeDirection: "now",
      mainSocialAxis: "self",
      focusMomentumScore: 0.5,
      timeWeaveDepthScore: 0.5,
    };

    expect(deriveModeHint(base)).toBe("stabilize");
    expect(deriveModeHint({ ...base, mainTimeDirection: "future", focusMomentumScore: 0.85 })).toBe("commit");
    expect(deriveModeHint({ ...base, mainSocialAxis: "family", timeWeaveDepthScore: 0.85 })).toBe("explore");
  });
});
