# Consciousness Web & Orientation Shell (JS SDK)

This layer builds on the Thread Life Model to describe how threads relate as a web and how focus can rotate across that web. It is a lightweight semantic view for engineers integrating L-THREAD in higher-level systems.

## What is the Consciousness Web?
- A semantic graph derived from a `ThreadMap`.
- **Nodes**: `ThreadVector` instances representing threads with phases and energy/resonance levels.
- **Links**: semantic connections created from:
  - `parentThreadId` relationships (parent-child links).
  - Shared scopes (individual, family, project, system).
  - Shared tags (overlapping tags create tag links).
- **Metrics**: each node can carry degree and a centrality-like score that blends link count with energy and resonance to highlight central or dominant threads.

## What is the Orientation Shell?
- An orientation layer that groups threads into **sectors**.
- Sectors can be scope-based (individual/family/project/system) or tag-based (e.g., `liminal-os`).
- Adjusting `activeSectorIds` is like rotating a turtle shell: it shifts which sectors, and therefore which threads, are emphasized.

## Core Types
- `ConsciousnessWeb`: the built graph including threads, links, and metrics.
- `ThreadLink`: a connection between two threads (`parent-child`, `shared-scope`, or `shared-tag`) with a simple weight.
- `WebNodeMetrics`: per-thread metrics such as degree and a centrality score.
- `OrientationSector`: a sector definition with optional scope or required tags.
- `OrientationShell`: a collection of sectors plus the currently active sector IDs.

## Core Functions
- `buildConsciousnessWeb(map: ThreadMap): ConsciousnessWeb` — builds the graph from a thread map with links and metrics.
- `createDefaultOrientationShell(): OrientationShell` — provides a ready set of scope/tag sectors with all sectors active by default.
- `orientWeb(web, shell): { activeThreads, dormantThreads }` — filters threads into active vs. dormant based on the shell's active sectors.

## Example Usage
```ts
import {
  buildConsciousnessWeb,
  createDefaultOrientationShell,
  orientWeb,
} from './src';
import type { ThreadMap } from './src/threadLifeModel.types';

const map: ThreadMap = {
  ownerId: 'user-123',
  threads: [
    // ...ThreadVector entries
  ],
};

const web = buildConsciousnessWeb(map);
const shell = createDefaultOrientationShell();

// Focus only on family-oriented sectors
const familyShell = {
  ...shell,
  activeSectorIds: shell.sectors
    .filter((s) => s.scope === 'family' || s.id.includes('family'))
    .map((s) => s.id),
};

const { activeThreads, dormantThreads } = orientWeb(web, familyShell);
console.log('Active threads in family context:', activeThreads);
```

## Relation to Thread Life Model
The Consciousness Web does not replace the Thread Life Model. The life model describes how a single thread evolves (birth → active → weakening → switching → archived). The Consciousness Web shows how many threads relate as a network, and the Orientation Shell rotates perspective across that network to emphasize certain sectors.
