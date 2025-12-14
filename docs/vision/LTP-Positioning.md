# LTP Positioning: A Protocol for Orientation

To understand the role of LTP, it is helpful to place it in context with other foundational protocols of the internet and software. Each of these protocols standardized a specific layer of communication, enabling innovation on top.

## Analogies to Foundational Protocols

- **TCP** standardizes the transmission of **packets**. It provides a reliable stream for data but knows nothing of its meaning.
- **HTTP** standardizes the transfer of **documents**. It gives packets a semantic meaning—the request and retrieval of resources—but is largely stateless.
- **Git** standardizes the representation of **history**. It provides a common language for tracking changes in a distributed way, but it does not dictate the content.
- **LTP** standardizes the communication of **orientation and possible paths**. It provides a formal structure for expressing a system's current context and the potential futures branching from it.

Just as HTTP is not a website and Git is not a codebase, LTP is not an application. It is a minimal, underlying language for a class of problems that are currently solved with ad-hoc, proprietary solutions.

## Why LTP is Not a Recommendation Engine

It is common to mistake LTP for a recommendation or personalization engine. The distinction is critical.

- **A recommendation engine provides answers.** Its goal is to analyze a large dataset and predict the single "best" item or action for a user to take. Its internal logic is often a black box, and its purpose is to guide the user toward a specific, predetermined outcome (e.g., a purchase, a click).

- **LTP provides a map.** It does not give answers; it exposes possibilities. Its purpose is to provide an agent—whether human or machine—with the necessary context to make its own informed decision. The core of LTP is not prediction, but **explainable orientation**.

| Feature | Recommendation Engine | Liminal Thread Protocol (LTP) |
| :--- | :--- | :--- |
| **Primary Output** | A single "best" answer or a ranked list. | A multi-branch set of possible paths with rationales. |
| **Goal** | Drive a specific outcome. | Provide context for an informed decision. |
| **Logic Transparency** | Typically opaque ("black box"). | Transparent and explainable by design. |
| **State** | Stateful, relies on vast historical data. | Stateless at the protocol level. |
| **Authority** | Centralized authority on the "best" choice. | Decentralized; empowers the client to choose. |

In short, a recommendation engine says, "Here is what you should do." LTP says, "Here is where you are, and here are the paths you could take."
