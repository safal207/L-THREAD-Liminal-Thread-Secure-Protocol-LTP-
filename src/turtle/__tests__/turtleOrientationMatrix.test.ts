import assert from "assert";
import {
  TURTLE_FRAMES,
  createDefaultTurtleMatrix,
  getFrameDescriptor,
  getTurtleOrientationView,
  rotateTurtleMatrix,
} from "../turtleOrientationMatrix";
import { type TurtleFrameId, type TurtleOrientationMatrix } from "../turtleTypes";

function anglePerFrame(): number {
  return 360 / TURTLE_FRAMES.length;
}

(function testDefaultMatrixIsBaseline() {
  const matrix = createDefaultTurtleMatrix();
  const baseline = getFrameDescriptor("baseline");

  assert.strictEqual(matrix.currentFrame, "baseline");
  assert.strictEqual(matrix.previousFrame, undefined);
  assert.strictEqual(matrix.rotationAngle, 0);
  assert.strictEqual(matrix.frameIndex, baseline.index);
})();

(function testRotationUpdatesOrientation() {
  const matrix = createDefaultTurtleMatrix();
  const targetFrame: TurtleFrameId = "inner_focus";
  const rotated = rotateTurtleMatrix(matrix, { targetFrame });

  assert.strictEqual(rotated.previousFrame, "baseline");
  assert.strictEqual(rotated.currentFrame, targetFrame);
  assert.strictEqual(rotated.frameIndex, getFrameDescriptor(targetFrame).index);
  assert.ok(Math.abs(rotated.rotationAngle - anglePerFrame()) < 1e-6);

  const view = getTurtleOrientationView(rotated);
  assert.deepStrictEqual(view, {
    currentFrame: rotated.currentFrame,
    previousFrame: rotated.previousFrame,
    rotationAngle: rotated.rotationAngle,
    frameIndex: rotated.frameIndex,
  });
})();

(function testRotationToSameFrameIsIdempotent() {
  const matrix: TurtleOrientationMatrix = {
    currentFrame: "collective_field",
    previousFrame: "family_field",
    rotationAngle: 120,
    frameIndex: getFrameDescriptor("collective_field").index,
    commitment: 0.75,
  };

  const rotated = rotateTurtleMatrix(matrix, { targetFrame: matrix.currentFrame });

  assert.strictEqual(rotated, matrix);
  assert.strictEqual(rotated.rotationAngle, matrix.rotationAngle);
  assert.strictEqual(rotated.frameIndex, matrix.frameIndex);
  assert.strictEqual(rotated.commitment, matrix.commitment);
})();

(function testCommitmentClamping() {
  const matrix = createDefaultTurtleMatrix();
  const overCommitted = rotateTurtleMatrix(matrix, { targetFrame: "meta_observer", commitment: 2 });
  const underCommitted = rotateTurtleMatrix(matrix, { targetFrame: "seed_potential", commitment: -1 });

  assert.strictEqual(overCommitted.commitment, 1);
  assert.strictEqual(underCommitted.commitment, 0);
})();

console.log("turtleOrientationMatrix tests passed");
