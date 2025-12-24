import { InfraState, InfraEvents, InfraEvent, ProposedInfraTransition } from './types';

/**
 * The Observer is responsible for mapping Events to Proposed Transitions.
 * It does not execute the transition (in a real system, the Admissibility Layer would approve it).
 * For this reference, it calculates the Next State based on deterministic rules.
 */
export class InfraObserver {
  private currentState: InfraState = InfraState.HEALTHY;

  public getCurrentState(): InfraState {
    return this.currentState;
  }

  /**
   * Evaluates an event against the current state to propose a transition.
   */
  public evaluateEvent(event: InfraEvent): ProposedInfraTransition | null {
    let nextState: InfraState = this.currentState;
    let explanation = "";
    let risk: ProposedInfraTransition['risk_level'] = 'LOW';
    let pause = false;
    let confidence = 1.0;

    // State Transition Logic Table
    switch (this.currentState) {
      case InfraState.HEALTHY:
        if (event === InfraEvents.CONNECTION_BACKLOG_GROWING) {
          nextState = InfraState.DEGRADED;
          explanation = "Backlog growing beyond safe threshold.";
          risk = 'MEDIUM';
        } else if (event === InfraEvents.WS_RECONNECT_STORM) {
          nextState = InfraState.SATURATED;
          explanation = "Mass reconnection detected.";
          risk = 'HIGH';
          pause = true;
        } else if (event === InfraEvents.MEMORY_PRESSURE) {
            nextState = InfraState.UNSTABLE;
            explanation = "Memory usage critical.";
            risk = 'HIGH';
        }
        break;

      case InfraState.DEGRADED:
        if (event === InfraEvents.QUEUE_LATENCY_SPIKE) {
          nextState = InfraState.SATURATED;
          explanation = "Latency spike in degraded state indicates saturation.";
          risk = 'HIGH';
          pause = true;
        } else if (event === InfraEvents.METRICS_STABILIZED) {
          nextState = InfraState.HEALTHY;
          explanation = "Metrics returned to baseline.";
          risk = 'LOW';
        }
        break;

      case InfraState.SATURATED:
        if (event === InfraEvents.HEARTBEAT_TIMEOUT_CLUSTER) {
            nextState = InfraState.FAILED;
            explanation = "Cluster losing heartbeats under saturation.";
            risk = 'CRITICAL';
            pause = true;
        } else if (event === InfraEvents.CONNECTION_BACKLOG_GROWING) {
            // Stay saturated, maybe increase confidence/risk
            explanation = "Backlog continuing to grow.";
            risk = 'HIGH';
            pause = true;
        } else if (event === InfraEvents.METRICS_STABILIZED) {
            nextState = InfraState.RECOVERING;
            explanation = "Saturation subsiding, entering recovery.";
            risk = 'MEDIUM';
            pause = true; // Still pause during initial recovery
        }
        break;

      case InfraState.FAILED:
        if (event === InfraEvents.PARTIAL_OUTAGE) {
            // Already failed
        } else if (event === InfraEvents.METRICS_STABILIZED) {
            nextState = InfraState.RECOVERING;
            explanation = "System showing signs of life.";
            risk = 'HIGH';
        }
        break;

      case InfraState.RECOVERING:
        if (event === InfraEvents.RECOVERY_COMPLETE) {
            nextState = InfraState.HEALTHY;
            explanation = "Recovery period complete.";
            risk = 'LOW';
        } else if (event === InfraEvents.WS_RECONNECT_STORM) {
            nextState = InfraState.SATURATED;
            explanation = "Recurrence of storm during recovery.";
            risk = 'HIGH';
            pause = true;
        }
        break;

      default:
        break;
    }

    if (nextState !== this.currentState) {
      return {
        from: this.currentState,
        to: nextState,
        confidence,
        risk_level: risk,
        recommended_pause: pause,
        explanation,
        timestamp: new Date().toISOString(),
        trigger_event: event
      };
    }

    return null;
  }

  /**
   * Applies the transition (simulating the Admissibility Layer accepting the proposal).
   */
  public commitTransition(transition: ProposedInfraTransition) {
    this.currentState = transition.to;
  }
}
