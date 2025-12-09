# Temporal Orientation Layer

## Purpose
The Temporal Orientation Layer links the Orientation Web (a spider-like map of attention sectors) with the Time Weave (a temporal fabric built from orientation events). It produces deterministic signals that show what is rising, what is falling, and where to shift attention next. The layer outputs a `TemporalOrientationView` (summary of trends) and a `NextSectorSuggestion` (a recommended sector change).

It helps the system see what is rising, what is falling, and where it is better to move attention next — in a deterministic, testable way.

## Core Concepts
**Orientation Web (OW)**  
A graph of sectors (directions of attention or context) that the system tracks.

**Time Weave (TW)**  
Temporal structure that stores anchored events and lets us derive trends over time for each sector or branch.

**TemporalOrientationView (TOV)**  
A top-level view that summarizes per-sector trends (rising / falling / plateau), the global trend, and lists of rising / falling / plateau sectors.

**NextSectorSuggestion (NSS)**  
Small struct returned by `pickNextSector` containing:

- `fromSectorId`
- `suggestedSectorId?`
- `reason` (human-readable explanation)

```
OrientationEvent[] ──► TimeAnchors ──► TimeWeave
        │                               │
        ▼                               ▼
   OrientationWeb ──► TemporalOrientationView ──► NextSectorSuggestion
```

## Public API (SDK)
### buildViewFromWebAndAnchors
```ts
function buildViewFromWebAndAnchors(
  web: OrientationWeb,
  events: OrientationEvent[],
  weave: TimeWeave,
  ctx?: Omit<TimeAnchorContext, 'weave'>,
): TemporalOrientationBuildResult
```
Stitches an `OrientationWeb` and a batch of `OrientationEvent` entries into the `TimeWeave`, then builds a `TemporalOrientationView` from the updated weave. Returns `{ view, weave }` so callers can keep the latest weave instance. Use when you need to ingest new events and immediately refresh the temporal view.

### buildTemporalOrientationView
```ts
function buildTemporalOrientationView(
  web: OrientationWeb,
  weave: TimeWeave,
): TemporalOrientationView
```
Creates a `TemporalOrientationView` from an `OrientationWeb` and a `TimeWeave` without anchoring new events. Use when your weave is already up to date and you just need a fresh summary of temporal trends.

### pickNextSector
```ts
function pickNextSector(
  view: TemporalOrientationView,
  currentSectorId: string,
): NextSectorSuggestion
```
Returns a deterministic `NextSectorSuggestion` based on temporal trends. If the current sector is falling and there is at least one rising sector, it suggests moving to a rising sector. If the current sector is plateau and a rising sector exists, it may suggest the rising sector. If there is no better temporal signal, it recommends staying in place (no suggestion).

### Relevant Types
- `TemporalOrientationView` — top-level view of per-sector snapshots and summary.
- `TemporalTrend` — `'rising' | 'falling' | 'plateau' | 'mixed'`.
- `TemporalOrientationBuildResult` — `{ view: TemporalOrientationView; weave: TimeWeave; }`.
- `NextSectorSuggestion` — `{ fromSectorId: string; suggestedSectorId?: string; reason: string; }`.

## Usage Examples
Minimal example showing how to build a weave, anchor events, derive a view, and pick the next sector:

```ts
import {
  buildViewFromWebAndAnchors,
  pickNextSector,
} from './temporalOrientationEngine';
import { createEmptyWeave } from '../time/timeWeave';
import type { OrientationWeb } from '../orientation/orientationWeb.types';
import type { OrientationEvent } from '../timeAnchors/timeAnchorTypes';

const web: OrientationWeb = {
  activeSectorId: 'focus',
  sectors: {
    focus: { id: 'focus', tension: 0.2, pull: 0.7, resonance: 0.6, phase: 'rising' },
    social: { id: 'social', tension: 0.1, pull: 0.3, resonance: 0.4, phase: 'stable' },
  },
};

let weave = createEmptyWeave();

const events: OrientationEvent[] = [
  { sectorId: 'focus', activationLevel: 0.7, phaseHint: 'emerging' },
  { sectorId: 'social', activationLevel: 0.2, phaseHint: 'fading' },
];

const { view, weave: updatedWeave } = buildViewFromWebAndAnchors(web, events, weave);

const suggestion = pickNextSector(view, 'social');
console.log(suggestion);
// { fromSectorId: 'social', suggestedSectorId: 'focus', reason: 'Current sector is falling; shift attention toward a rising sector.' }

// keep updated weave for the next cycle
weave = updatedWeave;
```

## Design Notes
- Purely deterministic: logic is handcrafted and avoids randomness.
- Predictable and testable: intended to be safe and stable for protocol-level decisions.
- Integrates Orientation Web + Time Weave: serves as a building block for Liminal Time Weave and enables reasoning about temporal trends, not just raw events.
