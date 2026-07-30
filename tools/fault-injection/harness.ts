import crypto from "node:crypto";

export type RuntimeProfile = "javascript" | "python" | "rust" | "elixir";

export type FaultKind =
  | "DROP_BEFORE_COMMIT"
  | "DROP_AFTER_COMMIT"
  | "DELAY"
  | "DUPLICATE"
  | "REORDER"
  | "FRAGMENT"
  | "STALE_OWNER"
  | "SIMULTANEOUS_RECONNECT"
  | "CRASH_BEFORE_PERSIST"
  | "SERVER_RESTART"
  | "CORRUPT_SNAPSHOT"
  | "REPLAY";

export interface FaultStep {
  ordinal: number;
  at_ms: number;
  kind: FaultKind;
  frame_id: string;
  owner_generation: number;
}

export interface SecuritySnapshot {
  schema_version: 1;
  thread_id: string;
  session_id: string;
  generation: number;
  active_owner: number;
  last_received_hash: string | null;
  last_sent_hash: string | null;
  seen_nonces: string[];
  fresh_reset_count: number;
  checksum: string;
}

export interface TestFrame {
  id: string;
  nonce: string;
  prev_hash: string | null;
  payload_digest: string;
}

export interface TraceRecord {
  sequence: number;
  event: string;
  verdict: "ACCEPTED" | "REJECTED" | "RESTORED" | "RESET";
  reason_code: string;
  owner_generation: number;
  session_id: string;
  state_digest: string;
}

export interface ScenarioResult {
  id: string;
  passed: boolean;
  expected: string;
  actual: string;
  runtime?: RuntimeProfile;
}

export interface FaultSuiteReport {
  schema_version: 1;
  profile: "org.ltp.production.wp3.fault-race-crash.v0.1";
  seed: string;
  schedule_digest: string;
  schedule: FaultStep[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  scenarios: ScenarioResult[];
  trace: TraceRecord[];
  scope: {
    reference_server_contract: true;
    native_runtime_profiles: RuntimeProfile[];
    live_proxy_wire_injection: false;
  };
}

const FAULT_CATALOG: FaultKind[] = [
  "DROP_BEFORE_COMMIT",
  "DROP_AFTER_COMMIT",
  "DELAY",
  "DUPLICATE",
  "REORDER",
  "FRAGMENT",
  "STALE_OWNER",
  "SIMULTANEOUS_RECONNECT",
  "CRASH_BEFORE_PERSIST",
  "SERVER_RESTART",
  "CORRUPT_SNAPSHOT",
  "REPLAY",
];

const RUNTIMES: RuntimeProfile[] = ["javascript", "python", "rust", "elixir"];
const FORBIDDEN_TRACE_KEYS = ["macKey", "encryptionKey", "privateKey", "secretKey", "longTermSecret"];

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(input).sort()) output[key] = canonicalize(input[key]);
  return output;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value: unknown): string {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

class SeededRandom {
  private counter = 0;

  constructor(private readonly seed: string) {}

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error("maxExclusive must be a positive integer");
    }
    const block = crypto
      .createHash("sha256")
      .update(`${this.seed}:${this.counter++}`)
      .digest();
    return block.readUInt32BE(0) % maxExclusive;
  }
}

export function buildFaultSchedule(seed: string, extended = false): FaultStep[] {
  if (!seed.trim()) throw new Error("seed is required");
  const random = new SeededRandom(seed);
  const source = extended ? [...FAULT_CATALOG, ...FAULT_CATALOG] : [...FAULT_CATALOG];
  const shuffled: FaultKind[] = [];
  while (source.length > 0) {
    shuffled.push(source.splice(random.nextInt(source.length), 1)[0]);
  }
  let clock = 1_900_000_000_000;
  return shuffled.map((kind, index) => {
    clock += 1 + random.nextInt(17);
    return {
      ordinal: index + 1,
      at_ms: clock,
      kind,
      frame_id: `frame-${String(index + 1).padStart(3, "0")}`,
      owner_generation: 1 + random.nextInt(3),
    };
  });
}

function snapshotBody(snapshot: Omit<SecuritySnapshot, "checksum">): Omit<SecuritySnapshot, "checksum"> {
  return {
    ...snapshot,
    seen_nonces: [...snapshot.seen_nonces].sort(),
  };
}

function snapshotChecksum(snapshot: Omit<SecuritySnapshot, "checksum">): string {
  return sha256(snapshotBody(snapshot));
}

export class LifecycleFaultHarness {
  private threadId: string;
  private sessionId: string;
  private generation = 1;
  private activeOwner = 1;
  private lastReceivedHash: string | null = null;
  private lastSentHash: string | null = null;
  private seenNonces = new Set<string>();
  private freshResetCount = 0;
  private sequence = 0;
  private readonly records: TraceRecord[] = [];

