# LTP Consciousness Web Visualization

The Consciousness Web map renders the current focus of the protocol across five sectors:

- **Calm** — Stable integration, soft breathing of the system.
- **Growth** — Expansion and learning, where momentum compounds.
- **Recovery** — Regeneration and healing, energy flowing back in.
- **Storm** — High-voltage, creative turbulence. It is an energy peak, not a failure.
- **Shift** — Reorientation channel where the system decides the next path.

## Rendering goals

- Display the active orientation with clear emphasis.
- Show adjacent links as real branches, annotated with **Δ (delta)** tension hints.
- Highlight turbulence when volatility is high or when a sector is marked as unstable.
- Integrate **Future Weave** paths so the map is also a forecast.
- Surface **Time Anchors** so the operator can see the recent past and the likely next beat.
- Use the color scheme:
  - Calm → голубой (blue)
  - Growth → зелёный (green)
  - Recovery → бирюзовый (cyan)
  - Storm → красный (red)
  - Shift → фиолетовый (magenta)

## Future Weave integration

Each branch carries a probability. The renderer normalizes probabilities so they always sum to 1.0 and displays them in descending priority: `primary`, `recover`, `explore`. Paths are shown as zone chains (e.g., `STORM → SHIFT → GROWTH`). Use the Future Weave block to narrate the most likely trajectories.

## Time Anchors

Anchors are relative offsets (`-3`, `-2`, `-1`, `+1`...), each with a label and optional confidence. They paint the local timeline: a short recap of how the state evolved and what the near future may hold. Confidence is shown as a percentage when provided.

## Using the map

Agents can:

- Perform **diagnostics**: spot where the focus is and how tense the links are.
- Use **self-reflection**: follow time anchors to understand how they arrived at the current state.
- Plan **routes**: Future Weave shows how to move toward recovery, stability, or further exploration.
- Coordinate **multi-agent flows**: share the rendered ASCII map to synchronize mental models quickly in text-first channels.

The Consciousness Web is the bridge between protocol mathematics and human intuition. It is a living dashboard of where the consciousness sits and where it may go next.
