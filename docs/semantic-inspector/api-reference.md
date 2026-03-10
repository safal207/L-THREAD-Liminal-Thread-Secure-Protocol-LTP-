# Two-Phase Semantic Inspector API Reference

This reference documents the public semantic inspection surface under `tools/ltp-inspect/semantic/` and the semantic CLI mode in `ltp inspect trace`.

## Types

### `InspectionMode`

```ts
type InspectionMode = 'audit_only' | 'post' | 'pre' | 'two_phase';
```

Execution mode for semantic inspection.

- `pre`: Phase 1 only.
- `post`: Phase 2 only.
- `two_phase`: Phase 1 then Phase 2.
- `audit_only`: run available phases and report, never enforce reject/block.

### `Anchor`

```ts
interface Anchor {
  claim: string;
  transition_id: string;
  chunk_id?: string;
  hash_snippet?: string;
}
```

A declared provenance mapping for an expected factual claim.

- `claim`: natural-language claim text.
- `transition_id`: trace transition identifier where the claim is grounded.
- `chunk_id` (optional): narrows anchor to a specific chunk.
- `hash_snippet` (optional): expected leading hash characters for strict validation.

### `AnchorError`

```ts
interface AnchorError {
  claim: string;
  transition_id?: string;
  reason:
    | 'NOT_FOUND'
    | 'HASH_MISMATCH'
    | 'IN_REJECTED_BRANCH'
    | 'INADMISSIBLE'
    | 'NO_ANCHORS_DECLARED';
}
```

Anchor validation failure.

Reason codes:
- `NOT_FOUND`: transition does not exist in trace (or provided `chunk_id` does not exist on that transition).
- `HASH_MISMATCH`: `hash_snippet` does not match transition hash in strict mode.
- `IN_REJECTED_BRANCH`: transition status indicates `rejected`.
- `INADMISSIBLE`: transition status indicates drift (`drift`/`drifted`).
- `NO_ANCHORS_DECLARED`: empty anchors while explicit provenance is required.

### `AnchorWarning`

```ts
interface AnchorWarning {
  claim: string;
  transition_id: string;
  reason: 'MISSING_HASH_SNIPPET';
}
```

Non-fatal notice from Phase 1. Currently emitted when strict validation is disabled and an anchor omits `hash_snippet`.

### `AnchorValidationResult`

```ts
interface AnchorValidationResult {
  valid: boolean;
  errors: AnchorError[];
  warnings: AnchorWarning[];
}
```

Phase 1 output.

### `SemanticViolation`

```ts
interface SemanticViolation {
  claim: string;
  reason: 'UNANCHORED_FACT' | 'DRIFT_DETECTED';
  anchor_transition_id?: string;
}
```

Phase 2 violation record.

- `UNANCHORED_FACT`: extracted factual claim has no anchor match (when enabled).
- `DRIFT_DETECTED`: anchor maps to missing or inadmissible transition state.

### `SemanticCoherenceResult`

```ts
interface SemanticCoherenceResult {
  coherent: boolean;
  drift_detected: boolean;
  violations: SemanticViolation[];
  unanchored_claims: string[];
}
```

Phase 2 output.

### `TwoPhaseResult`

```ts
interface TwoPhaseResult {
  phase1: AnchorValidationResult | null;
  phase2: SemanticCoherenceResult | null;
  decision: 'PROCEED' | 'REJECT' | 'BLOCK' | 'AUDIT';
  reason?: string;
}
```

Composite result from orchestration.

- `REJECT`: pre-generation provenance failure.
- `BLOCK`: post-generation semantic coherence failure.
- `AUDIT`: violations logged, no enforcement.

### `LTPProvenanceConfig`

```ts
interface LTPProvenanceConfig {
  provenance_enforcement: {
    mode: InspectionMode;
    require_explicit_provenance: boolean;
    block_on_missing: 'pre' | 'post' | 'audit_only';
    strict_anchor_validation: boolean;
  };
  semantic_admissibility: {
    enabled: boolean;
    check_novel_facts: boolean;
  };
}
```

Top-level semantic inspector configuration.

## Functions

### `validateAnchors(anchors, traceFile, config)`

