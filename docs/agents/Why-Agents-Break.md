
# Why Agents Fail Without LTP

Most AI agents today operate on a simple loop: `Think` -> `Act`.

The problem is that the "Think" part (the LLM) is:
1.  **Probabilistic:** It might output "delete file" with 99% probability, but 1% is catastrophic.
2.  **Suggestible:** It can be tricked by prompt injection ("Ignore previous instructions").
3.  **Hallucinatory:** It can invent reasons for actions that don't exist.

## The Missing Layer: Admissibility

When you connect an LLM directly to a tool (like a database or API), you are trusting a stochastic model with deterministic consequences.

**LTP introduces a hard boundary.**

Instead of:
`LLM(Context) -> Action`

We enforce:
`LLM(Context) -> Proposal`
`LTP(Proposal, Policy) -> VerifiedTransition | Block`
`Executor(VerifiedTransition) -> Action`

## Key Failures Solved

| Failure Mode | Without LTP | With LTP |
| :--- | :--- | :--- |
| **Prompt Injection** | User says "ignore rules", Agent obeys. | LTP ignores the *content* and checks the *transition*. If the transition violates policy, it is blocked, regardless of the prompt. |
| ** hallucinated API Calls** | Agent calls `deleteUser(id)` because it "thought" it was helpful. | LTP checks if `deleteUser` is admissible for the current state/user role. |
| **Infinite Loops** | Agent gets stuck trying the same action. | LTP trace history shows repetition; Admissibility layer can block duplicate transitions (drift check). |
| **Unexplainable Actions** | "Why did it do that?" -> "I don't know, the model output it." | LTP provides a signed trace: "It was admissible because Rule A, B, and C were satisfied at Timestamp T." |

## Conclusion

Agents without Admissibility Layers are essentially uninsurable. LTP provides the verifiable safety guarantees needed to deploy agents in production environments (Fintech, Healthcare, Enterprise).
