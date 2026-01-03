# Non-goals (as Design Constraints)

## Why this page exists
This page addresses the most common misunderstandings that arise when engineers first encounter LTP.
Most misconceptions come from trying to map LTP onto existing categories (framework, agent system, memory, policy engine).
LTP intentionally does not fit into those boxes.

## Misconception 1: “LTP is another agent framework”
Incorrect.

LTP does not define:
- agents
- roles
- tools
- goals
- behaviors

Agent frameworks act.  
LTP orients.

An agent may use LTP, but LTP never becomes an agent.

## Misconception 2: “LTP decides what should happen next”
Incorrect.

LTP never answers:
- what to do
- which option is best
- what the user wants

It only answers:
- is this transition admissible
- does this preserve continuity
- are we still on the same trajectory

Decision logic always lives outside the protocol.

## Misconception 3: “LTP is just memory with a fancy name”
Incorrect.

Memory stores content.  
LTP stores orientation.

You can delete all memory and still preserve:
- direction
- constraints
- valid next steps

Without orientation, memory becomes noise.  
Without memory, orientation can still guide reconstruction.

## Misconception 4: “LTP replaces models or reduces hallucinations”
Incorrect (but related).

LTP does not:
- fix hallucinations
- improve accuracy
- change model weights

However, by preserving orientation:
- hallucinations become traceable
- failures become local
- recovery becomes deterministic

LTP does not make models smarter.
It makes systems less fragile.

## Misconception 5: “LTP is opinionated or philosophical”
Incorrect.

Although LTP uses metaphors in explanations, the protocol itself is:
- deterministic
- neutral
- formally constrained
- testable via conformance

No values, ethics, or goals are embedded in the protocol.
Meaning is observed, not imposed.

## Misconception 6: “LTP competes with existing standards”
Incorrect.

LTP does not replace:
- HTTP
- gRPC
- WebSockets
- message queues

It operates above transport and below decision logic.
Think of LTP as a continuity layer, not a network protocol.

## Misconception 7: “LTP is only for AI systems”
Incorrect.

While LTP emerged from AI failures, it applies to any system where:
- retries exist
- restarts happen
- time matters
- coherence must survive errors

AI systems simply expose the problem earlier.

## Rule of thumb
If your system asks:
- “What should we do?” → not LTP
- “How do we do it?” → not LTP
- “Are we still the same system over time?” → LTP

## Why clearing misconceptions matters
Protocols fail when:
- people expect features they were never meant to provide
- scope expands silently
- invariants become optional

LTP survives by being precise about its role.

## Closing note
Understanding what LTP is not is often more important than understanding what it is.
That clarity is what allows others to safely build on top.
