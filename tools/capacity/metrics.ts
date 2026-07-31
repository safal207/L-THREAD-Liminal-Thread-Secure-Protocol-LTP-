export interface Quantiles {
  count: number;
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[Math.max(0, index)];
}

export function quantiles(values: number[], precision = 3): Quantiles {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  const round = (value: number) => Number(value.toFixed(precision));
  if (sorted.length === 0) {
    return { count: 0, min: 0, p50: 0, p95: 0, p99: 0, max: 0, mean: 0 };
  }
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return {
    count: sorted.length,
    min: round(sorted[0]),
    p50: round(percentile(sorted, 0.50)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
    max: round(sorted[sorted.length - 1]),
    mean: round(mean),
  };
}

export interface TimeSample {
  wallMs: number;
  userCpuSeconds: number;
  systemCpuSeconds: number;
  maxRssKiB: number;
}

export function parseGnuTime(stderr: string): TimeSample {
  const marker = stderr.match(/__WP4_TIME__:([0-9.]+):([0-9.]+):([0-9]+)/);
  if (!marker) {
    throw new Error(`GNU time marker missing from stderr: ${stderr.slice(-500)}`);
  }
  return {
    wallMs: 0,
    userCpuSeconds: Number(marker[1]),
    systemCpuSeconds: Number(marker[2]),
    maxRssKiB: Number(marker[3]),
  };
}

export function renderLineSvg(
  title: string,
  values: number[],
  unit: string,
  width = 960,
  height = 320,
): string {
  const safe = values.length > 0 ? values : [0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = max - min || 1;
  const left = 64;
  const right = width - 24;
  const top = 48;
  const bottom = height - 48;
  const points = safe.map((value, index) => {
    const x = safe.length === 1
      ? (left + right) / 2
      : left + (index / (safe.length - 1)) * (right - left);
    const y = bottom - ((value - min) / range) * (bottom - top);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const escape = (value: string) => value.replace(/[&<>]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
  }[character]!));
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="white"/>`,
    `<text x="${left}" y="28" font-family="sans-serif" font-size="18">${escape(title)}</text>`,
    `<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="black"/>`,
    `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="black"/>`,
    `<polyline fill="none" stroke="black" stroke-width="2" points="${points}"/>`,
    `<text x="8" y="${top + 6}" font-family="monospace" font-size="12">${max.toFixed(2)} ${escape(unit)}</text>`,
    `<text x="8" y="${bottom}" font-family="monospace" font-size="12">${min.toFixed(2)} ${escape(unit)}</text>`,
    `<text x="${right - 130}" y="${height - 12}" font-family="monospace" font-size="12">samples=${safe.length}</text>`,
    `</svg>`,
    "",
  ].join("\n");
}
