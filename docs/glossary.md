# Glossary

- **Orientation**: The minimal state required to keep behavior coherent over time (not “memory content”).
- **Orientation Snapshot**: A frozen, replayable checkpoint of orientation at a moment in time.
- **Continuity**: The property that the system remains the same system over time, across retries/restarts/model swaps.
- **Transition**: A step from one oriented state to another.
- **Admissibility**: Whether a proposed transition is allowed under constraints and continuity.
- **Constraints**: Formal rules that restrict admissible transitions (policy, safety, resources, temporal gates).
- **Drift**: Measurable deviation of orientation over time that risks discontinuity.
- **Temporal Permission**: A rule that allows execution only when readiness/time conditions are met.
- **Data Plane**: Model inference / generation / execution outputs.
- **Control Plane**: Orientation, constraints, admissibility, replay.
- **Trace**: A verifiable record of transitions and validations (replayable).
