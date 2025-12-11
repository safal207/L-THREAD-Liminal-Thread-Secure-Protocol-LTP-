// Identifiers for high-level orientation frames.
// This set should remain fixed-size and well documented.
export type TurtleFrameId =
  | "baseline"
  | "inner_focus"
  | "outer_context"
  | "local_time"
  | "deep_time"
  | "decision_axis"
  | "regulation_axis"
  | "family_field"
  | "collective_field"
  | "field_resonance"
  | "meta_observer"
  | "seed_potential";

export interface TurtleFrameDescriptor {
  id: TurtleFrameId;
  label: string;
  description: string;
  // Index position within the 12-frame ring.
  index: number;
}

export interface TurtleOrientationMatrix {
  /** Currently active frame */
  currentFrame: TurtleFrameId;
  /** Previous frame before the last rotation (if any) */
  previousFrame?: TurtleFrameId;
  /** Rotation angle in degrees, normalized to [0, 360) */
  rotationAngle: number;
  /** Index of the current frame in the global 12-frame ring */
  frameIndex: number;
  /**
   * Optional metadata to be used later by routing/time-weave:
   * reflects how strong the commitment to the current frame is.
   */
  commitment?: number; // 0..1
}

export interface TurtleOrientationView {
  currentFrame: TurtleFrameId;
  rotationAngle: number;
  frameIndex: number;
  previousFrame?: TurtleFrameId;
}

export interface TurtleRotationInput {
  targetFrame: TurtleFrameId;
  commitment?: number;
}
