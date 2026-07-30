import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

interface RuntimeRow {
  runtime: string;
  stale_owner: string;
  replay_after_restart: string;
  fresh_reset_count: number;
}

const commands: Array<{ runtime: string; command: string; args: string[] }> = [
  {
    runtime: "javascript",
    command: "node",
    args: ["tests/fault-injection/runtime/javascript.js"],
  },
  {
    runtime: "python",
    command: "python3",
    args: ["tests/fault-injection/runtime/python.py"],
  },
  {
    runtime: "rust-build",
    command: "rustc",
    args: [
      "tests/fault-injection/runtime/rust.rs",
      "-o",
      "artifacts/wp3-runtime-rust",
    ],
  },
  {
    runtime: "rust",
    command: "artifacts/wp3-runtime-rust",
    args: [],
  },
  {
    runtime: "elixir",
    command: "elixir",
    args: ["tests/fault-injection/runtime/elixir.exs"],
  },
];

mkdirSync("artifacts", { recursive: true });
const rows: RuntimeRow[] = [];
for (const entry of commands) {
  const result = spawnSync(entry.command, entry.args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`${entry.runtime} failed: ${result.stderr || result.stdout}`);
  }
  if (entry.runtime === "rust-build") continue;
  rows.push(JSON.parse(result.stdout.trim()) as RuntimeRow);
}

const expectedRuntimes = ["elixir", "javascript", "python", "rust"];
const actualRuntimes = rows.map((row) => row.runtime).sort();
if (JSON.stringify(actualRuntimes) !== JSON.stringify(expectedRuntimes)) {
  throw new Error(`runtime matrix mismatch: ${JSON.stringify(actualRuntimes)}`);
}
for (const row of rows) {
  if (
    row.stale_owner !== "STALE_TRANSPORT_OWNER" ||
    row.replay_after_restart !== "REPLAYED_NONCE" ||
    row.fresh_reset_count !== 1
  ) {
    throw new Error(`runtime contract failed: ${JSON.stringify(row)}`);
  }
}

const report = {
  schema_version: 1,
  profile: "org.ltp.production.wp3.native-runtime-ownership.v0.1",
  summary: { total: rows.length, passed: rows.length, failed: 0 },
  rows: rows.sort((left, right) => left.runtime.localeCompare(right.runtime)),
};
const output = process.argv[2] ?? "artifacts/wp3-native-runtime-matrix.json";
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report.summary));
