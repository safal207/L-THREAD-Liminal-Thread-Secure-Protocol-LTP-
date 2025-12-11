import { describe, expect, it } from "vitest";
import {
  BASELINE_HUD_STATE,
  applySnapshotUpdate,
  type LtpHudState,
  withStatus,
} from "./hud";

describe("HUD baseline and resilience", () => {
  it("initialises from the baseline state", () => {
    expect(BASELINE_HUD_STATE.status).toBe("connecting");
    expect(BASELINE_HUD_STATE.focusMomentum).toBe(0);
    expect(BASELINE_HUD_STATE.snapshot).toBeUndefined();
  });

  it("ignores empty or missing updates", () => {
    const liveState: LtpHudState = {
      status: "live",
      lastUpdatedAt: 123,
      focusMomentum: 0.6,
      snapshot: {
        mainTimeDirection: "future",
        mainSocialAxis: "world",
        focusMomentumScore: 0.6,
        timeWeaveDepthScore: 0.8,
      },
    };

    expect(applySnapshotUpdate(liveState, undefined)).toBe(liveState);
    expect(applySnapshotUpdate(liveState, [])).toBe(liveState);
  });

  it("keeps the last snapshot when status changes", () => {
    const liveState: LtpHudState = {
      status: "live",
      lastUpdatedAt: 456,
      focusMomentum: 0.5,
      snapshot: {
        mainTimeDirection: "now",
        mainSocialAxis: "family",
        focusMomentumScore: 0.5,
        timeWeaveDepthScore: 0.4,
      },
    };

    const disconnected = withStatus(liveState, "disconnected");
    expect(disconnected.status).toBe("disconnected");
    expect(disconnected.snapshot).toEqual(liveState.snapshot);
    expect(disconnected).not.toBe(liveState);

    const errored = withStatus(disconnected, "error");
    expect(errored.status).toBe("error");
    expect(errored.snapshot).toEqual(liveState.snapshot);
  });
});
