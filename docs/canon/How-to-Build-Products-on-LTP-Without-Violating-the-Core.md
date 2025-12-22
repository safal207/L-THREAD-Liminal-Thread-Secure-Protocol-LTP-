# How to Build Products on LTP Without Violating the Core

## Purpose
This page defines what is allowed and what is forbidden when building products, platforms, or agents on top of LTP.

The goal is simple:
enable innovation without breaking continuity.

## The core rule (read this first)
LTP must never decide outcomes.  
It may only decide admissibility of transitions.

If this rule is broken — the system is no longer LTP-compatible.

## What LTP provides (must remain intact)
Any product built on LTP may rely on these invariants:
- orientation snapshots (frozen, replayable)
- continuity checks between states
- temporal permission and deferred execution
- localized failure (errors do not propagate globally)
- reversibility of steps (when possible)
- separation between protocol and business logic

These are non-negotiable.

## What builders are free to implement
On top of LTP, you may freely build:
- AI agents and multi-agent systems
- decision engines and planners
- memory systems (short / long-term)
- ethical layers and policy engines
- financial, medical, or governance logic
- UI/UX, personalization, analytics
- model orchestration and routing

LTP does not restrict what you build — only where decisions live.

## Where decisions must live
Decisions must exist outside the protocol, for example:
- in application code
- in agents
- in models
- in human-in-the-loop systems
- in external policy layers

LTP only answers questions like:
- “Is this transition coherent?”
- “Does this violate continuity?”
- “Is execution permitted at this time?”
- “Can we safely resume from here?”

## Forbidden patterns (hard no)
The following patterns violate the LTP core:

### ❌ Embedding goals inside LTP
LTP must not know *why* something is done.

### ❌ Optimizing for outcomes inside LTP
No scoring, ranking, rewards, or utility functions.

### ❌ Using LTP as an agent brain
LTP is not cognition. It is orientation.

### ❌ Letting LTP mutate business state
LTP may observe and validate — never mutate domain data.

### ❌ Silent expansion of scope
If LTP starts “helping” with decisions, it is already broken.

## A safe integration checklist
Before shipping a product on LTP, ask:
- Can I remove LTP and still see the same decisions?
- Does LTP only block or allow transitions — nothing more?
- Are failures local and replayable?
- Can I explain LTP behavior without referencing goals?

If the answer is “yes” — you’re aligned.

## Closing statement
LTP is intentionally minimal.
Its power does not come from intelligence, but from restraint.
Everything meaningful grows on top — not inside.
