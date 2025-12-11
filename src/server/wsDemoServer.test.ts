import assert from "assert";
import WebSocket from "ws";
import { AddressInfo } from "net";
import { createOrientationDemoWSServer, handleOrientationDemoMessage } from "./wsDemoServer";

(async function testHandleOrientationDemoMessage() {
  const pong = await handleOrientationDemoMessage({ type: "ping", tick: 1 });
  assert.strictEqual(pong.type, "pong");
  assert.strictEqual(pong.tick, 1);

  const demo = await handleOrientationDemoMessage({ type: "explain_demo", tick: 2 });
  assert.strictEqual(demo.type, "explain_result");
  assert.ok(demo.graph?.includes("\n"), "graph should contain ascii art");
  assert.ok(demo.decision && demo.decision.length > 0, "decision summary should be present");

  const custom = await handleOrientationDemoMessage({
    type: "explain_custom",
    focusMomentum: 0.31,
    volatility: 0.62,
    intent: "explore",
    tick: 3,
  });
  assert.strictEqual(custom.type, "explain_result");
  assert.strictEqual(custom.tick, 3);
  assert.ok(custom.rawView?.decision.intent === "explore");
  assert.ok(Math.abs((custom.rawView?.decision.metrics.focusMomentum ?? 0) - 0.31) < 1e-6);
})();

async function receiveJson(socket: WebSocket): Promise<any> {
  return new Promise((resolve, reject) => {
    socket.once("message", (data) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch (error) {
        reject(error);
      }
    });
    socket.once("error", reject);
  });
}

(async function testWebSocketServer() {
  const server = createOrientationDemoWSServer({ port: 0 });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  const url = `ws://127.0.0.1:${address.port}/ws/orientation-demo`;

  const client = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    client.once("open", resolve);
    client.once("error", reject);
  });

  // drain welcome message
  await receiveJson(client);

  client.send(JSON.stringify({ type: "explain_demo" }));
  const response = await receiveJson(client);

  assert.strictEqual(response.type, "explain_result");
  assert.ok(typeof response.decision === "string" && response.decision.length > 0);
  assert.ok(response.graph.includes("\n"));
  assert.ok(response.rawView);

  client.close();
  server.close();
})();

console.log("wsDemoServer tests passed");
