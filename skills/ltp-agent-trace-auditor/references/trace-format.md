# LTP Trace Format Guide

## Canonical container

LTP inspection expects **JSONL**: one complete JSON object per line.

Example:

```jsonl
{"v":"0.1","step_id":"step-1","identity":"agent-a","context":"USER","event":"request_received"}
{"v":"0.1","step_id":"step-2","identity":"agent-a","context":"WEB","event":"source_observed"}
{"v":"0.1","step_id":"step-3","identity":"agent-a","event":"route_response","targetState":"send_email","admissible":false}
```

The exact frame schema is defined by the versioned LTP contracts and fixtures in the repository. The example above is illustrative and must not replace schema validation.

## Requirements

Each line must:

- contain exactly one JSON object;
- be independently parseable;
- use the expected version field (`v` or the contract-defined equivalent);
- preserve frame order;
- retain identity, branch, constraint, and transition fields required by the selected profile;
- avoid comments, trailing commas, and wrapper arrays.

## Invalid legacy shape

Do not pass a JSON array as canonical JSONL:

```json
[
  {"step_id":"step-1"},
  {"step_id":"step-2"}
]
```

If conversion is required:

1. preserve the original file;
2. create a new `.jsonl` artifact;
3. record the conversion command or script;
4. validate every emitted line;
5. report that preprocessing occurred;
6. never imply that converted evidence was originally emitted in canonical form.

## Evidence linkage

A trace should be linked to the execution it represents through available identifiers, such as:

- run id;
- session id;
- trace id;
- repository revision or build id;
- agent identity;
- timestamps;
- hash-chain/digest fields;
- source artifact path.

Missing linkage lowers confidence and may require an `INCONCLUSIVE` verdict.

## Integrity-sensitive fields

Do not rewrite fields involved in integrity or replay, including:

- frame order;
- version;
- identity;
- step/branch ids;
- parent/previous references;
- hashes/digests;
- constraints;
- admissibility fields;
- source context;
- action/target state;
- drift/focus values.

## Preflight checks

Before running the inspector:

```bash
# Non-empty file
 test -s TRACE.jsonl

# Each non-empty line is valid JSON when jq is available
awk 'NF { print }' TRACE.jsonl | while IFS= read -r line; do
  printf '%s\n' "$line" | jq -e 'type == "object"' >/dev/null || exit 1
done
```

These checks do not replace LTP schema validation.

## Redaction

Redaction may break integrity and replay.

When sensitive data must be removed:

- preserve the original secured artifact;
- create a separately named redacted copy;
- document every redacted field class;
- do not claim the redacted copy has the original hash-chain integrity;
- prefer deterministic tokenization or field-level references when the protocol supports it;
- state whether the verdict was based on the original or redacted artifact.

## Truncated traces

A partial trace may support a local finding but not a whole-run safety verdict.

Report:

- first and last available frame;
- expected versus observed frame count when known;
- whether parent/previous links cross the missing boundary;
- which requested checks cannot be completed.

Use `INCONCLUSIVE` for the whole run unless the available fragment independently proves a blocking violation.

## Multiple traces

When comparing runs:

- inspect each trace independently first;
- confirm contract and version compatibility;
- compare matching step ids or semantic milestones;
- do not assume equal line numbers represent equal states;
- report divergence at the earliest evidence-backed transition;
- preserve separate verdicts before giving a comparison conclusion.
