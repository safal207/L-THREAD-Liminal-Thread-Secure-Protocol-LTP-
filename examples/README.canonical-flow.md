# Canonical LTP Flow (CLI/REST-ready)

This example stitches the existing orientation, time weave, and temporal orientation layers into a single deterministic flow. It treats LTP as an orientation protocol (not an agent) and produces both a human-readable report and a structured JSON payload.

## Run

From the repository root:

```bash
npm install
npm run demo:canonical
```

`demo:canonical` invokes `examples/canonical-flow.ts`, which executes the flow with a seeded canonical input and prints:

- a short header and temporal summary
- the top threads with their energy/resonance values
- three future weave options with costs/gains
- the final JSON payload (also logged separately)

## What it shows

1. **Temporal orientation view** built from the current orientation web and a deterministic time weave.
2. **Orientation web threads** derived from the provided hints.
3. **Future weave options** (`deepening`, `pause`, `switch-context`) with costs, gains, and explanations.
4. **Final output object** including `temporalOrientation`, `threads`, `options`, `message`, `note`, and `suggestion`.

The note deliberately states that no optimal path exists; the suggestion biases toward rising threads when available.
