import { getFrameDescriptor } from "./turtleOrientationMatrix";
import { type TurtleSnapshot, type TurtleOrientationMatrix } from "./turtleTypes";

export function buildTurtleSnapshot(matrix: TurtleOrientationMatrix): TurtleSnapshot {
  const descriptor = getFrameDescriptor(matrix.currentFrame);

  return {
    currentFrameId: descriptor.id,
    currentFrameLabel: descriptor.label,
    frameIndex: matrix.frameIndex,
    rotationAngle: matrix.rotationAngle,
    commitment: matrix.commitment ?? 0,
  };
}
