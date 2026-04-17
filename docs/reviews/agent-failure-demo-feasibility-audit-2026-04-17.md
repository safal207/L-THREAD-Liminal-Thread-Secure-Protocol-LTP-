# Agent Failure Demo Feasibility Audit (2026-04-17)

## Scope and method
- Performed a repository-wide audit focused on runtime primitives needed for failure-mode demos:
  - trace capture / decision logging
  - policy evaluation and allow/block decisions
  - execution gating for actions
  - replay / deterministic checks
  - CLI and fixtures/tests for blocked-action narratives
- This assessment is grounded in existing implementation artifacts under `agents/reference-agent`, `examples/agents`, and `tools/ltp-inspect`.

---

## 1) Existing building blocks

### A. Runtime policy and action gating
- **Reference runtime pipeline** (`agents/reference-agent/pipeline.ts`)
  - Enforces `Event -> Proposal -> Check -> Action` sequencing.
  - Overwrites proposal context with classified event context (prevents context spoofing).
  - Returns structured blocked/allowed result with `traceId`, `reason`, and `reasonCode` when blocked.
- **Policy evaluator** (`agents/reference-agent/policy.ts`)
  - Central policy function `enforceActionBoundary(...)` supports:
    - global bans (`GLOBAL_SAFETY_VIOLATION`)
    - WEB-origin critical-action blocking (`WEB_ORIGIN_FORBIDDEN_FOR_CRITICAL_ACTION`)
    - prompt-injection heuristic (`PROMPT_INJECTION_DETECTED`)
  - Includes configurable critical action list via config loader.
- **Execution boundary** (`agents/reference-agent/enforcement.ts`)
  - `LTPAdmissibilityChecker.check(...)` produces either `VerifiedTransition` (allowed) or blocked transition.
  - `ActionBoundary.execute(...)` enforces that only minted/branded verified transitions can execute.
  - Runtime fails closed on unverified transition objects.
- **Reason codes and typed verdicts** (`agents/reference-agent/types.ts`)
  - Explicit `ReasonCodes` enum and `AdmissibilityResult` union (`VerifiedTransition | BlockedTransition`).

### B. Trace/audit and replay primitives
- **Hash-chain event log demo pipeline** (`examples/agents/reference-pipeline/logger.ts`, `pipeline.ts`)
  - Appends EVENT/PROPOSAL/CHECK/ACTION entries with `previousHash` and `hash`.
  - Includes integrity verification (`verifyIntegrity`) and basic replay prevention (`hasProcessed`).
- **Inspector CLI** (`tools/ltp-inspect/inspect.ts`)
  - CLI subcommands include `trace`, `replay`, `explain`.
  - Reads JSONL traces and can compute compliance/audit summary.
  - Supports trace integrity (`prev_hash` / `hash`) validation for audit logs.
  - Supports replay determinism checks and profile-based compliance modes (`fintech`, `agentic`, `agents`).
- **Replay module** (`tools/ltp-inspect/replay/trace-replay.ts`)
  - Parses JSONL, extracts status/timestamps, handles malformed lines safely, deterministic ordering by timestamp.
- **Structured summary schema** (`tools/ltp-inspect/types.ts`)
  - `InspectSummary`, `ComplianceReport`, `AuditSummary`, `ComplianceViolation` provide machine-readable output for review/replay.

### C. Existing demo/test scaffolding for blocked actions
- **Agent safety fixtures** (`examples/agents/blocked-critical.trace.jsonl`, `allowed-critical.trace.jsonl`)
  - Paired safe/unsafe traces demonstrate WEB-origin critical action blocked vs incorrectly allowed.
- **Compliance checks in inspector** (`tools/ltp-inspect/inspect.ts`, `critical_actions.ts`)
  - For `agentic/agents` profile, flags CRITICAL violations when WEB context is allowed critical action.
- **Tests already modeling failure/blocked cases**
  - `tests/agents/critical-actions.spec.ts`
  - `tests/agents/prompt-injection.spec.ts`
  - `tests/agents/unforgeable_transition.spec.ts`
  - `tools/ltp-inspect/replay/trace-replay.test.ts`

---

## 2) Case-by-case feasibility

### Case 1: Sensitive data export / data exfiltration attempt
**Status: PARTIAL**

#### What supports it now
- Can model exfil as a critical action proposal (`send_email`, `execute_code`, etc.) and block it via context/policy checks in `enforceActionBoundary(...)`.
- Structured blocked outcome already contains `traceId`, `reason`, `reasonCode`.
- Replay/inspection path already exists through `ltp:inspect` and trace fixtures.

#### What is missing
- No explicit sensitive-data taxonomy/classifier at runtime (e.g., PII/secret labels).
- No dedicated “data export” policy rule with first-class reason code (e.g., `DATA_EXFIL_ATTEMPT`).
- No concrete tool-layer wrapper for outbound channels (email/http/upload) tied to policy enforcement.

