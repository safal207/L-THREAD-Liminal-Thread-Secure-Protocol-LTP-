# Edge / Infrastructure Scenario

## 1. Problem
Edge networks and distributed infrastructure must keep services running when links flap, caches expire, or regions go dark. Existing systems rely on cascades of alerts and brittle failover playbooks that overwhelm operators and delay recovery.

## 2. Why Existing Solutions Fail
- Alert storms flood teams with symptoms instead of orientation, leading to slow triage.
- Centralized control planes assume full visibility; when telemetry drops, automated actions stall or overreact.
- Failover scripts hard-code paths; minor topology changes break them during incidents.

## 3. LTP-Based Approach
Routers, caches, and controllers exchange **orientation** frames that summarize local health (“degraded link,” “cache stale,” “traffic spike”) and constraints. When traffic needs rerouting, nodes send **route_request** frames with explicit goals (“keep latency under 120ms,” “prefer on-prem peers”). Peers answer with **route_response** frames that state chosen branches and reasons (“kept local cache despite staleness; upstream unreachable”). Periodic **focus_snapshot** frames capture the current routing picture so humans or automation can rewind and adjust without drowning in alerts.

## 4. Minimal Flow Example
```json
{
  "orientation": {
    "node": "edge-paris-3",
    "state": "degraded-link",
    "hint": "packet loss 8%"
  },
  "route_request": {
    "goal": "preserve latency <120ms",
    "options": ["edge-frankfurt-1", "edge-madrid-2"]
  }
}
```

Response:
```json
{
  "route_response": {
    "selected": "edge-frankfurt-1",
    "branches": [
      {"action": "keep local cache", "reason": "upstream stale but reachable"},
      {"action": "limit cross-region", "reason": "avoid 8% loss path"}
    ]
  },
  "focus_snapshot": {
    "topology_view": "eu-edges-oct19-02:15",
    "note": "can degrade to madrid if frankfurt latency >140ms"
  }
}
```

## 5. Value Outcome
- **Cost:** Less dependence on heavy telemetry aggregation or global orchestration; routing happens through small frames.
- **Resilience:** Nodes announce intent and fallbacks, enabling graceful degradation instead of cascading failures.
- **Explainability:** Every routing decision carries reasons, replacing alert noise with actionable context.
- **Adaptability:** Adding or retiring edges is a routing configuration change; no retraining or complex playbook rewrites.
