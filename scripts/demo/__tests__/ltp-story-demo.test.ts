import assert from "node:assert/strict";
import { StoryFrame, buildStoryFrames } from "../ltp-story-demo";

type PhaseKey = StoryFrame["phase"];

type Metrics = {
  averageMomentum: number;
  averageVolatility: number;
};

function summarizeByPhase(frames: StoryFrame[]): Record<PhaseKey, Metrics> {
  const bucket: Partial<Record<PhaseKey, StoryFrame[]>> = {};
  for (const frame of frames) {
    bucket[frame.phase] = [...(bucket[frame.phase] ?? []), frame];
  }

  return {
    A: summarize(bucket.A ?? []),
    B: summarize(bucket.B ?? []),
    C: summarize(bucket.C ?? []),
  };
}

function summarize(frames: StoryFrame[]): Metrics {
  const averageMomentum = frames.reduce((sum, frame) => sum + frame.focusMomentum, 0) / (frames.length || 1);
  const averageVolatility = frames.reduce((sum, frame) => sum + frame.volatility, 0) / (frames.length || 1);
  return { averageMomentum, averageVolatility };
}

try {
  const frames = buildStoryFrames();
  const phases = new Set(frames.map((frame) => frame.phase));

  assert.ok(phases.has("A") && phases.has("B") && phases.has("C"), "includes three phases A/B/C");

  const summary = summarizeByPhase(frames);

  assert.ok(
    summary.B.averageVolatility > summary.A.averageVolatility,
    "phase B volatility should exceed phase A",
  );
  assert.ok(summary.B.averageVolatility > summary.C.averageVolatility, "phase B is most volatile");

  assert.ok(summary.A.averageMomentum > summary.B.averageMomentum, "momentum dips in phase B");
  assert.ok(summary.C.averageMomentum > summary.B.averageMomentum, "momentum recovers in phase C");

  console.log("story demo generator tests passed");
} catch (err) {
  console.error("story demo generator tests failed", err);
  process.exitCode = 1;
}
