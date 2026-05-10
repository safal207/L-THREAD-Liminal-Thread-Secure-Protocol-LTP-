# README Quickstart Validation — 2026-05-10

**Status:** Partial / blocked by environment network resolution  
**Issue:** #417  
**Goal:** validate the README local validation flow from a clean environment.

## Environment

Clean container environment:

```text
OS: Linux x86_64
Node: v22.16.0
npm: 10.9.2
Corepack: 0.32.0
pnpm: not installed as a direct command
Git: 2.47.3
```

## README commands under review

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm test:conformance
```

## Attempted clean clone

```bash
git clone --depth=1 https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-.git repo
```

Result:

```text
fatal: unable to access 'https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-.git/': Could not resolve host: github.com
```

## Result

The quickstart could not be fully validated in this container because the environment could not resolve `github.com`.

The failure happened before repository installation or tests could run.

## Observed prerequisite gap

The clean environment had Node and Corepack available, but `pnpm` was not installed as a direct command.

Because the repository declares:

```json
"packageManager": "pnpm@9.15.0"
```

new contributors should be given an explicit Corepack setup step before running `pnpm`.

Recommended prerequisite step:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm --version
```

Expected pnpm version:

```text
9.15.0
```

## Follow-up needed

To close #417 completely, run the full validation on a machine with working GitHub/DNS access:

```bash
git clone --depth=1 https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-.git
cd L-THREAD-Liminal-Thread-Secure-Protocol-LTP-
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
pnpm test
pnpm test:conformance
```

Record:

- OS and version.
- Node version.
- npm version.
- pnpm version.
- Commit SHA.
- Test output summary.
- Any failure logs.

## QA conclusion

This validation attempt produced a useful documentation finding but did not fully validate the quickstart. The issue should remain open until the install and test commands are run successfully in a network-enabled clean environment.
