import assert from "assert";
import WebSocket from "ws";
import { AddressInfo } from "net";
import { createConformanceWSServer, handleConformanceSelfTestMessage } from "./wsConformanceServer";

(async function testHandler() {
  const result = handleConformanceSelfTestMessage({ type: "conformance_self_test", payload: { mode: "storm" } });
  assert.strictEqual(result.type, "conformance_report");
  if (result.type === "conformance_report") {
    assert.strictEqual(result.payload.mode, "storm");
    assert.ok(typeof result.payload.determinismHash === "string");
  }
})();

async function receiveFrame(socket: WebSocket): Promise<any> {
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

(async function testServer() {
  const server = createConformanceWSServer({ port: 0 });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  const url = `ws://127.0.0.1:${address.port}/ws/conformance-self-test`;

  const client = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    client.once("open", resolve);
    client.once("error", reject);
  });

  client.send(
    JSON.stringify({ type: "conformance_self_test", v: "0.1", id: "req-1", payload: { mode: "recovery" } }),
  );
  const response = await receiveFrame(client);

  assert.strictEqual(response.type, "conformance_report");
  assert.strictEqual(response.v, "0.1");
  assert.strictEqual(response.id, "req-1");
  assert.strictEqual(response.payload.mode, "recovery");
  assert.ok(typeof response.payload.determinismHash === "string");

  client.close();
  server.close();
})();

console.log("wsConformanceServer tests passed");
