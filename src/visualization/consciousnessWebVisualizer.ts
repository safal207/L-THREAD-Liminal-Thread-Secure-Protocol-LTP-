import { renderConsciousnessGrid } from "./asciiGraph";
import { applyColor, ZONE_COLORS } from "./colorTheme";
import type {
  ConsciousnessSnapshot,
  ConsciousnessZone,
  FuturePath,
  TimeAnchor,
} from "../../sdk/js/src/consciousnessWeb.types";

type RenderMode = "debug" | "human" | "story";

type RenderOptions = {
  colorize?: boolean;
  mode?: RenderMode;
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

function formatZoneName(zone: ConsciousnessZone, colorize: boolean, highlight?: boolean): string {
  const label = zone.toUpperCase();
  if (!colorize) return highlight ? `[${label}]` : label;
  return highlight ? applyColor(`[${label}]`, ZONE_COLORS[zone], true) : applyColor(label, ZONE_COLORS[zone]);
}

function renderDebugView(snapshot: ConsciousnessSnapshot, colorize: boolean): string {
  const header = [
    "────────────────────────────────────────────",
    "        LTP — CONSCIOUSNESS WEB MAP (DEBUG)",
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
    `${formatMomentumLine("Tension", snapshot.tension)}`,
  ];

  const futureBlock = ["Future Paths:", formatFuturePaths(snapshot.futurePaths, colorize)];
  const anchorsBlock = ["Time Anchors:", formatTimeAnchors(snapshot.timeAnchors)];
  const legendBlock = ["Legend:", renderLegend(colorize)];
  const rawBlock = ["Raw snapshot:", JSON.stringify(snapshot, null, 2)];

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
    ...rawBlock,
    "",
    "────────────────────────────────────────────",
  ];

  if (!colorize) return content.join("\n");
  return content
    .map((line) => {
      if (line.startsWith("──")) return applyColor(line, "gray", true);
      if (
        line.startsWith("Focus Momentum") ||
        line.startsWith("Volatility") ||
        line.startsWith("Resilience") ||
        line.startsWith("Tension")
      ) {
        return applyColor(line, "gray");
      }
      return line;
    })
    .join("\n");
}

function renderHumanView(snapshot: ConsciousnessSnapshot, colorize: boolean): string {
  const arrow = colorize ? applyColor("→", "gray", true) : "→";
  const strong = colorize ? applyColor("==", "green", true) : "==";
  const branch = colorize ? applyColor("↘", "gray", true) : "↘";

  const orientation = formatZoneName(snapshot.orientation, colorize, true);
  const [primary, secondary] = snapshot.futurePaths;

  const primaryTail = primary?.path.slice(1).map((zone) => formatZoneName(zone, colorize)).join(` ${arrow} `);
  const primaryLine = primaryTail ? `${orientation} ${strong}${arrow} ${primaryTail}` : `${orientation}`;

  const futureLabel = colorize ? applyColor("future", "gray") : "future";
  const branchLine = secondary?.path.length
    ? `${" ".repeat(10)}${branch} ${secondary.path
        .map((zone) => formatZoneName(zone, colorize))
        .join(` ${arrow} `)} (${futureLabel})`
    : undefined;

  const pulseLine = `Pulse: momentum ${snapshot.focusMomentum.toFixed(2)} • volatility ${describeVolatility(
    snapshot.volatility,
  )}`;

  return [
    "────────────────────────────────────────────",
    "        CONSCIOUSNESS WEB — HUMAN VIEW",
    "────────────────────────────────────────────",
    primaryLine,
    branchLine ?? "",
    pulseLine,
    "────────────────────────────────────────────",
  ]
    .filter(Boolean)
    .join("\n");
}

function describeMomentumState(m: number): string {
  if (m >= 0.8) return "surging";
  if (m >= 0.5) return "rising";
  if (m >= 0.2) return "steady";
  return "resting";
}

function nearestAnchor(snapshot: ConsciousnessSnapshot): string | undefined {
  if (!snapshot.timeAnchors.length) return undefined;
  const sorted = [...snapshot.timeAnchors].sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset));
  const anchor = sorted[0];
  const confidence = anchor.confidence !== undefined ? `${Math.round(clamp(anchor.confidence) * 100)}%` : "?";
  const prefix = anchor.offset > 0 ? `+${anchor.offset}` : `${anchor.offset}`;
  return `${prefix}: ${anchor.label} (${confidence})`;
}

function renderStoryView(snapshot: ConsciousnessSnapshot, colorize: boolean): string {
  const orientation = formatZoneName(snapshot.orientation, colorize, true);
  const primary = snapshot.futurePaths[0];
  const alternate = snapshot.futurePaths[1];
  const momentumState = describeMomentumState(snapshot.focusMomentum);
  const volatilityText = describeVolatility(snapshot.volatility);
  const anchorText = nearestAnchor(snapshot);

  const lines = [
    "────────────────────────────────────────────",
    "        CONSCIOUSNESS WEB — STORY MODE",
    "────────────────────────────────────────────",
    `You are currently oriented in ${orientation}.`,
    `Momentum feels ${momentumState} (${snapshot.focusMomentum.toFixed(2)}), with ${volatilityText} volatility (${snapshot.volatility.toFixed(
      2,
    )}).`,
  ];

  if (primary) {
    const target = primary.path[primary.path.length - 1];
    lines.push(
      `One strong path opens toward ${formatZoneName(target, colorize)} (${primary.probability.toFixed(2)} chance).`,
    );
  }
  if (alternate) {
    const altTarget = alternate.path[alternate.path.length - 1];
    lines.push(
      `A speculative branch emerges from ${formatZoneName(altTarget, colorize)} (${alternate.probability.toFixed(2)}).`,
    );
  }
  if (anchorText) {
    lines.push(`Nearest time anchor: ${anchorText}.`);
  }

  lines.push("────────────────────────────────────────────");
  return lines.join("\n");
}

export function renderConsciousnessWeb(snapshot: ConsciousnessSnapshot, options?: RenderOptions): string {
  const colorize = options?.colorize ?? true;
  const mode: RenderMode = options?.mode ?? "debug";

  if (mode === "human") return renderHumanView(snapshot, colorize);
  if (mode === "story") return renderStoryView(snapshot, colorize);
  return renderDebugView(snapshot, colorize);
}
