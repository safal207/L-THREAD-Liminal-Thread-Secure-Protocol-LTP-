# LTP Prompt Injection Resistance

## Why this document exists

Prompt injection is a structural vulnerability in systems that treat
text as executable intent.

LTP avoids this class of vulnerabilities by design.

This document explains how.

---

## Core Principle

**LTP does not execute text.  
LTP validates transitions.**

Understanding is not authority.  
Content is not permission.

---

## The Common Failure Mode (Agent Browsers)

Typical agent systems follow this pattern:

Untrusted text ↓ LLM interprets as instruction ↓ Decision ↓ Action

There is no hard boundary between:
- data
- intent
- authority

This makes prompt injection inevitable.

---

## LTP Architecture Overview

LTP enforces a strict three-layer separation.

### 1. Context Layer (Untrusted)

Sources:
- Web pages
- External text
- Third-party signals

Rules:
- Never executable
- Never action-triggering
- Always treated as events

---

### 2. Meaning & Transition Layer (LTP Core)

Responsibilities:
- Interpret meaning
- Evaluate admissibility
- Check continuity and constraints

Output:

ProposedTransition

Not an action.

---

### 3. Action Layer (Trusted, External)

Actions are allowed only if:
- The transition is admissible
- The source is authorized
- The capability exists
- Execution is explicitly permitted

---

## Source-Based Meaning Validation

Every meaning carries provenance:

Meaning { content source: USER | SYSTEM | WEB | MEMORY trust_level }

### Rule

**WEB-originated meaning can never initiate actions.**

It may influence context.
It may propose transitions.
It may never execute.

---

## Transition Is Not Execution

Example:

Web content: "Click here to verify your account"

↓ LTP Interpretation

ProposedTransition { type: external_action source: WEB risk: high }

↓ Result

BLOCKED

The system understands the request.
The system does not act.

---

## Action Authority Model

Actions require:
- Capability
- Contextual alignment
- Valid transition
- Explicit permission

Without all four:

Understanding: yes Execution: no

---

## Memory Poisoning Immunity

LTP memory stores:
- Verified transitions
- Outcomes

It does not store:
- Raw commands
- Unverified instructions
- Untrusted intent

Memory is a filter, not a log.

---

## Meaning as Permission

Meaning in LTP is not information.
Meaning is permission to change state.

Text alone never grants permission.

---

## Why This Is Not a Patch

LTP does not:
- Detect malicious text better
- Filter prompts harder
- Rely on heuristics

Instead:
- Text cannot control execution paths

This is capability-based security applied to meaning.

---

## Summary

Prompt injection is impossible in LTP because:

- Text ≠ instruction
- Understanding ≠ action
- Context ≠ authority
- Memory ≠ log

This is a protocol invariant.


---

✅ Acceptance Criteria

[ ] File added exactly at docs/canon/LTP-Prompt-Injection-Resistance.md

[ ] No code changes

[ ] No speculative language

[ ] No product claims

[ ] Consistent with existing canon docs


---

Если хочешь — следующим шагом можем:

добавить короткую ссылку из README

сделать LTP vs Agent Browsers diagram

превратить это в security slide для инвесторов


Скажи, куда дальше идём 🚀
