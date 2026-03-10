# Two-Phase Semantic Inspector Integration Guide

This guide shows practical integration patterns using the semantic inspector APIs and CLI.

## 1) Minimal integration (post mode)

Use this when you only need post-generation blocking for unanchored/drifted claims.

```ts
import { runTwoPhaseInspection } from '../../tools/ltp-inspect/semantic';
import type { Anchor, LTPProvenanceConfig } from '../../tools/ltp-inspect/semantic/types';

const traceFile = 'tools/ltp-inspect/fixtures/semantic/trace-semantic.jsonl';

const anchors: Anchor[] = [
  { claim: 'Paris is the capital of France in 2024', transition_id: 't1' },
];

const config: LTPProvenanceConfig = {
  provenance_enforcement: {
    mode: 'post',
    require_explicit_provenance: false,
    block_on_missing: 'post',
    strict_anchor_validation: false,
  },
  semantic_admissibility: {
    enabled: true,
    check_novel_facts: true,
  },
};

async function generateAndGate(generate: () => Promise<string>): Promise<string> {
  const output = await generate();
  const result = runTwoPhaseInspection(anchors, output, traceFile, config);

  if (result.decision === 'BLOCK') {
    throw new Error(`Semantic block: ${result.reason}`);
  }

  // PROCEED or AUDIT
  return output;
}
```

## 2) Full two-phase integration

Use this when you want explicit anchor declaration before generation, then semantic coherence before commit.

```ts
import { validateAnchors } from '../../tools/ltp-inspect/semantic/phase1';
import { runTwoPhaseInspection } from '../../tools/ltp-inspect/semantic';
import type { Anchor, LTPProvenanceConfig } from '../../tools/ltp-inspect/semantic/types';
import fs from 'node:fs';

const traceFile = 'tools/ltp-inspect/fixtures/semantic/trace-semantic.jsonl';

const config: LTPProvenanceConfig = {
  provenance_enforcement: {
    mode: 'two_phase',
    require_explicit_provenance: true,
    block_on_missing: 'post',
    strict_anchor_validation: true,
  },
  semantic_admissibility: {
    enabled: true,
    check_novel_facts: true,
  },
};

function requestAnchorDeclaration(): Anchor[] {
  // Usually returned by planning/tooling stage.
  return [
    {
      claim: 'Paris is the capital of France in 2024',
      transition_id: 't1',
      hash_snippet: '12345678',
    },
  ];
}

async function pipeline(generate: () => Promise<string>) {
  const anchors = requestAnchorDeclaration();

  // Phase 1 gate (pre-generation)
  const phase1 = validateAnchors(anchors, traceFile, {
    require_explicit_provenance: config.provenance_enforcement.require_explicit_provenance,
    strict_anchor_validation: config.provenance_enforcement.strict_anchor_validation,
  });

  if (!phase1.valid) {
    return { committed: false, decision: 'REJECT', phase1 };
  }

  // Generate only after admissible anchors
  const output = await generate();

  // Phase 2 gate + decision
  const inspection = runTwoPhaseInspection(anchors, output, traceFile, config);
  if (inspection.decision !== 'PROCEED') {
    return { committed: false, decision: inspection.decision, inspection };
  }

  // Commit to your trace/log only on PROCEED
  fs.appendFileSync('artifacts/semantic-commit.log', `${new Date().toISOString()}\t${inspection.decision}\n`);
  return { committed: true, decision: inspection.decision, output, inspection };
}
```

## 3) CI integration

Example GitHub Actions job that runs semantic tests and validates a golden trace with CLI semantic mode.

```yaml
name: semantic-inspector-ci

on:
  pull_request:
  push:
    branches: [main]

jobs:
  semantic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile

      - name: Run semantic unit tests
        run: pnpm vitest run tools/ltp-inspect/semantic/phase1.test.ts tools/ltp-inspect/semantic/phase2.test.ts tools/ltp-inspect/semantic/index.test.ts

      - name: Validate golden trace in two-phase mode
        run: |
          pnpm ltp:inspect trace \
            --phase two_phase \
            --anchors-file tools/ltp-inspect/fixtures/semantic/anchors-valid.json \
            --output-file tools/ltp-inspect/fixtures/semantic/output-valid.md \
            --trace tools/ltp-inspect/fixtures/semantic/trace-semantic.jsonl \
            --config tools/ltp-inspect/fixtures/semantic/config-two-phase.json
```

## 4) Configuration guide

Inspector config is passed as `LTPProvenanceConfig` JSON (for example from `.ltp/config.json`).

### Development (`audit_only`)

```json
{
  "provenance_enforcement": {
    "mode": "audit_only",
    "require_explicit_provenance": false,
    "block_on_missing": "audit_only",
    "strict_anchor_validation": false
  },
  "semantic_admissibility": {
    "enabled": true,
    "check_novel_facts": true
  }
}
```

### Production non-critical (`post`)

```json
{
  "provenance_enforcement": {
    "mode": "post",
    "require_explicit_provenance": false,
    "block_on_missing": "post",
    "strict_anchor_validation": false
  },
  "semantic_admissibility": {
    "enabled": true,
    "check_novel_facts": true
  }
}
```

### Fintech / legal / medical (`two_phase`, strict)

```json
{
  "provenance_enforcement": {
    "mode": "two_phase",
    "require_explicit_provenance": true,
    "block_on_missing": "post",
    "strict_anchor_validation": true
  },
  "semantic_admissibility": {
    "enabled": true,
    "check_novel_facts": true
  }
}
```

### Real-time latency-sensitive (`pre`)

```json
{
  "provenance_enforcement": {
    "mode": "pre",
    "require_explicit_provenance": true,
    "block_on_missing": "pre",
    "strict_anchor_validation": false
  },
  "semantic_admissibility": {
    "enabled": false,
    "check_novel_facts": false
  }
}
```

## 5) Trace format

The semantic inspector reads a JSONL trace where each line is a JSON object with a transition identity and optional provenance metadata.

Minimum practical shape per line:

```json
{"id":"t1","status":"admissible","chunk_id":"c1","payload":{"text":"Paris is the capital of France in 2024."},"hash":"12345678abcd0000"}
```

Supported transition identifier fields (any one):
- `transition_id`
- `transitionId`
- `id`
- `frame.id`

Additional parsing behavior:
- `chunk_id`/`chunkId` can be top-level or under `payload`.
- `status` may come from top-level, `payload.status`, `payload.branch_status`, or `payload.branchStatus`.
- `hash` is optional; if missing, the loader derives a deterministic SHA-256 from canonicalized record content.

Because format is JSONL, each transition must be one line; arrays must be converted before inspection.
