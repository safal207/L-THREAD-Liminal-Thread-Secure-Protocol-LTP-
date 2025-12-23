# LTP Threat Model & Impossible Attack Classes (by Design)

This page defines a pragmatic threat model for LTP systems and clarifies which attack classes become **impossible by design** when LTP Core invariants are preserved.

LTP is not a security product.
It is a continuity protocol whose invariants create strong security properties as a consequence.

---

## 0) Core Security Boundary (the only thing that matters)

**LTP does not execute text. LTP admits or rejects transitions.**

Everything else is implementation detail.

If an implementation allows untrusted content to directly trigger execution,
it is **not LTP-conformant**, even if message formats match.

---

## 1) Threat Model (what we assume)

We assume the system may face:

- **Untrusted inputs**: web pages, tools output, logs, user-provided files, third-party events
- **Hostile content**: prompt injection, instruction smuggling, adversarial text
- **Network adversaries**: replay attempts, flooding, malformed frames
- **Model volatility**: model swaps, partial outages, drift under retries/restarts
- **Operator mistakes**: misconfiguration, logging secrets, over-permissive actions

We do NOT assume:

- The model is safe
- The user is safe
- The environment is safe
- The tools are safe

LTP is designed for hostile reality.

---

## 2) What LTP Guarantees (when Core invariants hold)

When LTP Core invariants are preserved, LTP provides:

- **Execution boundary**: content ≠ instruction; understanding ≠ execution
- **Admissibility gating**: transitions must pass constraints before any action layer runs
- **Traceability**: all accepted transitions are replayable and auditable
- **Local failure**: errors update drift; they do not silently mutate global state
- **Continuity safety**: recovery remains deterministic across retries/restarts/model swaps

---

## 3) Attack Classes That Become IMPOSSIBLE (by design)

These attacks are impossible **if**:
- decisions do not live inside LTP
- untrusted content is always classified as events
- only admissible transitions can reach the action layer

### 3.1 Prompt Injection → Direct Execution
**Impossible**: web/content cannot directly cause actions.
Untrusted content can propose a transition but cannot execute it.

### 3.2 Instruction Smuggling Across Layers
**Impossible**: the protocol separates:
- untrusted context events
- admissible transitions
- privileged execution

Smuggled instructions remain untrusted events unless explicitly admitted.

### 3.3 Memory Poisoning as a Control Channel
**Impossible** (at protocol level): LTP does not store “knowledge” or accept memory as authority.
Only verified transitions + outcomes may become durable traces.

### 3.4 Drift-by-Retry (Silent Context Mutation)
**Impossible**: retries/restarts cannot silently rewrite continuity state.
They produce traceable drift updates.

### 3.5 Model Swap Breaks Coherence (Undetected)
**Impossible**: orientation continuity is independent of model identity.
Model changes do not overwrite trajectory; they can only propose transitions.

---

## 4) Attack Classes That Are STILL POSSIBLE (but become LOCAL & AUDITABLE)

LTP does not magically eliminate risk. It makes failures bounded and visible.

### 4.1 Malicious User Requests
Users can request harmful actions.
LTP will only help if constraints/policy layers exist and are enforced at admissibility.

### 4.2 Tool Output Poisoning
Tools can return adversarial content.
LTP ensures it stays in the untrusted layer unless admitted.

### 4.3 Data Exfiltration via Allowed Actions
If your action layer is over-permissive, LTP will not save you.
LTP can only gate transitions; it does not define your permissions.

### 4.4 Denial of Service (Flooding)
LTP does not prevent network abuse.
Rate limiting and resource caps must be implemented by the node/runtime.

---

## 5) Non-Goals (what LTP intentionally does NOT do)

LTP does NOT:
- decide what is “best”
- embed ethics/goals
- replace policy engines
- fix model hallucinations
- implement authentication by itself
- provide cryptography by default

Those belong to other layers.

---

## 6) Implementation Requirements (to keep guarantees real)

If you claim LTP Core conformance, your node MUST implement:

- **Identity authority**: do not accept `identity` as a plain client claim if deployed on public networks
- **Rate limits**: per-connection message caps and global caps
- **Log safety**: avoid log-flooding and secret leakage
- **Trace integrity**: accepted transitions must be recorded deterministically
- **Action isolation**: execution must be downstream of admissibility, never upstream

---

## 7) Rule of Thumb

If your system asks:
- “What should we do?” → not LTP
- “How do we do it?” → not LTP
- “Are we allowed to transition, and will it stay coherent over time?” → LTP

---

## Closing

LTP does not try to outsmart adversaries.
It makes entire classes of attacks structurally incapable of triggering execution.

That is the difference between patching a vulnerability
and designing a boundary.
