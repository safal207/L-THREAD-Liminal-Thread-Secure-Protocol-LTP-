# What LTP Is Not

To understand what the Liminal Thread Protocol (LTP) *is*, it is essential to clarify what it is *not*. LTP is a specialized protocol for **orientation and admissibility**, not a general-purpose AI framework.

## 1. Not an AI Controller

LTP does not "control" the AI in the sense of guiding its thoughts or improving its prompts.
*   **Misconception**: "LTP makes my agent smarter."
*   **Reality**: LTP makes your agent **accountable**. It tracks *where* the agent is and *what* it is allowed to do, but it doesn't tell the agent *how* to solve the problem.

## 2. Not a Policy Engine

While LTP *enforces* policy decisions, it is not the policy engine itself.
*   **Misconception**: "I write my OPA (Open Policy Agent) rules in LTP."
*   **Reality**: LTP carries the **result** of the policy decision (`Admissible` / `Blocked`) and the **context** required to make it. You can plug OPA, strictly-typed code, or any other logic *into* the LTP Admissibility Layer, but LTP is the *transport*, not the *logic*.

## 3. Not Model Governance

LTP is not about MLOps, model weights, or training data versioning.
*   **Misconception**: "LTP tracks which version of Llama-2 I used."
*   **Reality**: LTP tracks the **runtime behavior** of the agent system. It records that *an* agent (identified by a key) proposed an action. It is agnostic to the underlying model architecture.

## 4. Not Inference Runtime

LTP does not execute the model.
*   **Misconception**: "I run my LLM on the LTP Node."
*   **Reality**: The LTP Node sits **beside** or **downstream** of the LLM. The LLM generates tokens; the LTP SDK captures the *intent* (Orientation) and *proposed actions* (Transitions) derived from those tokens.

---

**Analogy**:
*   **The LLM** is the **Driver** (Cognition).
*   **The App Logic** is the **Engine** (Execution).
*   **LTP** is the **Road System & Traffic Lights** (Protocol).
    *   It defines valid lanes (Orientation).
    *   It signals Stop/Go (Admissibility).
    *   It records the journey (Trace).
    *   It does *not* drive the car.
