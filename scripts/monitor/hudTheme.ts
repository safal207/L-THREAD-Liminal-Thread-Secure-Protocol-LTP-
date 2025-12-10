export type HudMode = "calm" | "storm" | "shift";

const SPARK_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

function isColorDisabled(): boolean {
  return Boolean(process.env.NO_COLOR);
}

export function colorizeMode(mode: HudMode, text: string): string {
  if (isColorDisabled()) return text;

  switch (mode) {
    case "storm":
      return `\u001B[31m${text}\u001B[39m`;
    case "shift":
      return `\u001B[33m${text}\u001B[39m`;
    case "calm":
    default:
      return `\u001B[32m${text}\u001B[39m`;
  }
}

export function renderSparkline(values: number[]): string {
  if (!values.length) return "";

  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (!finiteValues.length) return "";

  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const range = max - min || 1;

  return finiteValues
    .map((value) => {
      const normalized = (value - min) / range;
      const index = Math.min(
        SPARK_CHARS.length - 1,
        Math.max(0, Math.floor(normalized * SPARK_CHARS.length)),
      );
      return SPARK_CHARS[index];
    })
    .join("");
}
