import type { HudMode } from "./hudTheme";

export type { HudMode } from "./hudTheme";

export interface HudModeContext {
  focusHistory: number[];
  linkHealth: "OK" | "WARN" | "CRIT";
  lastIntent?: string;
  lastSector?: string;
}

const MIN_TREND_POINTS = 4;
const SHIFT_AVG_THRESHOLD = 0.3;
const STORM_VOLATILITY_THRESHOLD = 0.25;
const STORM_FLIP_THRESHOLD = 3;

export function detectHudMode(ctx: HudModeContext): HudMode {
  const { focusHistory, linkHealth } = ctx;
  if (!focusHistory.length) return "calm";

  const deltas = focusHistory.slice(1).map((v, i) => v - focusHistory[i]);
  const avgAbsDelta =
    deltas.length > 0
      ? deltas.reduce((sum, delta) => sum + Math.abs(delta), 0) / deltas.length
      : 0;

  const flips = countSignFlips(focusHistory);
  const avg = focusHistory.reduce((sum, value) => sum + value, 0) / focusHistory.length;

  const isTrendRising = isMonotonic(focusHistory, "up");
  const isTrendFalling = isMonotonic(focusHistory, "down");

  if ((isTrendRising || isTrendFalling) && Math.abs(avg) > SHIFT_AVG_THRESHOLD) {
    return "shift";
  }

  if (avgAbsDelta > STORM_VOLATILITY_THRESHOLD || flips >= STORM_FLIP_THRESHOLD || linkHealth === "CRIT") {
    return "storm";
  }

  return "calm";
}

export function countSignFlips(history: number[]): number {
  let flips = 0;
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];
    if (prev === 0 || curr === 0) continue;
    if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) {
      flips++;
    }
  }
  return flips;
}

export function isMonotonic(history: number[], dir: "up" | "down"): boolean {
  if (history.length < MIN_TREND_POINTS) return false;
  if (dir === "up") {
    return history.every((value, index) => index === 0 || value >= history[index - 1]);
  }
  return history.every((value, index) => index === 0 || value <= history[index - 1]);
}
