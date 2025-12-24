# Why LTP is Not Another Agent Framework

**LTP is not a competitor to LangChain, CrewAI, or AutoGPT. It is the safety protocols they run on.**

## The Fundamental Difference

Current agent frameworks focus on **"How to Act"** (capabilities, tools, chaining, memory).
LTP focuses on **"What is Permitted"** (boundaries, legality, orientation, safety).

| Feature | Agent Frameworks (LangChain, etc.) | LTP (Liminal Thread Protocol) |
| :--- | :--- | :--- |
| **Primary Goal** | Maximize agency & task completion. | Maximize safety & auditability. |
| **Core Primitive** | `Tool`, `Chain`, `Agent`. | `Transition`, `Orientation`, `Boundary`. |
| **Flow Control** | "What should I do next?" (Loop) | "Is this proposal admissible?" (Gate) |
| **Output** | Action / Answer. | Verdict (Pass/Fail) + Signed Audit Log. |
| **Role** | The Engine. | The Brakes & Steering. |

## Why Use LTP?

### "Infrastructure of Meaning"
Blockchain records *what happened* (transaction finalized). LTP records *what had the right to happen* (proposal admissible). This distinction is critical for regulated industries (Fintech, Healthcare) where "why did you do that?" is a legal requirement.

### Decoupling Safety from Intelligence
Instead of asking the LLM to "please be safe" (which fails via prompt injection), LTP moves safety into a deterministic, code-based layer *outside* the LLM's context.

*   **LangChain**: "Agent, here is a shell tool. Please don't delete files."
*   **LTP**: "Agent, propose a shell command." -> **LTP Layer**: "Proposal `rm -rf` detected. VIOLATION. Blocked." -> **Runtime**: (Nothing happens).

## Integration

LTP acts as the **Action Boundary** middleware for any framework:

```text
[ LangChain / CrewAI ]  ---> [ LTP Adapter ] ---> [ Real World ]
      (Brains)               (Conscience)          (Reality)
```

1.  **Agent Framework** generates a `ProposedTransition` (instead of calling a function).
2.  **LTP** checks admissibility (Policy, Risk, History).
3.  **LTP** mints a `VerifiedTransition`.
4.  **Runtime** executes the action.

This architecture turns any "black box" agent into a "glass box" compliant system.