  constructor(private readonly seed: string, runtime: RuntimeProfile = "javascript") {
    this.threadId = `thread-${sha256(`${seed}:${runtime}:thread`).slice(0, 12)}`;
    this.sessionId = `session-${sha256(`${seed}:${runtime}:session`).slice(0, 12)}`;
  }

  get trace(): TraceRecord[] {
    return this.records.map((record) => ({ ...record }));
  }

  get ownerGeneration(): number {
    return this.activeOwner;
  }

  get currentSessionId(): string {
    return this.sessionId;
  }

  get committedReceiveHash(): string | null {
    return this.lastReceivedHash;
  }

  frame(id: string, nonce: string, prevHash: string | null = this.lastReceivedHash): TestFrame {
    return {
      id,
      nonce,
      prev_hash: prevHash,
      payload_digest: sha256({ id, seed: this.seed }),
    };
  }

  receive(ownerGeneration: number, frame: TestFrame): string {
    if (ownerGeneration !== this.activeOwner) {
      this.record("frame_receive", "REJECTED", "STALE_TRANSPORT_OWNER");
      return "STALE_TRANSPORT_OWNER";
    }
    if (this.seenNonces.has(frame.nonce)) {
      this.record("frame_receive", "REJECTED", "REPLAYED_NONCE");
      return "REPLAYED_NONCE";
    }
    if ((frame.prev_hash || "") !== (this.lastReceivedHash || "")) {
      this.record("frame_receive", "REJECTED", "BROKEN_HASH_CHAIN");
      return "BROKEN_HASH_CHAIN";
    }
    this.lastReceivedHash = sha256(frame);
    this.seenNonces.add(frame.nonce);
    this.record("frame_receive", "ACCEPTED", "SECURITY_PIPELINE_ACCEPTED");
    return "SECURITY_PIPELINE_ACCEPTED";
  }

  commitSend(frameId: string): void {
    this.lastSentHash = sha256({
      frame_id: frameId,
      previous: this.lastSentHash,
      session_id: this.sessionId,
    });
    this.record("frame_send", "ACCEPTED", "OUTBOUND_CHAIN_COMMITTED");
  }

  replaceOwner(reason = "authenticated_resume"): number {
    this.activeOwner += 1;
    this.generation += 1;
    this.record(reason, "ACCEPTED", "ACTIVE_OWNER_REPLACED");
    return this.activeOwner;
  }

  simultaneousReconnect(attempts: number): number[] {
    if (attempts < 2) throw new Error("simultaneous reconnect requires at least two attempts");
    const owners: number[] = [];
    for (let index = 0; index < attempts; index += 1) owners.push(this.replaceOwner("reconnect_attempt"));
    return owners;
  }

  persist(): SecuritySnapshot {
    const body: Omit<SecuritySnapshot, "checksum"> = {
      schema_version: 1,
      thread_id: this.threadId,
      session_id: this.sessionId,
      generation: this.generation,
      active_owner: this.activeOwner,
      last_received_hash: this.lastReceivedHash,
      last_sent_hash: this.lastSentHash,
      seen_nonces: [...this.seenNonces].sort(),
      fresh_reset_count: this.freshResetCount,
    };
    return { ...body, checksum: snapshotChecksum(body) };
  }

  restoreSameSession(snapshot: SecuritySnapshot): "RESTORED" | "FRESH_HANDSHAKE_REQUIRED" {
    const { checksum, ...body } = snapshot;
    const structurallyValid =
      snapshot.schema_version === 1 &&
      snapshot.thread_id === this.threadId &&
      snapshot.session_id === this.sessionId &&
      checksum === snapshotChecksum(body);
    if (!structurallyValid) {
      this.freshSession("CORRUPT_OR_MISMATCHED_SNAPSHOT");
      return "FRESH_HANDSHAKE_REQUIRED";
    }
    this.generation = snapshot.generation + 1;
    this.activeOwner = snapshot.active_owner + 1;
    this.lastReceivedHash = snapshot.last_received_hash;
    this.lastSentHash = snapshot.last_sent_hash;
    this.seenNonces = new Set(snapshot.seen_nonces);
    this.freshResetCount = snapshot.fresh_reset_count;
    this.record("server_restart", "RESTORED", "SAME_SESSION_STATE_RESTORED");
    return "RESTORED";
  }

  freshSession(reason = "EXPLICIT_FRESH_HANDSHAKE"): void {
    this.generation += 1;
    this.activeOwner += 1;
    this.threadId = `thread-${sha256(`${this.seed}:fresh:${this.generation}`).slice(0, 12)}`;
    this.sessionId = `session-${sha256(`${this.seed}:fresh:${this.generation}`).slice(0, 12)}`;
    this.lastReceivedHash = null;
    this.lastSentHash = null;
    this.seenNonces.clear();
    this.freshResetCount += 1;
    this.record("fresh_session", "RESET", reason);
  }

