import WebSocket from "ws";
import { describe, expect, it } from "vitest";
import { REFERENCE_SUBPROTOCOL } from "../reference-server/protocol";
import { startReferenceServer } from "../reference-server/server";
import { startFaultProxy } from "./proxy";

async function open(url: string): Promise<WebSocket> {
  const socket = new WebSocket(url, REFERENCE_SUBPROTOCOL);
  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return socket;
}

function nextMessage(socket: WebSocket, timeoutMs = 5_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("message timeout")), timeoutMs);
    socket.once("message", (data) => {
      clearTimeout(timeout);
      resolve(data.toString());
    });
  });
}

async function waitFor(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("condition timeout");
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function closeSocket(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED) return;
  await new Promise<void>((resolve) => {
    socket.once("close", () => resolve());
    socket.close();
    setTimeout(() => {
      if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
      resolve();
    }, 250).unref();
  });
}

describe("seeded WebSocket fault proxy", () => {
  it("fragments a live frame while preserving reference-server semantics", async () => {
    const server = await startReferenceServer({ seed: "wp3-fragment" });
    const proxy = await startFaultProxy({
      upstreamUrl: server.url,
      faultSequence: ["FRAGMENT"],
    });
    const socket = await open(proxy.urlFor("fragment-client"));

    try {
      const responsePromise = nextMessage(socket);
      socket.send("not-json");
      const response = JSON.parse(await responsePromise);
      expect(response.type).toBe("handshake_reject");
      expect(response.reason).toBe("invalid_json");
      expect(proxy.getEvidence()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          fault: "FRAGMENT",
          verdict: "FORWARDED",
        }),
      ]));
      expect(server.getEvidence()).toEqual(expect.arrayContaining([
        expect.objectContaining({ reason_code: "INVALID_JSON" }),
      ]));
    } finally {
      await closeSocket(socket);
      await proxy.close();
      await server.close();
    }
  });

  it("rejects an old connection after deterministic owner replacement", async () => {
    const server = await startReferenceServer({ seed: "wp3-owner" });
    const proxy = await startFaultProxy({
      upstreamUrl: server.url,
      faultSequence: [],
    });
    const oldSocket = await open(proxy.urlFor("same-client"));
    const replacement = await open(proxy.urlFor("same-client"));

    try {
      const staleResponse = nextMessage(oldSocket);
      oldSocket.send("not-json");
      expect(JSON.parse(await staleResponse)).toEqual(expect.objectContaining({
        type: "proxy_reject",
        reason: "STALE_TRANSPORT_OWNER",
      }));

      const activeResponse = nextMessage(replacement);
      replacement.send("not-json");
      expect(JSON.parse(await activeResponse)).toEqual(expect.objectContaining({
        type: "handshake_reject",
        reason: "invalid_json",
      }));

      const staleEvidence = proxy.getEvidence().find(
        (record) => record.reason_code === "STALE_TRANSPORT_OWNER",
      );
      expect(staleEvidence?.verdict).toBe("REJECTED");
      expect(staleEvidence?.owner_generation).toBe(1);
    } finally {
      await closeSocket(oldSocket);
      await closeSocket(replacement);
      await proxy.close();
      await server.close();
    }
  });

  it("keeps proxy evidence free of payloads and secrets", async () => {
    const server = await startReferenceServer({ seed: "wp3-redaction" });
    const proxy = await startFaultProxy({
      upstreamUrl: server.url,
      faultSequence: ["DROP_BEFORE_COMMIT"],
    });
    const socket = await open(proxy.urlFor("redaction-client"));

    try {
      socket.send(JSON.stringify({
        type: "test",
        secretKey: "must-not-appear",
        privateKey: "must-not-appear",
      }));
      await waitFor(() => proxy.getEvidence().some(
        (record) => record.reason_code === "DROP_BEFORE_COMMIT",
      ));
      const raw = JSON.stringify(proxy.getEvidence());
      expect(raw).not.toContain("must-not-appear");
      expect(raw).not.toContain("secretKey");
      expect(raw).not.toContain("privateKey");
    } finally {
      await closeSocket(socket);
      await proxy.close();
      await server.close();
    }
  });
});
