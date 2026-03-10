# PLF (Jeff Walker style) for LTP — Newcomer Sequence

> Goal: convert a cold newcomer into a confident first-time LTP practitioner in 7–10 days.

## 0) Audience and promise

**Audience:** engineers, product leads, security/compliance stakeholders who are "LTP-curious" but not yet active.

**Core promise:**
- In under one week, a newcomer can understand *why LTP exists*, run a practical demo, and produce first audit-friendly trace evidence.

**North-star outcome:**
- "I can explain LTP in one sentence, run one demo command, and show one verifiable artifact to my team."

---

## 1) PLF structure adapted for LTP

Classic PLF blocks mapped to repo reality:

1. **Pre-Prelaunch (Seed curiosity)**
2. **Prelaunch Content 1 (Opportunity shift)**
3. **Prelaunch Content 2 (Transformation + mechanism)**
4. **Prelaunch Content 3 (Ownership + objection handling)**
5. **Open Loop / Micro-Commit (Action now)**
6. **Close / Continuation (Retention + expansion)**

---

## 2) Message sequence (copy-ready)

### Day 1 — Pre-Prelaunch: "The hidden risk"
**Subject/Hook:** "Why most AI logs fail when leadership asks: why did this happen?"

**Message:**
- Most teams can log outputs, but cannot replay continuity decisions deterministically.
- As systems scale, handoff ambiguity becomes operational and compliance risk.
- LTP addresses continuity semantics, not model quality.

**CTA:** read the short context page:
- [docs/readme/WHY_ORIENTATION.md](../readme/WHY_ORIENTATION.md)

---

### Day 2 — PLC1: "New opportunity"
**Subject/Hook:** "From opaque agent behavior to verifiable continuity"

**Message:**
- Reframe: stop treating this as observability-only.
- Treat it as protocol-level continuity with deterministic replay.

**CTA:** skim canonical protocol surface:
- [specs/LTP-Spec-v0.1.md](../../specs/LTP-Spec-v0.1.md)

---

### Day 3 — PLC2: "Mechanism"
**Subject/Hook:** "How LTP works without model re-execution"

**Message:**
- Trace-based event representation
- Conformance structure
- Replay and inspection tooling

**CTA (first action):**
```bash
pnpm -w demo:canonical
```
Then inspect quickstart docs:
- [docs/devtools/quickstart.md](../devtools/quickstart.md)

---

### Day 4 — PLC3: "Belief and objections"
**Subject/Hook:** "Is this just logs? Is this vendor lock-in?"

**Message:**
- Not just logs: protocol-level semantics and invariants.
- Not framework lock-in: neutral surface and adapters.
- Not AI replacement: continuity/control layer.

**CTA:**
- [adapters/README.md](../../adapters/README.md)
- [docs/invariants.md](../invariants.md)

---

### Day 5 — Open Loop: "Do one proof action"
**Subject/Hook:** "Can you produce one verifiable result today?"

**Action CTA:**
```bash
pnpm -w ltp:verify
```

**Proof artifact expectation:**
- a generated conformance/evidence output that can be shared internally.

Reference:
- [docs/operational-notes/conformance.md](../operational-notes/conformance.md)

---

### Day 7 — Close/Continuation: "From trial to rollout"
**Subject/Hook:** "Pilot complete. What next?"

**Message:**
- Standardize trace checks in CI
- Pick one business-critical workflow for LTP continuity enforcement
- Align security/product stakeholders around repeatable evidence

**CTA:**
- [docs/positioning/ONE_PAGER.md](../positioning/ONE_PAGER.md)
- [docs/devtools/ci-artifacts.md](../devtools/ci-artifacts.md)

---

## 3) LTP onboarding ladder (micro-commit sequence)

Use this if you need a concise LTP sequence for beginners:

1. **Learn** — "Why orientation matters"
2. **Observe** — run canonical demo
3. **Test** — run verification command
4. **Share** — send one-pager + one artifact internally

This is the minimum habit loop that turns passive readers into active adopters.

---

## 4) Objection handling snippets

