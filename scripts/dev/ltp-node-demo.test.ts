import assert from "assert";
import { determineLinkHealth } from "./ltp-node-demo";

const now = Date.now();

const freshHeartbeat = new Date(now - 1000).toISOString();
const warnHeartbeat = new Date(now - 12_000).toISOString();
const criticalHeartbeat = new Date(now - 40_000).toISOString();

assert.strictEqual(determineLinkHealth(freshHeartbeat, now), "ok");
assert.strictEqual(determineLinkHealth(warnHeartbeat, now), "warn");
assert.strictEqual(determineLinkHealth(criticalHeartbeat, now), "critical");
assert.strictEqual(determineLinkHealth(undefined, now), "critical");

console.log("link health classifier tests passed");
