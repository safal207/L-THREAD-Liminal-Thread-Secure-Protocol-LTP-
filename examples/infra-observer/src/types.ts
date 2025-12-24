/**
 * Infrastructure State Model
 * Defines the possible states of the system from an LTP observation perspective.
 */
export enum InfraState {
  HEALTHY = "HEALTHY",
  DEGRADED = "DEGRADED",
  SATURATED = "SATURATED",
  UNSTABLE = "UNSTABLE",
  FAILED = "FAILED",
  RECOVERING = "RECOVERING"
}

/**
 * Canonical Infrastructure Events
 * Events that trigger state transitions.
 */
export const InfraEvents = {
  CONNECTION_BACKLOG_GROWING: "CONNECTION_BACKLOG_GROWING",
  WS_RECONNECT_STORM: "WS_RECONNECT_STORM",
  HEARTBEAT_TIMEOUT_CLUSTER: "HEARTBEAT_TIMEOUT_CLUSTER",
  QUEUE_LATENCY_SPIKE: "QUEUE_LATENCY_SPIKE",
  MEMORY_PRESSURE: "MEMORY_PRESSURE",
  PARTIAL_OUTAGE: "PARTIAL_OUTAGE",
  METRICS_STABILIZED: "METRICS_STABILIZED",
  RECOVERY_COMPLETE: "RECOVERY_COMPLETE"
} as const;

export type InfraEvent = keyof typeof InfraEvents;

/**
 * Represents a simplified LTP Proposed Transition for Infra
 */
export interface ProposedInfraTransition {
  from: InfraState;
  to: InfraState;
  confidence: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommended_pause: boolean;
  explanation: string;
  timestamp: string;
  trigger_event: InfraEvent;
}
