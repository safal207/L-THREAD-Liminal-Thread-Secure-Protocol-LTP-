import assert from "assert";
import { request as httpRequest } from "http";
import { AddressInfo } from "net";
import { createDemoServer, handleExplainRoutingRequest } from "./httpDemoServer";

function performGet(port: number, path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "GET",
        headers: { Accept: "application/json" },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const bodyText = Buffer.concat(chunks).toString("utf-8");
          try {
            const parsed = JSON.parse(bodyText);
            resolve({ status: res.statusCode ?? 0, body: parsed });
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.on("error", reject);
    req.end();
  });
}

(async function testHandleExplainRoutingRequest() {
  const demoResponse = handleExplainRoutingRequest(new URLSearchParams());
  assert.ok(demoResponse.decision.length > 0, "decision summary should be present");
  assert.ok(demoResponse.graph.includes("\n"), "graph should contain multiline ASCII art");
  assert.ok(demoResponse.metrics, "metrics should be present");
  assert.ok(demoResponse.rawView?.suggestion, "raw view should include suggestion");
})();

(async function testHttpEndpoint() {
  const server = createDemoServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;

  const healthResult = await performGet(port, "/health");
  assert.strictEqual(healthResult.status, 200);
  assert.strictEqual(healthResult.body.ok, true);

  const defaultResult = await performGet(port, "/demo/explain-routing");
  assert.strictEqual(defaultResult.status, 200, "default request should succeed");
  assert.ok(typeof defaultResult.body.decision === "string" && defaultResult.body.decision.length > 0);
  assert.ok(defaultResult.body.graph.includes("\n"));
  assert.ok(defaultResult.body.rawView);

  const customResult = await performGet(
    port,
    "/demo/explain-routing?intent=explore&focusMomentum=0.3&volatility=0.7&currentSector=test/sector",
  );
  assert.strictEqual(customResult.status, 200, "customized request should succeed");
  assert.ok(customResult.body.rawView?.decision?.intent === "explore", "intent should reflect override");
  assert.ok(
    Math.abs((customResult.body.rawView?.decision?.metrics?.focusMomentum ?? 0) - 0.3) < 1e-6,
    "focusMomentum should reflect override",
  );

  const conformanceResult = await performGet(port, "/conformance/self-test?mode=storm");
  assert.strictEqual(conformanceResult.status, 200, "self-test should succeed for storm mode");
  assert.strictEqual(conformanceResult.body.mode, "storm");
  assert.ok(typeof conformanceResult.body.determinismHash === "string");

  server.close();
})();

console.log("httpDemoServer tests passed");
