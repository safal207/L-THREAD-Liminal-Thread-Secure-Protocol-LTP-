export interface TimeWeaveAsymmetry {
  asymmetry: number; // 0..1
  direction: -1 | 0 | 1;
  confidence: number; // 0..1
}

const ZERO_ASYMMETRY: TimeWeaveAsymmetry = {
  asymmetry: 0,
  direction: 0,
  confidence: 0,
};

export function computeTimeWeaveAsymmetry(values: number[]): TimeWeaveAsymmetry {
  if (values.length < 2) {
    return ZERO_ASYMMETRY;
  }

  let min = values[0];
  let max = values[0];

  const first = values[0];
  const last = values[values.length - 1];

  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = max - min;

  if (range === 0) {
    return ZERO_ASYMMETRY;
  }

  const delta = last - first;
  const normalized = delta / range;
  const clamped = Math.max(-1, Math.min(1, normalized));

  const direction: -1 | 0 | 1 =
    clamped > 0.05 ? 1 :
    clamped < -0.05 ? -1 :
    0;

  const asymmetry = Math.abs(clamped);

  const lengthFactor = Math.min(1, values.length / 12);
  const confidence = asymmetry * lengthFactor;

  return { asymmetry, direction, confidence };
}
