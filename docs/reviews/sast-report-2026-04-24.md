# SAST Report — LTP Monorepo

**Date:** 2026-04-24 (UTC)  
**Scope:** JS/TS SDK + test/tooling, Python SDK + tests, Rust SDK  
**Method:** Best-effort static analysis using available local tooling, pattern-based code audit, and manual review of crypto-critical modules.

## 1) What was executed

```bash
node -v && npm -v && python3 --version && rustc --version && cargo --version
semgrep --version || true; bandit --version || true; pipx --version || true
pipx run --spec bandit bandit -r sdk/python/ltp_client tests -f txt
pipx run --spec semgrep semgrep --config auto --error --metrics=off --json .
rg -n "\\beval\\(|new Function\\(|child_process\\.|exec\\(|spawn\\(|execSync\\(|spawnSync\\(|shell:\\s*true|vm\\.runIn|document\\.write\\(|innerHTML\\s*=|crypto\\.createHash\\(['\" ]md5|sha1|DES|RC4|ECB|Math\\.random\\(" sdk/js tests tools
rg -n "subprocess\\.|os\\.system|pickle\\.loads|yaml\\.load\\(|eval\\(|exec\\(|md5|sha1|random\\.random\\(" sdk/python tests tools
rg -n "Command::new|std::process::|unsafe\\s*\\{|md5|sha1|rand::random|thread_rng\\(" sdk/rust
rg -n "(AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----|secret[_-]?key\\s*[:=]\\s*['\\\"][^'\\\"]{8,}|password\\s*[:=]\\s*['\\\"][^'\\\"]{6,}|token\\s*[:=]\\s*['\\\"][^'\\\"]{8,})" --glob '!**/fixtures/**' --glob '!**/test*' .
node tests/security/run_all.js
```

## 2) Tooling availability and limitations

- `semgrep` and `bandit` are **not available** in the environment and could not be installed via `pipx` (index access/policy issue).
- JS security tests rely on built artifacts in `sdk/js/dist`, but `npm ci` is blocked (403 on registry package fetch), so those integration checks cannot run end-to-end here.

## 3) Findings

### HIGH-1 — Insecure RNG fallback in cryptographic nonce generation (JS)

**Location:** `sdk/js/src/crypto.ts`  
When secure randomness is unavailable (no browser crypto + no Node crypto), `generateNonce()` falls back to `Math.random()` bytes. This is not cryptographically secure and can weaken replay-protection assumptions if this branch is reached in constrained runtimes.

- Evidence: fallback branch uses `Math.floor(Math.random() * 256)` in nonce random component generation.
- Risk: predictable nonces in weak runtime configuration.

**Recommendation**
1. Remove `Math.random()` fallback entirely and fail-closed with explicit error.
2. If compatibility is required, gate fallback behind an explicit `allowInsecureRandom` flag defaulting to `false` and emit a hard warning + telemetry event.

---

### MEDIUM-1 — UUID fallback path uses non-crypto randomness (JS client)

**Location:** `sdk/js/src/client.ts`  
`generateUUIDv4()` includes a “last resort” path that uses timestamp + `Math.random()`. The code warns, but still produces potentially predictable IDs.

- Risk: predictability of identifiers in degenerate environments (can impact unlinkability and replay-hardness assumptions if identifiers are security-relevant).

**Recommendation**
1. Make the last-resort path opt-in (explicit insecure mode), or
2. throw an error when CSPRNG is unavailable.

---

### MEDIUM-2 — `shell: true` process spawn in security test harness

**Location:** `tests/security/run_all.js`  
The test runner spawns Node processes with `shell: true`. While current inputs are local constants, shell mode broadens injection surface if arguments later become user-influenced.

**Recommendation**
- Prefer `shell: false` and pass command/args as array (default safe path).

---

### INFO-1 — Command execution usages found, mostly test/tool contexts

Multiple `execSync`/`spawn` usages were found in test/tool files (`tools/ltp-inspect/*.ts`, `tests/security/*.js`, etc.). Current usages appear intended for test orchestration/CLI invocation.

**Recommendation**
- Keep these isolated to non-production paths and document trust boundary assumptions.

---

### INFO-2 — Rust crypto appears to use modern primitives

Spot-check indicates use of:
- AES-256-GCM (`aes_gcm`)
- HKDF-SHA256 (`hkdf`, `sha2`)
- HMAC-SHA256 (`hmac`, `sha2`)
- P-256 ECDH (`p256`)

No `unsafe` blocks found in examined rust client crypto paths.

## 4) Positive observations

- Constant-time comparisons are used for signature checks in JS/Python/Rust crypto verification paths.
- Crypto design includes ECDH, HKDF key separation, HMAC nonces, and authenticated metadata encryption patterns.

## 5) Risk summary

- **High:** 1
- **Medium:** 2
- **Info:** 2

Overall posture: **moderate** with one important hardening issue (insecure RNG fallback) that should be addressed promptly.

## 6) Remediation plan (prioritized)

1. **P0:** Remove/disable insecure `Math.random()` fallback in `sdk/js/src/crypto.ts`.
2. **P1:** Remove insecure UUID fallback or gate behind explicit insecure config in `sdk/js/src/client.ts`.
3. **P2:** Replace `shell: true` in `tests/security/run_all.js`.
4. **P3:** Add CI SAST jobs (Semgrep + Bandit + cargo-audit/npm audit) in a network-enabled pipeline.

## 7) Re-run checklist after fixes

- `semgrep --config auto .`
- `bandit -r sdk/python/ltp_client tests`
- `npm --prefix sdk/js ci && npm --prefix sdk/js run build`
- `node tests/security/run_all.js`
- `cargo audit` (in Rust crate directories)

