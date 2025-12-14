# Streaming / Recommendation Scenario

## 1. Problem
Subscription streaming teams need to balance stability (keep familiar titles visible) with exploration (surface new series) without disrupting viewer trust. Current approaches lean on opaque scoring models that push large batches of recommendations, creating sudden shifts and unexplained picks that erode engagement.

## 2. Why Existing Solutions Fail
- Model-driven ranking overfits to recent clicks, creating whiplash between binge sessions and casual browsing.
- Rule-based overrides multiply; experiments leave behind brittle flags that conflict and cause unpredictable rows on the home screen.
- Alerting on “bad recommendations” devolves into dashboards of noise because no one can see how items were routed onto the page.

## 3. LTP-Based Approach
LTP frames the experience as routed attention rather than predictive taste. Clients and services exchange explicit **orientation** frames describing intent (steady comfort vs. light exploration), then issue **route_request** frames for specific rows (e.g., “family movie night,” “continue watching”). Services respond with **route_response** frames that include branch reasons (“kept comfort titles because past 3 sessions were long-form”) instead of opaque scores. A **focus_snapshot** can capture the current layout and rationale so teams can audit what the user saw. No model retraining or heavy data pipelines are required—just disciplined routing and reflection.

## 4. Minimal Flow Example
```json
{
  "orientation": {
    "viewer_state": "comfort",
    "exploration_budget": 0.2,
    "context": "weeknight living room"
  },
  "route_request": {
    "row_id": "featured",
    "slots": 10
  }
}
```

Service replies:
```json
{
  "route_response": {
    "row_id": "featured",
    "branches": [
      {"title": "Comfort picks", "reason": "last 3 sessions long-form"},
      {"title": "Light exploration", "reason": "budget 0.2"}
    ]
  },
  "focus_snapshot": {
    "layout_id": "evening-stable",
    "evidence": "kept proven franchises; limited new sci-fi to 2 slots"
  }
}
```

## 5. Value Outcome
- **Cost:** No need for constant model retraining or feature pipelines to explain rank shifts.
- **Resilience:** Orientation and responses travel as small, inspectable frames; routing logic can degrade gracefully when a catalog service is slow by trimming exploration first.
- **Explainability:** Every row shows why items appeared; stakeholders can debug routing paths instead of reverse-engineering scores.
- **Adaptability:** Changing exploration budgets or branch reasons does not require ML changes—just adjust routing policies expressed in frames.
