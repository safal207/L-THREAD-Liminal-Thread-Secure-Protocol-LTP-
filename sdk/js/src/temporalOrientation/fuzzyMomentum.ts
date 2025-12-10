import type {
  MomentumMetrics,
  TemporalOrientationView,
  TemporalSlope,
} from './temporalOrientationTypes';

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function extractTrendScalar(view: TemporalOrientationView): number {
  const summary = view.summary;
  const baseMomentum = typeof summary.focusMomentumScore === 'number' ? summary.focusMomentumScore : 0;
  const risingCount = summary.risingSectors?.length ?? 0;
  const fallingCount = summary.fallingSectors?.length ?? 0;
  const totalDirectional = risingCount + fallingCount;
  const trendBalance = totalDirectional > 0 ? (risingCount - fallingCount) / totalDirectional : 0;

  const globalBias = summary.globalTrend === 'rising'
    ? 0.15
    : summary.globalTrend === 'falling'
      ? -0.15
      : summary.globalTrend === 'mixed'
        ? 0.05
        : 0;

  const activeWeight = summary.activeSectorCount ? clamp01(summary.activeSectorCount / 12) * 0.1 : 0;

  // Combine the available temporal signals into a single scalar in [-1, 1].
  return clamp(baseMomentum + trendBalance * 0.4 + globalBias + activeWeight, -1, 1);
}

function countSignChanges(values: number[], epsilon: number): number {
  let changes = 0;
  const significant = values.filter((delta) => Math.abs(delta) > epsilon);

  for (let i = 1; i < significant.length; i += 1) {
    const prev = significant[i - 1];
    const current = significant[i];

    if (prev != null && current != null && Math.sign(prev) !== Math.sign(current)) {
      changes += 1;
    }
  }

  return changes;
}

export function computeMomentumMetrics(
  history: TemporalOrientationView[],
  options?: { windowSize?: number },
): MomentumMetrics {
  const windowSize = options?.windowSize ?? 5;
  const recent = history.slice(-windowSize);

  if (recent.length < 2) {
    return { slope: 'flat', strength: 0 } satisfies MomentumMetrics;
  }

  const values = recent.map(extractTrendScalar);
  const epsilon = 0.05;

  const deltas: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const current = values[i];
    const previous = values[i - 1];

    if (current == null || previous == null) {
      continue;
    }

    deltas.push(current - previous);
  }

  const start = values[0] ?? 0;
  const end = values[values.length - 1] ?? start;
  const delta = end - start;
  const averageAbsDelta = deltas.length > 0
    ? deltas.reduce((sum, value) => sum + Math.abs(value), 0) / deltas.length
    : 0;

  const signChanges = countSignChanges(deltas, epsilon);
  const significantDeltas = deltas.filter((value) => Math.abs(value) > epsilon);

  let slope: TemporalSlope = 'flat';
  const isOscillating = signChanges >= 2 && averageAbsDelta > epsilon;

  if (isOscillating) {
    slope = 'oscillating';
  } else if (delta > epsilon) {
    slope = 'rising';
  } else if (delta < -epsilon) {
    slope = 'falling';
  }

  const directionConsistency = significantDeltas.length === 0
    ? 1
    : Math.abs(
        significantDeltas.filter((value) => value > epsilon).length
        - significantDeltas.filter((value) => value < -epsilon).length,
      ) / significantDeltas.length;

  const normalizedDelta = clamp01(Math.abs(delta));

  let strength: number;
  if (slope === 'oscillating') {
    strength = clamp01(averageAbsDelta);
  } else if (slope === 'flat') {
    strength = clamp01(averageAbsDelta * 0.5);
  } else {
    strength = clamp01(normalizedDelta * 0.7 + directionConsistency * 0.3);
  }

  return { slope, strength } satisfies MomentumMetrics;
}
