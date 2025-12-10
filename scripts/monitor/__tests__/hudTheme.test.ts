import assert from "node:assert/strict";
import { colorizeMode, renderSparkline } from "../hudTheme";

function withoutColor(fn: () => void) {
  const prev = process.env.NO_COLOR;
  process.env.NO_COLOR = "1";
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = prev;
  }
}

function testColorizeMode() {
  withoutColor(() => {
    const text = colorizeMode("calm", "mode=CALM");
    assert.equal(text, "mode=CALM");
  });

  const storm = colorizeMode("storm", "mode=STORM");
  assert.ok(storm.includes("mode=STORM"));
}

function testRenderSparkline() {
  const spark = renderSparkline([0, 1, 2, 3]);
  assert.equal(spark.length, 4, "sparkline should match input length");
  const empty = renderSparkline([]);
  assert.equal(empty, "");
}

try {
  testColorizeMode();
  testRenderSparkline();
  console.log("hudTheme tests passed");
} catch (err) {
  console.error("hudTheme tests failed", err);
  process.exitCode = 1;
}
