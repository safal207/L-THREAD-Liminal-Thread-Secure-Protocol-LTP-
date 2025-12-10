import assert from "assert";
import { colorByHealth, crit, formatHealthTag, ok, warn } from "../utils/consoleColors";

a11y();

function a11y() {
  const okText = ok("green");
  const warnText = warn("yellow");
  const critText = crit("red");

  assert.ok(okText.includes("\u001b[32m"), "OK text should be green");
  assert.ok(warnText.includes("\u001b[33m"), "Warn text should be yellow");
  assert.ok(critText.includes("\u001b[31m"), "Critical text should be red");

  assert.strictEqual(colorByHealth("ok", "health"), ok("health"));
  assert.strictEqual(colorByHealth("warn", "health"), warn("health"));
  assert.strictEqual(colorByHealth("critical", "health"), crit("health"));
  assert.strictEqual(colorByHealth(undefined, "plain"), "plain");

  const healthTag = formatHealthTag("warn");
  assert.ok(healthTag.includes("[WARN]"));
}

console.log("consoleColors helpers ok");
