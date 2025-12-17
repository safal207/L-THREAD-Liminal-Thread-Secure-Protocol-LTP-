# LTP v0.1 Release Candidate (RC1)

Status: **RC1**  \
Change policy: **additive-only** (no breaking changes until v0.1 tag)

## Release Candidate Definition
LTP v0.1 RC1 freezes the protocol surface for frames, canonical flow, and conformance expectations. Implementations across SDKs should be able to: 
- exchange v0.1 frames without breaking changes;
- follow the canonical flow deterministically; and
- pass the conformance fixture suite with expected outcomes.

## What is included in v0.1
- **Frames (v0.1):** `specs/LTP-Frames-v0.1.md` (frame shapes + semantics).  
- **Canonical Flow (v0.1):** `specs/LTP-Canonical-Flow-v0.1.md` (deterministic sequence + transport notes).  
- **Conformance (v0.1):** `specs/LTP-Conformance-v0.1.md` plus fixtures under `fixtures/conformance/v0.1`.  
- **Conformance kit:** CLI at `tools/conformance-kit` with report/badge outputs.  
- **CI gate:** RC1 jobs that enforce fixture expectations and smoke the SDKs.  
- **Cross-SDK smoke:** `scripts/ci/rc1-smoke.sh` (JS/Rust/Python/Elixir/type-checks).

## Explicitly out of scope for v0.1
- ML/LLM routing or learning systems.  
- Persistence/store requirements (stateless is acceptable).  
- UI/HUD specifics beyond frame shapes.  
- Non-additive spec changes (breaking shape/ordering changes are deferred past v0.1).

## Required files and artifacts
- `specs/LTP-Frames-v0.1.md`, `specs/LTP-Canonical-Flow-v0.1.md`, `specs/LTP-Conformance-v0.1.md` (all marked RC1, additive-only).  
- `fixtures/conformance/v0.1/*.json` (fixture expectations baked into CI).  
- `tools/conformance-kit` CLI + reports (`reports/`).  
- `scripts/ci/rc1-smoke.sh` (cross-SDK smoke entrypoint).  
- `.github/workflows/test.yml` (RC1 gate wiring).

## Conformance requirements (RC1 gate)
- Run the directory sweep and respect expectations:  
  ```bash
  pnpm -w ltp:conformance verify:dir fixtures/conformance/v0.1 --out reports/rc1.json --format text
  ```
- Fixture expectations:  
  - `ok_*.json` → **must** evaluate to `OK` (no warnings).  
  - `warn_*.json` → `WARN` or `OK` are acceptable.  
  - `fail_*.json` → **must** evaluate to `FAIL`; they are **expected failures** and should not break CI.  
- CI fails only when expectations are violated (unexpected WARN/FAIL for positive cases, or unexpected OK/WARN for negative cases).

## Cross-SDK smoke (single entrypoint)
Use the smoke runner to validate that all SDKs respond to the same fixture set:
```bash
./scripts/ci/rc1-smoke.sh
```
It performs:
- JS SDK build + conformance kit sweep over `fixtures/conformance/v0.1` (shared fixtures).  
- Rust SDK tests (`sdk/rust/ltp-client`).  
- Python SDK tests (`sdk/python`).  
- Elixir SDK tests (`sdk/elixir`).  
- Cross-SDK type consistency check (`tests/cross-sdk/verify-types.js`).

## Compatibility notes
- **Module format:** JS SDK publishes CommonJS; consumers using ESM should import via `createRequire` or compatible bundler settings.  
- **Route branches shape:** routers may emit `branches` as an **array** or **object map**; consumers must tolerate both and normalize as needed.  
- **Transport flexibility:** canonical flow remains valid over WS and REST; session semantics are defined in the canonical flow spec.

## Exit criteria (ready to tag v0.1)
- Conformance fixtures pass with expected outcomes (`pnpm -w ltp:conformance verify:dir fixtures/conformance/v0.1`).  
- Cross-SDK smoke runner succeeds (`./scripts/ci/rc1-smoke.sh`).  
- No breaking changes to v0.1 frame shapes or canonical ordering; only additive changes allowed.  
- Specs are marked **Status: RC1** with the additive-only policy linked across frames, canonical flow, and conformance.  
- CI green on RC1 gate.
