# LTP Adapters (Model-Agnostic)

LTP is model-agnostic by design and can sit in front of GPT, Claude, LLaMA, Grok, and future models.

## Current adapter targets

- LangChain
- CrewAI
- AutoGen (roadmap toward v1.2 reference adapter)

## Adapter contract

Each adapter should map framework messages into LTP trace events containing:

- timestamp
- input
- output
- anchors
- decision

This keeps replay, phase checks, and audit evidence consistent across frameworks.
