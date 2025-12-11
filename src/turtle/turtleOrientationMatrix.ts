import {
  type TurtleFrameDescriptor,
  type TurtleFrameId,
  type TurtleOrientationMatrix,
  type TurtleOrientationView,
  type TurtleRotationInput,
} from "./turtleTypes";

export const TURTLE_FRAMES: TurtleFrameDescriptor[] = [
  {
    id: "baseline",
    label: "Baseline",
    description: "Neutral, default orientation frame for the system.",
    index: 0,
  },
  {
    id: "inner_focus",
    label: "Inner Focus",
    description: "Attuned to inner state, emotions, and subjective experience.",
    index: 1,
  },
  {
    id: "outer_context",
    label: "Outer Context",
    description: "Sensing the environment and external world signals.",
    index: 2,
  },
  {
    id: "local_time",
    label: "Local Time",
    description: "Short-term, near-future orientation for immediate action.",
    index: 3,
  },
  {
    id: "deep_time",
    label: "Deep Time",
    description: "Long-term timelines and deep futures guidance.",
    index: 4,
  },
  {
    id: "decision_axis",
    label: "Decision Axis",
    description: "Decision-making mode that emphasizes branching paths.",
    index: 5,
  },
  {
    id: "regulation_axis",
    label: "Regulation Axis",
    description: "Self-regulation and stabilization of the system state.",
    index: 6,
  },
  {
    id: "family_field",
    label: "Family Field",
    description: "Focus on close social bonds and family-like fields.",
    index: 7,
  },
  {
    id: "collective_field",
    label: "Collective Field",
    description: "Broader collective awareness and network resonance.",
    index: 8,
  },
  {
    id: "field_resonance",
    label: "Field Resonance",
    description: "Resonance dynamics across fields and shared signals.",
    index: 9,
  },
  {
    id: "meta_observer",
    label: "Meta Observer",
    description: "Meta-level observer frame for reflective sensing.",
    index: 10,
  },
  {
    id: "seed_potential",
    label: "Seed Potential",
    description: "Origin point for emerging threads and potentials.",
    index: 11,
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(value: number): number {
  const normalized = value % 360;
  return normalized >= 0 ? normalized : normalized + 360;
}

function normalizeIndex(value: number, length: number): number {
  const normalized = ((value % length) + length) % length;
  return normalized;
}

export function getFrameDescriptor(id: TurtleFrameId): TurtleFrameDescriptor {
  const frame = TURTLE_FRAMES.find((candidate) => candidate.id === id);
  if (!frame) {
    throw new Error(`Unknown TurtleFrameId: ${id}`);
  }
  return frame;
}

/**
 * Returns all Turtle frame descriptors in their ring order.
 * Consumers should treat the returned array as read-only.
 */
export function listFrames(): TurtleFrameDescriptor[] {
  return [...TURTLE_FRAMES];
}

export function createDefaultTurtleMatrix(): TurtleOrientationMatrix {
  const baseline = getFrameDescriptor("baseline");
  return {
    currentFrame: baseline.id,
    previousFrame: undefined,
    rotationAngle: 0,
    frameIndex: baseline.index,
    commitment: 0.5,
  };
}

export function rotateTurtleMatrix(
  matrix: TurtleOrientationMatrix,
  input: TurtleRotationInput,
): TurtleOrientationMatrix {
  const { targetFrame, commitment } = input;

  if (targetFrame === matrix.currentFrame) {
    return matrix;
  }

  const currentDescriptor = getFrameDescriptor(matrix.currentFrame);
  const targetDescriptor = getFrameDescriptor(targetFrame);
  const anglePerFrame = 360 / TURTLE_FRAMES.length;
  const deltaIndex = targetDescriptor.index - currentDescriptor.index;
  const rotationAngle = normalizeAngle(matrix.rotationAngle + deltaIndex * anglePerFrame);

  return {
    currentFrame: targetDescriptor.id,
    previousFrame: matrix.currentFrame,
    rotationAngle,
    frameIndex: targetDescriptor.index,
    commitment: commitment === undefined ? matrix.commitment : clamp(commitment, 0, 1),
  };
}

/**
 * Rotate by a numeric step across the 12-frame ring.
 * Positive steps move forward, negative steps move backward.
 */
export function rotateByStep(
  matrix: TurtleOrientationMatrix,
  step: number,
  commitment?: number,
): TurtleOrientationMatrix {
  if (!Number.isFinite(step)) {
    throw new Error("Rotation step must be a finite number");
  }

  const frameCount = TURTLE_FRAMES.length;
  const nextIndex = normalizeIndex(matrix.frameIndex + step, frameCount);
  const targetFrame = TURTLE_FRAMES[nextIndex].id;

  return rotateTurtleMatrix(matrix, { targetFrame, commitment });
}

export function getTurtleOrientationView(matrix: TurtleOrientationMatrix): TurtleOrientationView {
  const { currentFrame, previousFrame, rotationAngle, frameIndex } = matrix;
  return { currentFrame, previousFrame, rotationAngle, frameIndex };
}