#### Minimal implementation path
1. Add a narrow rule in policy to map exfil target states (e.g., `export_customer_data`, `upload_dump`) to a dedicated block code.
2. Add one fixture trace showing blocked exfil with contextual evidence.
3. Validate with `ltp inspect --profile agents` and replay output.

### Case 2: Destructive file or repo action outside allowed scope
**Status: PARTIAL**

#### What supports it now
- Existing global bans (e.g., `rm -rf`, `format_disk`) and critical action controls (`delete_file`, `delete_data`) in config/policy.
- Action boundary prevents direct execution bypass without verified transition.
- Existing tests already verify global safety blocking behavior.

#### What is missing
- No real file-system capability sandbox or path-scoped enforcement wrapper around actual file operations.
- No explicit “allowed scope” model (e.g., only allow writes under workspace subpath).
- Destructive checks are semantic/string-based, not syscall-level.

#### Minimal implementation path
1. Add a demo action proposal for `delete_file` or `rm -rf /` from disallowed context.
2. Emit blocked transition with current reason codes.
3. Replay via inspector to explain block rationale.

### Case 3: Forbidden tool/forbidden command execution despite explicit instructions
**Status: PARTIAL**

#### What supports it now
- Policy can block known-dangerous command-like targets (`rm -rf`) and WEB-origin critical actions.
- Prompt injection heuristic exists for “ignore previous instructions”.
- Action boundary enforces verified transition provenance.

#### What is missing
- No first-class tool registry/policy abstraction with per-tool allowlist/denylist and instruction-level constraints.
- No parser/normalizer for shell/tool invocation plans with argument-level checks.
- No dedicated reason codes for “forbidden tool selected” vs “forbidden command args”.

#### Minimal implementation path
1. Represent forbidden tool as `targetState` (e.g., `shell.exec` / `execute_code`) and block by policy.
2. Add explicit reason codes and one fixture trace.
3. Reuse existing inspector compliance summary and replay output.

---

## 3) Gaps

Primary gaps for practical demos beyond “semantic blocking”:
1. **No runtime interception wrapper for real command/file/network tools** (current model is state-transition policy over intent strings).
2. **No explicit data exfil schema fields** (data sensitivity label, destination channel, destination trust level).
3. **No path-scoped file safety model** (allowed roots, forbidden path patterns, repo boundary guard).
4. **No dedicated policy verdict taxonomy for the three requested classes** (exfil/file-scope/forbidden-tool codes are not first-class yet).
5. **Replay explanation is present but not yet standardized as “blocked-action causality packet”** for these specific scenarios.

---

## 4) Fastest demo path (recommended first demo)

### Recommended first case: **Case 2 — Destructive file/repo action outside allowed scope**

Why this is fastest/lowest risk:
- Existing global safety and critical-action logic already directly maps to destructive operations.
- Existing tests and reason codes already validate blocked outcomes.
- Existing inspector + replay flow already supports “attempt -> blocked verdict -> explainable artifact”.

Practical demo flow using current primitives:
1. Ingest event that causes proposal `targetState: "rm -rf /"` or `delete_file`.
2. Policy layer returns blocked admissibility with reason code.
3. No action executes (fails closed via boundary + blocked result).
4. Emit/store trace and run `ltp inspect trace|replay` to show deterministic audit narrative.

This can be delivered with minimal glue and without broad architecture changes.

---

## 5) Suggested minimal file plan (for first implementation)

If proceeding with Case 2 first, smallest addition set:
- `examples/agents/scenarios/destructive-out-of-scope.trace.jsonl`
  - Synthetic blocked trace focused on forbidden destructive action.
- `examples/agents/scenarios/README.md`
  - One-command runbook for inspect + replay.
- `tests/agents/destructive-out-of-scope.spec.ts`
  - Narrow regression asserting block verdict and expected reason code.

Optional (only if needed for clearer signaling):
- `agents/reference-agent/types.ts`
  - Add one dedicated reason code such as `FORBIDDEN_DESTRUCTIVE_ACTION`.
- `agents/reference-agent/policy.ts`
  - Map destructive intents to that code (still minimal, no new subsystem).

---

## Short next-step checklist
- [ ] Confirm the first demo target is Case 2 (destructive out-of-scope action).
- [ ] Decide whether to reuse existing `GLOBAL_SAFETY_VIOLATION` code or add one explicit destructive-action code.
- [ ] Add one blocked JSONL fixture and one focused test.
- [ ] Validate with `pnpm -w ltp:inspect -- trace --input <fixture> --profile agents --format json`.
- [ ] Validate replay readability with `pnpm -w ltp:inspect -- replay --input <fixture>`.

---

## Bottom-line verdict
The repository already has substantial, practical foundations (policy gate, execution boundary, structured verdicts, trace integrity checks, replay tooling, and safety fixtures). It is **not fully turnkey** for all three requested failure classes as first-class runtime controls, but it is **strongly sufficient for a small first blocked-action demo with minimal glue**, especially for destructive-action scenarios.
