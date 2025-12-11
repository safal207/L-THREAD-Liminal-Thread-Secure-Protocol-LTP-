# LTP Geometry Layer Specification v1

## Purpose
The Meaning Geometry Layer (MGL) extends the Liminal Thread Protocol (LTP) with a structured representation of intentions, temporal surfaces, and resonance-based routing. It allows agents and humans to encode, transmit, and reason over sense-rich trajectories rather than raw data alone.

## Components

### A. Thread Vector
```typescript
type ThreadVector = {
  intention: number;   // 0..1 — strength of purposeful drive
  tension: number;     // 0..1 — pressure or stress on the thread
  momentum: number;    // -1..1 — direction and magnitude of motion
  clarity: number;     // 0..1 — perceptual precision and confidence
  timeDepth: number;   // 0..1 — horizon of future awareness
};
```

### B. Meaning Node
```typescript
type MeaningNode = {
  id: string;
  vector: ThreadVector;
  resonance: number;           // 0..1 — coherence with current focus
  futureBranches: MeaningNode[]; // optional projected continuations
};
```

### C. Turtle Orientation Shell
- **rotationAngle**: angular orientation of the current choice vector.
- **horizonSpan**: how far ahead the agent can resolve viable branches.
- **stability**: resistance to distraction; higher values reduce drift.

### D. Consciousness Web
An integration surface built over Meaning Nodes. Responsibilities:
- Synchronize multiple threads into a cohesive web.
- Detect phase transitions between focus states.
- Search for resonance-rich routes through future branches.

### E. Smart Routing Algorithm
1. Aggregate all future branches from the current Meaning Node.
2. Compute resonance phase across branches using vector similarity.
3. Filter non-viable trajectories (low clarity, low resonance, unstable momentum).
4. Return the recommended path **and** an explanatory trace of the decision.

## Interfaces
- **Encode/Decode**: serialize `MeaningNode` graphs into LTP payloads.
- **Query**: `getResonantPaths(nodeId, horizonSpan)` → ordered list of branches.
- **Update**: `applyTensionDelta(nodeId, delta)` recalibrates stress factors.

## Non-Goals
- Emotional valence modeling (handled by higher affect layers).
- Long-term memory storage (delegated to Liminal Memory Service).

## Versioning
- `MGL/1.0` — initial release for experimental deployments.
- `MGL/1.1+` — reserved for expanded metrics (e.g., trust, reciprocity).
