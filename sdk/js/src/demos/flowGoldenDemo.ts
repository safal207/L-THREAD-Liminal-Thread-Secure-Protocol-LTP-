import { LTPFrame } from "../frames/frameSchema";

const baseTs = 1700000000000;

export const buildFlowGoldenFrames = (): LTPFrame[] => [
  {
    v: "0.1",
    id: "flow-0001-001",
    ts: baseTs,
    type: "hello",
    payload: { role: "client", message: "flow handshake init" },
  },
  {
    v: "0.1",
    id: "flow-0001-002",
    ts: baseTs + 1000,
    type: "hello",
    payload: { role: "server", message: "flow handshake ack" },
  },
  {
    v: "0.1",
    id: "flow-0001-003",
    ts: baseTs + 2000,
    type: "heartbeat",
    payload: { seq: 1, status: "alive" },
  },
  {
    v: "0.1",
    id: "flow-0001-004",
    ts: baseTs + 3000,
    type: "heartbeat",
    payload: { seq: 2, status: "alive" },
  },
  {
    v: "0.1",
    id: "flow-0001-005",
    ts: baseTs + 4000,
    type: "heartbeat",
    payload: { seq: 3, status: "alive" },
  },
  {
    v: "0.1",
    id: "flow-0001-006",
    ts: baseTs + 5000,
    type: "orientation",
    payload: { origin: "node.alpha", destination: "node.omega", mode: "flow-v0.1" },
  },
  {
    v: "0.1",
    id: "flow-0001-007",
    ts: baseTs + 6000,
    type: "route_request",
    payload: {
      goal: "stabilize-flow",
      context: ["hello", "heartbeat", "orientation"],
    },
  },
  {
    v: "0.1",
    id: "flow-0001-008",
    ts: baseTs + 7000,
    type: "route_response",
    payload: {
      branches: {
        primary: {
          path: ["stabilize", "deliver"],
          confidence: 0.62,
          rationale: "primary route",
        },
        recover: {
          path: ["retry", "stabilize"],
          confidence: 0.26,
          rationale: "fallback route",
        },
        explore: {
          path: ["diverge", "observe"],
          confidence: 0.12,
          rationale: "exploratory route",
        },
      },
      selection: "primary",
    },
  },
  {
    v: "0.1",
    id: "flow-0001-009",
    ts: baseTs + 8000,
    type: "focus_snapshot",
    payload: {
      focus: "primary",
      signal: 0.62,
      rationale: "selected primary branch",
    },
  },
];

export const framesToJsonl = (frames: LTPFrame[]): string =>
  frames.map((frame) => JSON.stringify(frame)).join("\n");

export const emitFlowGoldenTranscript = (): void => {
  const output = framesToJsonl(buildFlowGoldenFrames());
  // eslint-disable-next-line no-console
  console.log(output);
};

if (require.main === module) {
  emitFlowGoldenTranscript();
}
