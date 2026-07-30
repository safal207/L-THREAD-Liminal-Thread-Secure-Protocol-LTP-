# Claude security review without an API token

The LTP dual-review contract does not require an Anthropic API key.
The repository workflow is optional and manual-only.

## Option A — Claude Pro or Max subscription

Claude Code can authenticate with a Claude.ai Pro or Max account instead of an
Anthropic Console API key.

1. Install Claude Code using the current official instructions.
2. From the repository root, start `claude`.
3. Choose Claude App / Pro or Max authentication when prompted.
4. Run the built-in `/security-review` command first.
5. Start a fresh independent context and run `/ltp-cyber-review`.
6. Export both reports without showing one report to the other reviewer.
7. Reconcile findings using `security/review-lenses.yaml`.

Do not switch to API-credit billing when usage limits are reached. Wait for the
subscription allowance to reset.

## Option B — Claude chat without repository automation

Use the prompt in `.claude/commands/ltp-cyber-review.md` and provide only the
files needed for each bounded review slice.

Recommended slices:

1. `sdk/js/src/client.ts` + `sdk/js/src/crypto.ts`
2. `sdk/python/ltp_client/client.py` + `sdk/python/ltp_client/crypto.py`
3. `sdk/rust/ltp-client/src/client.rs` + `sdk/rust/ltp-client/src/crypto.rs`
4. `sdk/elixir/lib/ltp/connection.ex` + `sdk/elixir/lib/ltp/crypto.ex`
5. cross-SDK golden vectors and security documentation

Keep each pass independent. Do not include findings from another model until
Claude finishes its own discovery pass.

## Option C — No Claude access

The review system still works with:

- Codex/manual GitHub inspection;
- deterministic cross-SDK tests;
- CodeQL, Semgrep, dependency and secret scanning;
- the shared transition and evidence contract in `security/review-lenses.yaml`;
- human reconciliation and regression tests.

Claude is an additional search lens, not a release gate and not an authority.
A finding is accepted only when code-path evidence and a safe regression oracle
support it.

## Required output

Every report must separate:

- `CONFIRMED`: reachable and reproduced or bounded by a proof argument;
- `STRONGLY_SUPPORTED`: code evidence exists but execution is not yet reproduced;
- `HYPOTHESIS`: a path worth testing, not a vulnerability claim;
- `REJECTED`: disproved or unreachable;
- `DUPLICATE`: same root cause as an existing finding.

Each accepted finding must identify the violated invariant, preconditions,
attacker control, state transition, impact, evidence, and regression-test oracle.
