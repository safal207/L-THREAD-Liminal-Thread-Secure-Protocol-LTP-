import { describe, expect, it } from "vitest";
import {
  TURTLE_FRAMES,
  createDefaultTurtleMatrix,
  getFrameDescriptor,
  getTurtleOrientationView,
  listFrames,
  rotateByStep,
  rotateTurtleMatrix,
} from "../turtleOrientationMatrix";
import { type TurtleFrameId, type TurtleOrientationMatrix } from "../turtleTypes";

function anglePerFrame(): number {
  return 360 / TURTLE_FRAMES.length;
}

describe("TurtleOrientationMatrix", () => {
  it("creates a default baseline matrix", () => {
    const matrix = createDefaultTurtleMatrix();
    const baseline = getFrameDescriptor("baseline");

    expect(matrix.currentFrame).toBe("baseline");
    expect(matrix.previousFrame).toBeUndefined();
    expect(matrix.rotationAngle).toBe(0);
    expect(matrix.frameIndex).toBe(baseline.index);
  });

  it("rotates to another frame and updates view", () => {
    const matrix = createDefaultTurtleMatrix();
    const targetFrame: TurtleFrameId = "inner_focus";
    const rotated = rotateTurtleMatrix(matrix, { targetFrame });

    expect(rotated.previousFrame).toBe("baseline");
    expect(rotated.currentFrame).toBe(targetFrame);
    expect(rotated.frameIndex).toBe(getFrameDescriptor(targetFrame).index);
    expect(rotated.rotationAngle).toBeCloseTo(anglePerFrame());

    const view = getTurtleOrientationView(rotated);
    expect(view).toEqual({
      currentFrame: rotated.currentFrame,
      previousFrame: rotated.previousFrame,
      rotationAngle: rotated.rotationAngle,
      frameIndex: rotated.frameIndex,
    });
  });

  it("does not rotate when target frame is unchanged", () => {
    const matrix: TurtleOrientationMatrix = {
      currentFrame: "collective_field",
      previousFrame: "family_field",
      rotationAngle: 120,
      frameIndex: getFrameDescriptor("collective_field").index,
      commitment: 0.75,
    };

    const rotated = rotateTurtleMatrix(matrix, { targetFrame: matrix.currentFrame });

    expect(rotated).toBe(matrix);
  });

  it("clamps commitment values", () => {
    const matrix = createDefaultTurtleMatrix();
    const overCommitted = rotateTurtleMatrix(matrix, { targetFrame: "meta_observer", commitment: 2 });
    const underCommitted = rotateTurtleMatrix(matrix, { targetFrame: "seed_potential", commitment: -1 });

    expect(overCommitted.commitment).toBe(1);
    expect(underCommitted.commitment).toBe(0);
  });

  it("lists frames in ring order", () => {
    const frames = listFrames();
    expect(frames).toHaveLength(TURTLE_FRAMES.length);
    expect(frames[0].id).toBe("baseline");
    expect(frames[frames.length - 1].id).toBe("seed_potential");
  });

  it("rotates by step distance across the ring", () => {
    const matrix = createDefaultTurtleMatrix();
    const rotatedForward = rotateByStep(matrix, 2);
    expect(rotatedForward.currentFrame).toBe("outer_context");

    const rotatedBackward = rotateByStep(rotatedForward, -1);
    expect(rotatedBackward.currentFrame).toBe("inner_focus");
  });
});