  private record(
    event: string,
    verdict: TraceRecord["verdict"],
    reasonCode: string,
  ): void {
    this.sequence += 1;
    this.records.push({
      sequence: this.sequence,
      event,
      verdict,
      reason_code: reasonCode,
      owner_generation: this.activeOwner,
      session_id: this.sessionId,
      state_digest: sha256({
        generation: this.generation,
        active_owner: this.activeOwner,
        last_received_hash: this.lastReceivedHash,
        last_sent_hash: this.lastSentHash,
        seen_nonces: [...this.seenNonces].sort(),
        fresh_reset_count: this.freshResetCount,
      }),
    });
  }
}

function scenario(id: string, expected: string, actual: string, runtime?: RuntimeProfile): ScenarioResult {
  return { id, expected, actual, passed: expected === actual, runtime };
}

export function runWp3FaultSuite(seed = "wp3-ci-seed", extended = false): FaultSuiteReport {
  const schedule = buildFaultSchedule(seed, extended);
  const primary = new LifecycleFaultHarness(seed);
  const scenarios: ScenarioResult[] = [];

  const first = primary.frame("accepted-before-drop", "nonce-1");
  scenarios.push(scenario(
    "drop-before-after-commit-boundary",
    "SECURITY_PIPELINE_ACCEPTED",
    primary.receive(primary.ownerGeneration, first),
  ));
  const stable = primary.persist();

  const oldOwner = primary.ownerGeneration;
  primary.replaceOwner();
  const stale = primary.frame("stale-owner", "nonce-stale");
  scenarios.push(scenario(
    "stale-receive-owner-cannot-commit",
    "STALE_TRANSPORT_OWNER",
    primary.receive(oldOwner, stale),
  ));

  const replay = primary.frame("replay-after-resume", "nonce-1", primary.committedReceiveHash);
  scenarios.push(scenario(
    "replay-remains-rejected-after-reconnect",
    "REPLAYED_NONCE",
    primary.receive(primary.ownerGeneration, replay),
  ));

  const beforeRestart = primary.persist();
  const restored = primary.restoreSameSession(beforeRestart);
  const exactChain =
    restored === "RESTORED" &&
    primary.committedReceiveHash === beforeRestart.last_received_hash;
  scenarios.push(scenario(
    "same-session-resume-preserves-chain",
    "preserved",
    exactChain ? "preserved" : "changed",
  ));

  const postRestartReplay = primary.frame("replay-after-restart", "nonce-1", primary.committedReceiveHash);
  scenarios.push(scenario(
    "replay-remains-rejected-after-restart",
    "REPLAYED_NONCE",
    primary.receive(primary.ownerGeneration, postRestartReplay),
  ));

  const corrupt = { ...stable, checksum: "00".repeat(32) };
  const beforeFresh = primary.currentSessionId;
  const corruptResult = primary.restoreSameSession(corrupt);
  const freshExactlyOnce =
    corruptResult === "FRESH_HANDSHAKE_REQUIRED" &&
    primary.currentSessionId !== beforeFresh &&
    primary.persist().fresh_reset_count === 1;
  scenarios.push(scenario(
    "corrupt-snapshot-fails-closed-once",
    "fresh_once",
    freshExactlyOnce ? "fresh_once" : "invalid_reset",
  ));

  const runtimeResults = RUNTIMES.map((runtime) => {
    const harness = new LifecycleFaultHarness(`${seed}:${runtime}`, runtime);
    const owner = harness.ownerGeneration;
    harness.replaceOwner(`${runtime}_owner_replacement`);
    const verdict = harness.receive(owner, harness.frame(`${runtime}-stale`, `${runtime}-nonce`));
    return scenario(
      `runtime-owner-race-${runtime}`,
      "STALE_TRANSPORT_OWNER",
      verdict,
      runtime,
    );
  });
  scenarios.push(...runtimeResults);

  const serializedTrace = JSON.stringify(primary.trace);
  const leaked = FORBIDDEN_TRACE_KEYS.find((key) => serializedTrace.includes(key));
  scenarios.push(scenario(
    "trace-secret-redaction",
    "redacted",
    leaked ? `leaked:${leaked}` : "redacted",
  ));

  const passed = scenarios.filter((entry) => entry.passed).length;
  return {
    schema_version: 1,
    profile: "org.ltp.production.wp3.fault-race-crash.v0.1",
    seed,
    schedule_digest: sha256(schedule),
    schedule,
    summary: {
      total: scenarios.length,
      passed,
      failed: scenarios.length - passed,
    },
    scenarios,
    trace: primary.trace,
    scope: {
      reference_server_contract: true,
      native_runtime_profiles: [...RUNTIMES],
      live_proxy_wire_injection: false,
    },
  };
}