- **"We already have logs."**
  - Great. LTP complements logs by adding continuity semantics and deterministic replay.

- **"We are multi-vendor."**
  - LTP is protocol-first and works as a neutral continuity layer.

- **"Compliance will slow us down."**
  - Start with one critical flow and one artifact; expand only after internal buy-in.

---

## 5) Metrics to track (first 30 days)

- % newcomers who run at least one demo command
- % newcomers who produce one verification artifact
- Time-to-first-internal-share (one-pager + artifact)
- Number of teams adopting one CI continuity check

---

## 6) Ready-to-use internal post template

**Title:** "We tested LTP in one workflow — here’s what changed"

**Body skeleton:**
1. Problem we had (handoff ambiguity, replay difficulty, audit pressure)
2. What we ran (`demo:canonical`, `ltp:verify`)
3. What artifact we produced
4. What decision became easier/faster
5. Next rollout step (1 additional workflow)

---

## 7) Quick links bundle

- Protocol: [specs/LTP-Spec-v0.1.md](../../specs/LTP-Spec-v0.1.md)
- Quickstart: [docs/quickstart/devtools.md](../quickstart/devtools.md)
- DevTools: [docs/devtools/quickstart.md](../devtools/quickstart.md)
- Conformance: [docs/operational-notes/conformance.md](../operational-notes/conformance.md)
- Positioning: [docs/positioning/ONE_PAGER.md](../positioning/ONE_PAGER.md)


---

## 8) What Jeff Walker would likely strengthen further

If you want this sequence to convert better, add these PLF levers:

1. **Future pacing in every touchpoint**
   - Explicitly show the user where they will be in 24h / 7 days / 30 days.
   - Example line: "By Friday, you will have one replayable trace your security lead can review in 3 minutes."

2. **Ownership stories (small wins, fast)**
   - Showcase 1–2 tiny "before/after" cases from the same repo workflow.
   - Keep stories operational, not abstract: command run → artifact produced → decision improved.

3. **Visible social proof loop**
   - Add a rolling section in updates/issues with: team, use-case, artifact screenshot/link, takeaway.
   - This reduces perceived implementation risk for new evaluators.

4. **Ethical urgency (not hype)**
   - Use time-boxed language around pilot windows and decision checkpoints.
   - Avoid fake scarcity; use real planning constraints (e.g., quarterly control review).

5. **Single next step per message**
   - Each email/post should ask for one action only: read, run, verify, or share.
   - Multi-CTA messages consistently lower completion.

---

## 9) Launch assets checklist (minimum viable PLF stack)

- **One-page strategic brief** → [docs/positioning/ONE_PAGER.md](../positioning/ONE_PAGER.md)
- **Primary demo path** → `pnpm -w demo:canonical`
- **Verification command** → `pnpm -w ltp:verify`
- **Technical trust anchor** → [specs/LTP-Spec-v0.1.md](../../specs/LTP-Spec-v0.1.md)
- **Operational trust anchor** → [docs/devtools/ci-artifacts.md](../devtools/ci-artifacts.md)
- **Compliance conversation starter** → [docs/fintech/Compliance-Inspection.md](../fintech/Compliance-Inspection.md)

If any of these are missing in communications, conversion from interest → action usually drops.

---

## 10) 7-day conversion scorecard (quick read)

Track daily during launch week:

- **Reach:** how many newcomers opened/visited the message touchpoint
- **Activation:** how many ran one command (`demo:canonical` or `ltp:verify`)
- **Evidence:** how many produced and shared one artifact internally
- **Expansion intent:** how many teams selected a second workflow for rollout

Simple benchmark targets for a healthy first cycle:

- Activation >= 25% of engaged viewers
- Evidence >= 40% of activated users
- Expansion intent >= 30% of evidence-producing users

Use these numbers to refine sequence copy, not to pressure teams.


## 11) Implementation in this repo

This sequence is now operationalized as a runnable kit:
- [docs/marketing/plf-kit/README.md](plf-kit/README.md)
- Generator script: `npm run -s marketing:plf:generate -- --project "LTP Pilot" --owner "Platform Team"`