```ts
function validateAnchors(
  anchors: Anchor[],
  traceFile: string,
  config: { require_explicit_provenance: boolean; strict_anchor_validation: boolean }
): AnchorValidationResult
```

Phase 1 pre-generation validator.

Behavior:
1. Loads trace transitions from `traceFile`.
2. Optionally enforces non-empty anchors.
3. For each anchor:
   - validates transition existence,
   - validates `chunk_id` when provided,
   - validates `hash_snippet` prefix when strict mode and hash exist,
   - rejects rejected/drifted transitions.
4. Returns `valid = errors.length === 0` plus warnings.

### `checkSemanticCoherence(output, declaredAnchors, traceFile, config)`

```ts
function checkSemanticCoherence(
  output: string,
  declaredAnchors: Anchor[],
  traceFile: string,
  config: { enabled: boolean; check_novel_facts: boolean }
): SemanticCoherenceResult
```

Phase 2 post-generation semantic checker.

Behavior:
1. Extracts likely factual claims from `output` using sentence heuristics.
2. Attempts claim-to-anchor matching by inclusion/token overlap.
3. If `check_novel_facts` is enabled, marks unmatched factual claims as `UNANCHORED_FACT`.
4. For matched anchors, verifies transition exists and is not drifted/rejected.
5. Returns coherence state plus violation details.

### `runTwoPhaseInspection(anchors, output, traceFile, config)`

```ts
function runTwoPhaseInspection(
  anchors: Anchor[],
  output: string | null,
  traceFile: string,
  config: LTPProvenanceConfig
): TwoPhaseResult
```

Orchestrates mode-aware inspection and decisioning.

Behavior by mode:
- `audit_only`: run available checks, always `AUDIT`.
- `pre`: run Phase 1 only. Invalid anchors => `REJECT`.
- `post`: run Phase 2 only. Incoherent output => `BLOCK`.
- `two_phase`: run Phase 1 then Phase 2. Phase 1 failure => `REJECT`; Phase 2 failure => `BLOCK`; else `PROCEED`.

## Decision Matrix

| Mode | Phase 1 result | Phase 2 result | Decision |
|------|----------------|----------------|----------|
| `audit_only` | valid/invalid/NA | coherent/incoherent/NA | `AUDIT` |
| `pre` | valid | NA | `PROCEED` |
| `pre` | invalid | NA | `REJECT` |
| `post` | NA | coherent | `PROCEED` |
| `post` | NA | incoherent | `BLOCK` |
| `two_phase` | invalid | NA (short-circuit) | `REJECT` |
| `two_phase` | valid | coherent | `PROCEED` |
| `two_phase` | valid | incoherent | `BLOCK` |

## CLI Flags (`ltp inspect trace` semantic mode)

Semantic mode is enabled by passing `--phase`.

```bash
ltp inspect trace --phase <pre|post|two_phase|audit_only> --trace <trace.jsonl> \
  [--anchors-file <anchors.json>] \
  [--output-file <response.md>] \
  [--config <config.json>]
```

Flags:
- `--phase`: semantic inspection mode.
- `--anchors-file`: JSON file containing `{ "anchors": Anchor[] }`.
- `--output-file`: generated text file for Phase 2.
- `--trace`: JSONL trace file to inspect (required in semantic mode).
- `--config`: provenance/admissibility config JSON.

Exit codes (semantic mode):
- `0`: `PROCEED` or `AUDIT`.
- `1`: invalid CLI input (for example, missing required semantic input such as `--trace`).
- `2`: `REJECT` or `BLOCK` (or semantic runtime/policy failure).

## Anchor JSON Format

Anchor declarations should conform to `tools/ltp-inspect/semantic/anchors.schema.json`.

Example `anchors.json`:

```json
{
  "anchors": [
    {
      "claim": "Paris is the capital of France in 2024",
      "transition_id": "t1",
      "chunk_id": "c1",
      "hash_snippet": "12345678"
    }
  ]
}
```

Notes:
- Required per anchor: `claim`, `transition_id`.
- Optional: `chunk_id`, `hash_snippet`.
- `hash_snippet` schema pattern is 8 hex chars.
