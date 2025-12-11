import { renderConsciousnessGrid } from "./asciiGraph";
import { applyColor, ZONE_COLORS } from "./colorTheme";
import type {
  ConsciousnessSnapshot,
  ConsciousnessZone,
  FuturePath,
  TimeAnchor,
} from "../../sdk/js/src/consciousnessWeb.types";

type RenderOptions = {
  colorize?: boolean;
};

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function describeVolatility(volatility: number): string {
  if (volatility >= 0.75) return "high";
  if (volatility >= 0.45) return "mid";
  return "low";
}

function formatMomentumLine(label: string, value: number): string {
  return `${label}: ${value.toFixed(2)}`;
}

function formatFuturePaths(paths: FuturePath[], colorize: boolean): string {
  const arrow = colorize ? applyColor("→", "gray", true) : "→";
  return paths
    .map((path) => {
      const parts = path.path.map((zone) => zone.toUpperCase()).join(" → ");
      const role = path.role.padEnd(8, " ");
      const probability = path.probability.toFixed(2);
      return ` ${arrow} ${role}: ${parts} (${probability})`;
    })
    .join("\n");
}

function formatTimeAnchors(anchors: TimeAnchor[]): string {
  return anchors
    .map((anchor) => {
      const prefix = anchor.offset < 0 ? `${anchor.offset}` : `+${anchor.offset}`;
      const confidence = anchor.confidence !== undefined ? ` (${Math.round(clamp(anchor.confidence) * 100)}%)` : "";
      return ` ${prefix}: ${anchor.label}${confidence}`;
    })
    .join("\n");
}

function deriveTensionMap(snapshot: ConsciousnessSnapshot): Partial<Record<string, number>> {
  const base = clamp(snapshot.tension);
  return {
    "calm-growth": base * 0.35,
    "growth-recovery": base * 0.42,
    "growth-storm": base * 0.78,
    "storm-shift": base * 0.9,
  };
}

function turbulenceSet(snapshot: ConsciousnessSnapshot): Set<ConsciousnessZone> {
  const zones = new Set<ConsciousnessZone>(snapshot.turbulenceZones ?? []);
  if (snapshot.volatility > 0.7) zones.add(snapshot.orientation);
  return zones;
}

function renderLegend(colorize: boolean): string {
  const entries: [ConsciousnessZone, string][] = [
    ["calm", "Calm → голубой"],
    ["growth", "Growth → зелёный"],
    ["recovery", "Recovery → бирюзовый"],
    ["storm", "Storm → красный"],
    ["shift", "Shift → фиолетовый"],
  ];
  return entries
    .map(([zone, label]) => {
      return colorize ? applyColor(label, ZONE_COLORS[zone]) : label;
    })
    .join("\n");
}

export function renderConsciousnessWeb(snapshot: ConsciousnessSnapshot, options?: RenderOptions): string {
  const colorize = options?.colorize ?? true;
  const header = [
    "────────────────────────────────────────────",
    "        LTP — CONSCIOUSNESS WEB MAP",
    "────────────────────────────────────────────",
  ];

  const gridLines = renderConsciousnessGrid({
    orientation: snapshot.orientation,
    tensionMap: deriveTensionMap(snapshot),
    turbulenceZones: turbulenceSet(snapshot),
    colorize,
  });

  const momentumLines = [
    formatMomentumLine("Focus Momentum", snapshot.focusMomentum),
    `${formatMomentumLine("Volatility", snapshot.volatility)} (${describeVolatility(snapshot.volatility)})`,
    `${formatMomentumLine("Resilience", snapshot.resilience)}`,
  ];

  const futureBlock = ["Future Paths:", formatFuturePaths(snapshot.futurePaths, colorize)];
  const anchorsBlock = ["Time Anchors:", formatTimeAnchors(snapshot.timeAnchors)];
  const legendBlock = ["Legend:", renderLegend(colorize)];

  const content = [
    ...header,
    "",
    ...gridLines,
    "",
    ...momentumLines,
    "",
    ...futureBlock,
    "",
    ...anchorsBlock,
    "",
    ...legendBlock,
    "",
    "────────────────────────────────────────────",
  ];

  if (!colorize) return content.join("\n");
  return content
    .map((line) => {
      if (line.startsWith("──")) return applyColor(line, "gray", true);
      if (line.startsWith("Focus Momentum") || line.startsWith("Volatility") || line.startsWith("Resilience")) {
        return applyColor(line, "gray");
      }
      return line;
    })
    .join("\n");
}
