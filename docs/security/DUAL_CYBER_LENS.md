# Dual Cyber Lens for L-THREAD/LTP

## Goal

Use two independent AI security reviewers plus deterministic tools without turning agreement between models into false confidence.

The review stack is:

```text
Codex Security lens
+ Claude Security lens
+ deterministic scanners and tests
+ human adjudication
= accepted security finding or accepted proof
```

This protocol does not assume that either model is authoritative. Models search; evidence decides.

## Why two lenses

Different reviewers tend to explore different paths. A useful dual review is not two copies of the same prompt. It deliberately separates perspectives:

### Codex-oriented lens

Prioritize:

- codebase-specific threat modelling;
- trust boundaries and attack paths;
- reachability through real runtime code;
- exploit validation in a controlled environment;
- minimal targeted patches;
- regression verification after the patch.

### Claude-oriented lens

Prioritize:

- subtle context-dependent defects across a large codebase;
- composition of multiple primitives into an end-to-end attack chain;
- protocol and documentation claims that are not enforced at runtime;
- containment and blast-radius analysis for agents and CI;
- long-horizon paths through reconnect, resume, concurrency, and failure recovery;
- systematic comparison of all SDK implementations.

The labels describe review emphasis only. Both reviewers must apply every mandatory lens in `security/review-lenses.yaml`.

## Independence rule

The first passes must be independent:

```text
Codex pass A ─┐
              ├─> normalized findings ─> reconciliation ─> tests/proofs
Claude pass B ─┘
```

Reviewer B must not receive reviewer A's findings before completing discovery. Otherwise, the second model becomes an agreement generator rather than an independent searcher.

## Normalized evidence graph

Every report is converted into this graph:

```text
Actor
→ Capability
→ Entry point
→ Untrusted input
→ Security transition
→ First mutated state
→ Broken invariant
→ Reachable impact
→ Evidence
→ Regression oracle
```

Two findings are duplicates when they share the same root cause, violated invariant, first security state mutated, and impact—even when the symptoms differ.

## Acceptance gates

A finding may block merge only when one of these gates is met:

### Gate A — Reproduction

A safe local reproducer demonstrates the defect on the current branch.

### Gate B — Bounded proof

A short code-path proof demonstrates that all required conditions are reachable and no guard blocks the path.

### Gate C — Differential failure

The same protocol input produces different canonical bytes, signatures, hashes, state transitions, or security decisions across SDKs.

### Gate D — Runtime claim mismatch

Security documentation or release metadata claims a property that the production runtime path demonstrably does not execute.

Model confidence alone is never an acceptance gate.

## Required workflow

### 1. Establish the review target

Record:

- repository and commit SHA;
- branch or PR;
- files changed;
- affected SDKs;
- protocol/security profiles affected;
- whether the review is whole-repository or diff-focused.

### 2. Run deterministic checks first, but hide their interpretation

Run available tests and scanners to collect raw artifacts:

- unit and integration tests;
- cross-SDK golden vectors;
- dependency and secret scanning;
- static analysis;
- fuzzing and property tests;
- concurrency and crash tests.

Do not feed another model's narrative conclusions into an independent discovery pass. Raw failing tests and tool output are allowed.

### 3. Run independent Codex and Claude reviews

Each reviewer receives:

- the same target commit;
- the same architecture and invariant files;
- raw deterministic artifacts;
- no findings from the other reviewer.

Each reviewer returns the finding contract defined in `security/review-lenses.yaml`.

### 4. Reconcile

Assign one status:

- `CONFIRMED_BY_BOTH`
- `CONFIRMED_BY_ONE`
- `DISPUTED`
- `DUPLICATE`
- `REJECTED`

Agreement increases search confidence, but a reproducible finding from one reviewer remains valid even when the other missed it.

### 5. Patch through a separate transition

Do not let the discovery agent silently patch while reporting. After findings are accepted:

1. create a dedicated fix branch;
2. add the failing regression test;
3. implement the smallest fix;
4. run all SDK and cross-SDK tests;
5. rerun both security lenses on the patch;
6. verify that no security profile silently downgraded;
7. update security-status documents only after proof.

## Claude Code usage

### Local manual review

From the repository root:

```bash
claude
```

Then run the built-in review when available:

```text
/security-review
```

Run the LTP-specific independent pass separately:

```text
/ltp-cyber-review
```

A non-interactive alternative is:

```bash
claude -p "Perform the independent LTP cyber review defined in CLAUDE.md and .claude/commands/ltp-cyber-review.md. Do not edit files." \
  --model opus \
  --permission-mode plan \
  --max-turns 12
```

Do not use `--dangerously-skip-permissions` for repository security review.

### GitHub pull-request review

The workflow `.github/workflows/claude-security-review.yml` performs a read-only review when `ANTHROPIC_API_KEY` is configured as a repository secret. Without the secret, the job exits successfully and prints setup guidance rather than breaking CI.

The workflow deliberately:

- checks out without persisted Git credentials;
- grants repository contents read-only permission;
- grants only the PR/issue write permissions required for review output;
- runs Claude in plan mode;
- forbids implementation during the discovery pass;
- treats PR text and repository content as untrusted data;
- uses an exact action commit rather than a mutable tag.

## Current LTP priority probes

The initial cross-review should revalidate these hypotheses against the current commit:

1. Cross-SDK canonicalization and signed-field mismatch.
2. Runtime security helpers implemented but not called.
3. State mutation before authentication or chain acceptance.
4. Metadata encryption/signing order mismatch.
5. Concurrent send/receive hash-chain forks.
6. Protocol-version and security-profile downgrade.
7. ECDH authentication warning-only or fail-open paths.
8. Replay after reconnect, resume, restart, or replica change.
9. Agent prompt injection and excessive CI permissions.
10. Documentation declaring security completion before runtime proof.

## Authoritative external references

- Anthropic, "Automated Security Reviews in Claude Code": https://support.anthropic.com/en/articles/11932705-automated-security-reviews-in-claude-code/
- Anthropic, "Making frontier cybersecurity capabilities available to defenders": https://www.anthropic.com/research/claude-code-security
- Anthropic, "How we contain Claude across products": https://www.anthropic.com/engineering/how-we-contain-claude
- Anthropic, "Beyond permission prompts: making Claude Code more secure and autonomous": https://www.anthropic.com/engineering/claude-code-sandboxing
- Anthropic, Claude Code GitHub Actions documentation: https://docs.anthropic.com/en/docs/claude-code/github-actions

These references describe tool capabilities and containment practices. The repository-specific guarantees are defined only by this repository's code, tests, and security invariants.
