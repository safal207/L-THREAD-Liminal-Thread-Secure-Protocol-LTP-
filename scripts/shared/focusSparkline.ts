export const SPARK_BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

export function renderMomentumSparkline(history: number[]): string {
  if (!history.length) return "";
  const max = Math.max(...history.map((v) => Math.abs(v))) || 1;
  return history
    .map((v) => {
      const norm = Math.min(Math.abs(v) / max, 1);
      const idx = Math.min(
        SPARK_BLOCKS.length - 1,
        Math.floor(norm * (SPARK_BLOCKS.length - 1)),
      );
      return SPARK_BLOCKS[idx];
    })
    .join("");
}
