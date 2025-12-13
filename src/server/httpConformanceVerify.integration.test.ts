import http from "http";
import type { AddressInfo } from "net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDemoServer } from "./httpDemoServer";

const hello = { v: "0.1", id: "hello-1", ts: 1, type: "hello" as const, payload: { role: "client", message: "hi" } };
const heartbeat = { v: "0.1", id: "hb-1", ts: 2, type: "heartbeat" as const, payload: { seq: 1 } };
const orientation = {
  v: "0.1",
  id: "ori-1",
  ts: 3,
  type: "orientation" as const,
  payload: { origin: "a", destination: "b", mode: "demo" },
};
const routeRequest = {
  v: "0.1",
  id: "rr-1",
  ts: 4,
  type: "route_request" as const,
  payload: { goal: "demo", context: ["foo"] },
};
const routeResponse = {
  v: "0.1",
  id: "resp-1",
  ts: 5,
  type: "route_response" as const,
  payload: {
    branches: {
      primary: { path: ["a", "b"], confidence: 0.8 },
      recover: { path: ["b", "c"], confidence: 0.5 },
      explore: { path: ["c", "d"], confidence: 0.4 },
    },
    selection: "primary" as const,
  },
};

const warningFrame = { v: "0.1", id: "warn-1", ts: 6, type: "future_type", payload: {} };

let baseUrl: string;
let server: ReturnType<typeof createDemoServer>;

const postJson = (path: string, body: unknown) =>
  new Promise<{ status: number; body: any }>((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      `${baseUrl}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res
          .on("data", (chunk) => chunks.push(chunk))
          .on("end", () => {
            const text = Buffer.concat(chunks).toString("utf-8");
            resolve({ status: res.statusCode ?? 0, body: text ? JSON.parse(text) : {} });
          });
      },
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });

beforeAll(async () => {
  server = createDemoServer();
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("/conformance/verify endpoint", () => {
  it("returns deterministic, valid response for a nominal flow", async () => {
    const payload = { frames: [hello, heartbeat, orientation, routeRequest, routeResponse] };
    const first = await postJson("/conformance/verify", payload);
    const second = await postJson("/conformance/verify", payload);

    expect(first.status).toBe(200);
    expect(first.body.ok).toBe(true);
    expect(Array.isArray(first.body.annotations)).toBe(true);
    expect(first.body.score).toBeGreaterThan(0.5);
    expect(first.body.annotations).toEqual(second.body.annotations);
  });

  it("returns warnings for unknown frame types but stays successful", async () => {
    const payload = { frames: [hello, heartbeat, orientation, warningFrame] };
    const response = await postJson("/conformance/verify", payload);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.warnings.some((msg: string) => msg.includes("unknown type"))).toBe(true);
  });

  it("rejects invalid payloads with 400", async () => {
    const response = await postJson("/conformance/verify", { frames: "not-an-array" });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(Array.isArray(response.body.errors)).toBe(true);
  });
});
