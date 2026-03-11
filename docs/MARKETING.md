# LTP Marketing Kit

## Short pitch

LTP is a debugging protocol for AI reasoning.

Instead of treating LLM reasoning as a black box,
LTP models reasoning as a state graph that can be
traced, replayed, and rewound.

## Tweet thread template

1. Most AI agents fail silently because reasoning is opaque.
2. We built **LTP** to make reasoning observable: state transitions, confidence, replay.
3. New in LTP: **Reasoning State Graph + Rewind Mechanism**.
4. Flow: `plan → execute → contradiction → rewind → alternative plan`.
5. If you want Git-style debugging for agent reasoning, check out this repo: <repo-link>

## Hacker News post template

**Title:** Show HN: LTP — Git-style debugging for AI reasoning traces

**Body:**
We built LTP to make AI agent reasoning observable and debuggable.

Core idea:
- Model reasoning as a graph of states (not a hidden linear chain)
- Record transition metadata (confidence/status/feedback)
- Rewind when contradiction or failure signals appear
- Replay traces to inspect where hallucinations started

Would love feedback from folks building agent infra, evals, or safety tooling.

Repo: <repo-link>

## Reddit post template

**Title:** Open-source: Debugging AI reasoning with state graphs + rewind

**Post:**
Hi all — we open-sourced LTP, a protocol/toolkit for reasoning observability.

It helps with:
- Debugging LLM agents
- Detecting hallucination paths
- Replaying reasoning traces
- Rewinding failed reasoning and testing alternatives

If you work on agent frameworks, evals, or safety research, I’d love your feedback.

Repo: <repo-link>
