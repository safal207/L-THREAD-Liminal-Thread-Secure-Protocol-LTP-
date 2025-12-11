# Geometry of Meaning — Mathematical Core (v1)

## Manifold Definition
Meaning is modeled as a manifold **M** whose points are intention states. A metric **g** encodes clarity, focus vector, temporal depth, and stability.

- **Point**: `p ∈ M` represents a semantic-intent state.
- **Metric components**: `g = diag(w_c*clarity, w_f*|focus|, w_t*timeDepth, w_s*stability)` with tunable weights `w_*`.

## Choice Curve
A trajectory `γ(t)` through M minimizes the action functional:

```
S = ∫ ( tension(t)^2 + entropyPenalty(t) - resonanceBoost(t) ) dt
```

- **tension** penalizes stressed paths.
- **entropyPenalty** discourages diffuse, low-clarity branches.
- **resonanceBoost** rewards alignment with current focus and collective threads.

## Phase Transitions
Bifurcation patterns map to cognitive shifts:
- **Saddle-node**: collapse of a prior goal; path disappears.
- **Pitchfork**: symmetry-breaking emergence of a new direction.
- **Hopf**: self-sustaining cycles (habit loops or stable rituals).

## Resonance Field
Define `R(p)` as resonance potential. For neighboring nodes `p_i`:

```
R(p) = Σ_k similarity(vector(p), vector(p_k)) * coherence(p_k)
```

Paths with higher `∇R` are preferred for routing.

## Turtle Orientation Shell
Orientation is captured by rotation `θ`, horizon span `h`, and stability `σ`. The shell projects feasible futures within `h` and dampens oscillations proportional to `σ`.

## Consciousness Web Integration
Meaning Nodes form a web `W` with edges weighted by resonance. Routing solves for paths that maximize cumulative `R` while keeping action `S` minimal, producing both the selected path and a human-readable rationale.
