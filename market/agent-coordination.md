# Agent-to-Agent Coordination Scenario

## 1. Problem
Distributed software agents need to cooperate on tasks like triaging incidents or reconciling ledgers without drifting into conflicting actions. Reinforcement loops or reward prompts often cause brittle behavior, reward hacking, and opaque decisions that operators cannot debug.

## 2. Why Existing Solutions Fail
- Reward-based coordination is slow to converge and can reward undesirable shortcuts.
- Central planners become bottlenecks, so teams pile on ad hoc rules, creating hidden coupling across agents.
- Post-incident reviews lack visibility into why an agent took a path; logs show actions but not the orientation that led there.

## 3. LTP-Based Approach
Agents share **orientation** frames that declare current intent (“diagnose queue backlog,” “await approvals”) and limits (“do not mutate production state”). When one agent needs help, it issues a **route_request** to a peer or mediator; the response comes back as **route_response** with explicit branch reasons (“returned backlog metrics, escalated due to missing permissions”). A **focus_snapshot** records the joint state so a coordinator can rehydrate context or hand off to a human. The protocol keeps agents aligned through transparent routing rather than reward tweaks.

## 4. Minimal Flow Example
```json
{
  "orientation": {
    "role": "triage-agent",
    "intent": "diagnose backlog",
    "guardrails": ["no production writes"]
  },
  "route_request": {
    "target": "metrics-agent",
    "need": "queue depth and error rate"
  }
}
```

Reply:
```json
{
  "route_response": {
    "target": "metrics-agent",
    "result": {
      "queue_depth": 1240,
      "error_rate": 0.07
    },
    "branches": [
      {"action": "escalate", "reason": "guardrail: cannot page DB"}
    ]
  },
  "focus_snapshot": {
    "coordination_id": "incident-4821",
    "state": "diagnosis pending human approval"
  }
}
```

## 5. Value Outcome
- **Cost:** No training loops; coordination logic lives in lightweight routing contracts.
- **Resilience:** If a specialist agent is offline, peers still exchange orientations to select fallback actions without breaking guardrails.
- **Explainability:** Every handoff carries rationale; audits focus on explicit reasons rather than inferred rewards.
- **Adaptability:** Changing who handles what is a routing update, not a retraining cycle.
