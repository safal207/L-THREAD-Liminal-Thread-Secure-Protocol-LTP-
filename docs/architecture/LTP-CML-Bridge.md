# LTP ↔ CML Bridge

Status: architecture bridge.

## Short thesis

**LTP preserves trust continuity across an agent thread.**

**CML validates whether an action inside that thread was causally legitimate.**

Together:

```text
LTP answers: Is this still the same legitimate thread?
CML answers: Was this action allowed?
```

This bridge connects LTP's replay/admissibility model with CML's causal accountability model.

---

## Why this matters

Long-running agents fail in two different ways:

1. **Continuity failure** — the agent drifts into another context, branch, policy version, or authority boundary.
2. **Causal legitimacy failure** — the action has no valid parent cause, no valid permission lineage, or a broken responsibility chain.

LTP catches the first class.

CML catches the second class.

The combined model is stronger than either layer alone:

```text
A thread can be continuous but contain a causally invalid action.
An action can look locally valid while belonging to a broken trust thread.
```

---

## Division of responsibility

| Layer | Core question | Example failure |
| --- | --- | --- |
| LTP / L-THREAD | Is this execution path admissible and continuous? | branch drift, replay mismatch, unsupported path |
| CML | Why was this action allowed? | missing parent cause, invalid permission lineage, broken responsibility chain |
| T-Trace | What happened in a replayable event stream? | incomplete trace evidence |
| CaPU | Should this decision proceed? | unsafe execution boundary |
| TTM DB | What history must remain immutable? | mutable or conflicting history |

Short form:

```text
LTP preserves continuity.
CML validates legitimacy.
```

---

## How LTP sees the problem

LTP focuses on execution-path admissibility.

It asks:

- Did the agent remain inside the expected thread?
- Was the trace replayable?
- Did the output/action remain grounded in declared anchors?
- Did the system drift into an unsupported path?
- Should the path be accepted, audited, or rejected?

Example LTP-style record:

```json
{
  "thread_id": "customer_limit_review_4821",
  "branch_id": "risk_review.current",
  "previous_step_hash": "sha256:...",
  "policy_context": "credit_risk.v3",
  "authority_context": "human_analyst.supervised",
  "decision": "admissible"
}
```

LTP verdict vocabulary:

```text
admissible / drift / rejected
```

---

## How CML complements LTP

CML focuses on causal permission lineage.

It asks:

- What parent cause authorized this action?
- Which policy permitted it?
- Was the data scope valid?
- Was responsibility preserved?
- Did the action succeed operationally while being causally invalid?

Example CML-style record:

```json
{
  "action": "recommend_limit_change",
  "permitted_by": "policy.credit_risk.v3",
  "parent_cause": "analyst_request.req_219",
  "data_scope": "risk_summary_only",
  "result": "causally_valid"
}
```

CML verdict vocabulary:

```text
PROCEED / AUDIT / BLOCK / REJECT
```

---

## Combined example

A fintech analyst asks an AI agent to recommend a customer transaction limit.

### Safe path

```text
LTP: thread is continuous
CML: action has valid parent cause and policy scope
Final: proceed or human approval required
```

### Drifted path

```text
LTP: rejected branch reused from an old review
CML: action appears locally valid
Final: audit or block because the continuity boundary failed
```

### Causally invalid path

```text
LTP: thread is continuous
CML: action used data outside permitted scope
Final: block because the action was causally invalid
```

This is the core bridge:

```text
LTP validates the path around the action.
CML validates the reason behind the action.
```

---

## Cross-repository reference

The CML-side bridge is maintained in the Causal Memory Layer repository:

```text
https://github.com/safal207/Causal-Memory-Layer/blob/main/docs/LTP_CML_BRIDGE.md
```

Use that document when explaining how CML contributes causal legitimacy to the broader Liminal Stack.

Use this document when explaining how LTP contributes longitudinal trust continuity around CML-validated actions.

---

## Reviewer-facing phrasing

```text
LTP catches continuity-invalid threads.
CML catches causally invalid actions.
```

Or:

```text
LTP keeps the thread admissible.
CML keeps the action accountable.
```

Bottom line:

```text
CML makes actions accountable.
LTP keeps accountability continuous.
```
