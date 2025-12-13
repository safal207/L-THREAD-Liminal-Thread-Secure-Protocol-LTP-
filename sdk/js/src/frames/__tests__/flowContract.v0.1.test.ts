declare function require(name: string): any;
declare const __dirname: string;

const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
import { buildFlowGoldenFrames } from "../../demos/flowGoldenDemo";
import {
  LTPFrame,
  RouteBranch,
  RouteBranchMap,
  validateFrameOrThrow,
} from "../frameSchema";

function isBranchMap(
  branches: RouteBranch[] | RouteBranchMap
): branches is RouteBranchMap {
  return !Array.isArray(branches);
}

function getBranch(
  branches: RouteBranch[] | RouteBranchMap,
  id: string
): RouteBranch | undefined {
  if (isBranchMap(branches)) return branches[id];
  return branches.find((branch) => branch.id === id);
}

function runTest(name: string, fn: () => void): void {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`✔ ${name}`))
    .catch((error) => {
      console.error(`✖ ${name}`);
      console.error(error);
      process.exitCode = 1;
    });
}

const transcriptPath = path.resolve(
  __dirname,
  "../../../../../specs/flow/golden-transcript.v0.1.jsonl"
);

const loadGoldenFrames = (): LTPFrame[] => {
  const content = fs.readFileSync(transcriptPath, "utf8").trim();
  const frames = content
    .split(/\n+/)
    .filter((line: string) => line.length > 0)
    .map((line: string) => JSON.parse(line) as unknown);

  frames.forEach((frame: unknown) => validateFrameOrThrow(frame));
  return frames as LTPFrame[];
};

runTest("validates every frame against the Flow v0.1 contract", () => {
  assert.doesNotThrow(() => loadGoldenFrames());
});

runTest("matches the expected Flow v0.1 sequence order", () => {
  const frames = loadGoldenFrames();
  const types = frames.map((frame) => frame.type);
  const expected = [
    "hello",
    "hello",
    "heartbeat",
    "heartbeat",
    "heartbeat",
    "orientation",
    "route_request",
    "route_response",
    "focus_snapshot",
  ];

  assert.deepStrictEqual(types, expected);
});

runTest("demo builder emits the canonical golden transcript", () => {
  const frames = loadGoldenFrames();
  const built = buildFlowGoldenFrames();
  assert.deepStrictEqual(built, frames);
});

runTest("route_response branch confidences sum to 1", () => {
  const frames = loadGoldenFrames();
  const routeResponse = frames.find((frame) => frame.type === "route_response");
  assert.ok(routeResponse, "route_response frame must exist");

  const {
    payload: { branches },
  } = routeResponse as Extract<LTPFrame, { type: "route_response" }>;

  const primary = getBranch(branches, "primary");
  const recover = getBranch(branches, "recover");
  const explore = getBranch(branches, "explore");

  assert.ok(primary, "primary branch must exist");
  assert.ok(recover, "recover branch must exist");
  assert.ok(explore, "explore branch must exist");

  const sum = primary.confidence + recover.confidence + explore.confidence;
  const epsilon = 1e-6;
  assert.ok(Math.abs(sum - 1) < epsilon, `confidence sum ${sum} deviates from 1`);
});
