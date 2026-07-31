import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import WebSocket from "ws";
import { sha256 } from "../reference-server/protocol";
import { startReferenceServer } from "../reference-server/server";

interface PersistedSession {
  clientId: string;
  protocolVersion: string;
  threadId: string;
  sessionId: string;
  generation: number;
  lastReceivedHash: string | null;
  lastSentHash: string | null;
  seenNonces: string[];
}

interface SnapshotBody {
  schema_version: 1;
  profile: "org.ltp.production.wp3.reference-server-snapshot.v1";
  seed: string;
  sessions: PersistedSession[];
}

interface SnapshotFile extends SnapshotBody {
  checksum: string;
}

type RestoreStatus = "EMPTY" | "RESTORED" | "RESET";

const seed = process.env.LTP_SERVER_SEED || "wp3-exit";
const secret = process.env.LTP_REFERENCE_SECRET || "ltp-reference-long-term-secret";
const snapshotPath = process.env.LTP_SERVER_SNAPSHOT;

function canonicalBody(body: SnapshotBody): string {
  return JSON.stringify({
    ...body,
    sessions: [...body.sessions]
      .map((session) => ({
        ...session,
        seenNonces: [...session.seenNonces].sort(),
      }))
      .sort((left, right) => left.threadId.localeCompare(right.threadId)),
  });
}

function checksum(body: SnapshotBody): string {
  return sha256(canonicalBody(body));
}

function snapshotFromServer(server: any): SnapshotFile {
  const sessions: PersistedSession[] = [...server.sessions.values()].map((state: any) => ({
    clientId: state.clientId,
    protocolVersion: state.protocolVersion,
    threadId: state.threadId,
    sessionId: state.sessionId,
    generation: state.generation,
    lastReceivedHash: state.lastReceivedHash,
    lastSentHash: state.lastSentHash,
    seenNonces: [...state.seenNonces].sort(),
  }));
  const body: SnapshotBody = {
    schema_version: 1,
    profile: "org.ltp.production.wp3.reference-server-snapshot.v1",
    seed,
    sessions,
  };
  return { ...body, checksum: checksum(body) };
}

function restoreIntoServer(server: any, filePath: string | undefined): RestoreStatus {
  if (!filePath || !existsSync(filePath)) return "EMPTY";
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as SnapshotFile;
    const body: SnapshotBody = {
      schema_version: parsed.schema_version,
      profile: parsed.profile,
      seed: parsed.seed,
      sessions: parsed.sessions,
    };
    if (
      body.schema_version !== 1 ||
      body.profile !== "org.ltp.production.wp3.reference-server-snapshot.v1" ||
      body.seed !== seed ||
      parsed.checksum !== checksum(body)
    ) {
      throw new Error("snapshot identity or checksum mismatch");
    }

    let maxId = 0;
    for (const persisted of body.sessions) {
      for (const id of [persisted.threadId, persisted.sessionId]) {
        const match = id.match(/-(\d+)$/);
        if (match) maxId = Math.max(maxId, Number(match[1]));
      }
      server.sessions.set(persisted.threadId, {
        clientId: persisted.clientId,
        protocolVersion: persisted.protocolVersion,
        threadId: persisted.threadId,
        sessionId: persisted.sessionId,
        generation: persisted.generation,
        lastReceivedHash: persisted.lastReceivedHash,
        lastSentHash: persisted.lastSentHash,
        seenNonces: new Set(persisted.seenNonces),
        encryptionKey: "",
        macKey: "",
        ivKey: "",
        routingTag: "",
        activeSocket: { readyState: WebSocket.CLOSED },
      });
    }
    server.idCounter = Math.max(server.idCounter || 0, maxId);
    return "RESTORED";
  } catch (error) {
    server.sessions.clear();
    server.routes.clear();
    process.stderr.write(
      `[wp3-reference-process] persisted state reset: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return "RESET";
  }
}

async function main(): Promise<void> {
  const handle = await startReferenceServer({
    port: 0,
    seed,
    longTermSecret: secret,
    supportedProtocolVersions: ["0.3", "0.6"],
  });
  const internal = handle as any;
  const restoreStatus = restoreIntoServer(internal, snapshotPath);

  process.send?.({
    type: "ready",
    process_id: process.pid,
    url: handle.url,
    restore_status: restoreStatus,
    restored_sessions: internal.sessions.size,
  });

  process.on("message", (message: any) => {
    if (!message || typeof message.type !== "string") return;
    if (message.type === "snapshot") {
      const target = String(message.path || snapshotPath || "artifacts/wp3-server-snapshot.json");
      const snapshot = snapshotFromServer(internal);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
      process.send?.({
        type: "snapshot_written",
        path: target,
        checksum: snapshot.checksum,
        session_count: snapshot.sessions.length,
      });
      return;
    }
    if (message.type === "evidence") {
      process.send?.({
        type: "evidence",
        evidence: handle.getEvidence(),
      });
      return;
    }
    if (message.type === "session") {
      process.send?.({
        type: "session",
        snapshot: handle.getSessionSnapshot(String(message.thread_id)),
      });
      return;
    }
    if (message.type === "shutdown") {
      void handle.close().finally(() => process.exit(0));
    }
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
