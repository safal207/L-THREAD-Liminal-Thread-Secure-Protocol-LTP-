import fs from "fs";
import path from "path";
import { LTP_VERSION } from "../../sdk/js/src/frames/protocolSurface.v0.1";

interface InvalidFlow {
  name: string;
  description: string;
  frames: Array<Record<string, unknown>>;
  expected: string;
}

const OUT_DIR = path.join(__dirname, "out");
const BASE_TS = 1730000001000;
const nextTs = (() => {
  let cursor = BASE_TS;
  return () => {
    cursor += 15;
    return cursor;
  };
})();

const buildInvalidFlows = (): InvalidFlow[] => [
  {
    name: "duplicate-id",
    description: "Two frames share the same identifier within one flow.",
    frames: [
      { v: LTP_VERSION, id: "dup-001", ts: nextTs(), type: "hello", payload: { role: "client", message: "dup id" } },
      { v: LTP_VERSION, id: "dup-001", ts: nextTs(), type: "heartbeat", payload: { seq: 1 } },
      { v: LTP_VERSION, id: "ori-dup", ts: nextTs(), type: "orientation", payload: { origin: "x", destination: "y", mode: "demo" } },
    ],
    expected: "FAIL in conformance kit",
  },
  {
    name: "out-of-order",
    description: "route_request is emitted before hello completes.",
    frames: [
      { v: LTP_VERSION, id: "req-ooo", ts: nextTs(), type: "route_request", payload: { goal: "skip hello" } },
      { v: LTP_VERSION, id: "hello-ooo", ts: nextTs(), type: "hello", payload: { role: "client", message: "late hello" } },
      { v: LTP_VERSION, id: "hb-ooo", ts: nextTs(), type: "heartbeat", payload: { seq: 1 } },
    ],
    expected: "FAIL in conformance kit",
  },
  {
    name: "wrong-version",
    description: "Client speaks an unsupported protocol version.",
    frames: [
      { v: "9.9", id: "hello-wrong", ts: nextTs(), type: "hello", payload: { role: "client", message: "wrong version" } },
      { v: "9.9", id: "hb-wrong", ts: nextTs(), type: "heartbeat", payload: { seq: 1, status: "ok" } },
    ],
    expected: "FAIL in conformance kit",
  },
];

const ensureOutDir = (): void => {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
};

const writeFixtures = (flows: InvalidFlow[]): void => {
  ensureOutDir();
  flows.forEach((flow) => {
    const target = path.join(OUT_DIR, `${flow.name}.json`);
    fs.writeFileSync(target, JSON.stringify({ description: flow.description, expected: flow.expected, frames: flow.frames }, null, 2));
  });
};

const printSummary = (flows: InvalidFlow[]): void => {
  const lines: string[] = [];
  lines.push("LTP v0.1 :: Negative conformance fixtures");
  lines.push("-----------------------------------------");
  flows.forEach((flow) => {
    lines.push(`- ${flow.name}: ${flow.description} (${flow.expected})`);
  });
  lines.push("");
  lines.push(`Fixtures written to ${path.relative(process.cwd(), OUT_DIR)}`);
  lines.push("Verify with: pnpm -w ltp:conformance verify:dir examples/scenarios/out --strict");

  // eslint-disable-next-line no-console
  console.log(lines.join("\n"));
};

export const runNegativeScenarios = (): void => {
  const flows = buildInvalidFlows();
  writeFixtures(flows);
  printSummary(flows);
};

if (require.main === module) {
  runNegativeScenarios();
}
