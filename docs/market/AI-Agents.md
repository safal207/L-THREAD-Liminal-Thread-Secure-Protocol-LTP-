# AI Agents in LTP: Compliance & Accountability

## What is an "AI Agent" in LTP terms?

In the context of the Liminal Thread Protocol (LTP), an **AI Agent** is defined not by its intelligence or autonomy, but by its **agency**—the capacity to initiate state transitions that affect external systems.

Specifically, an AI Agent is a system that:
1.  **Perceives** context (inputs, state).
2.  **Orients** itself within a possibility space.
3.  **Proposes** transitions (actions).
4.  **Executes** those transitions if admissible.

LTP treats the "Agent" as a **proposer**, not an authority. The protocol enforces a strict separation between the **Cognitive Layer** (the LLM/Model that proposes "what to do") and the **Admissibility Layer** (the Policy Engine/LTP that determines "if allowed").

## Why agents require auditability

Autonomous agents introduce non-deterministic behavior into deterministic systems (banking, healthcare, infrastructure). Unlike traditional software, where `Input A + State B -> Output C` is guaranteed by code, AI agents rely on probabilistic models where `Input A + State B -> Output C (90%)` or `Output D (10%)`.

This probabilistic nature creates specific risks:
*   **Hallucination**: The agent invents facts or capabilities it does not possess.
*   **Silent Drift**: The agent's behavior gradually deviates from safety baselines over long sessions.
*   **Unintended Action**: The agent correctly identifies a goal but selects a harmful or unauthorized method to achieve it (e.g., deleting a database to "clean up").

Traditional logging is insufficient because it records *what happened*, but not *why it was allowed* or *what the agent believed* at the moment of decision.

## Failure Modes

LTP specifically addresses the following agent failure modes:

| Failure Mode | Description | LTP Mitigation |
| :--- | :--- | :--- |
| **Context Collapse** | Agent loses track of "who" it is acting on behalf of. | **Identity Binding**: Every frame is cryptographically bound to an origin identity. |
| **Goal Drift** | Agent pursues a sub-goal that violates the primary directive. | **Orientation Frames**: Periodic `focus_snapshot` frames track drift level relative to the mission. |
| **Unauthorized Critical Action** | Agent attempts high-risk action (e.g., transfer money) without privilege. | **Admissibility Checks**: `route_request` frames for critical actions are evaluated against explicit policies before execution. |
| **Prompt Injection** | External input overrides agent instructions. | **Trace Integrity**: The causal chain of "Input -> Orientation -> Action" is immutable and auditable. |

## How LTP addresses accountability, not intelligence

LTP does not attempt to make the agent "smarter" or "better." It makes the agent **accountable**.

*   **Not Intelligence**: LTP does not use embeddings, RAG, or reinforcement learning to guide the agent.
*   **Accountability**: LTP provides a cryptographic "flight recorder" (Black Box) for the agent.

By enforcing a protocol of **Propose -> Check -> Act**, LTP ensures that even if an agent *wants* to do something unsafe, the system has a standardized mechanism to reject it and record the rejection. This shifts the liability model from "The AI did something unpredictable" to "The system successfully contained an unpredictable AI" (or, in failure, "We have cryptographic proof of exactly why the check failed").
