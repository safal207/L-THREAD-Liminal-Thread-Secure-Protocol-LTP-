import { applyColor, ZONE_COLORS } from "./colorTheme";
import type { ConsciousnessZone } from "../../sdk/js/src/consciousnessWeb.types";

type ZoneState = {
  id: ConsciousnessZone;
  label: string;
  active: boolean;
  turbulent: boolean;
  tensionDelta?: number;
};

function formatDelta(delta: number | undefined): string {
  if (delta === undefined || Number.isNaN(delta)) return "";
  return `Δ${delta.toFixed(2)}`;
}

function formatZone(zone: ZoneState, colorize: boolean): string {
  const base = `[ ${zone.label} ]${zone.turbulent ? "*" : ""}`;
  if (!colorize) {
    if (zone.active) return `>>>>>>> ${base} <<<<<<<`;
    return base;
  }

  const colored = applyColor(base, ZONE_COLORS[zone.id], zone.active);
  if (zone.active) {
    return `${applyColor(">>>>>>>", "gray", true)} ${colored} ${applyColor("<<<<<<<", "gray", true)}`;
  }
  return colored;
}

export function renderConsciousnessGrid(params: {
  orientation: ConsciousnessZone;
  tensionMap: Partial<Record<string, number>>;
  turbulenceZones: Set<ConsciousnessZone>;
  colorize?: boolean;
}): string[] {
  const { orientation, tensionMap, turbulenceZones, colorize = true } = params;

  const zones: ZoneState[] = [
    { id: "calm", label: "CALM", active: orientation === "calm", turbulent: turbulenceZones.has("calm") },
    { id: "growth", label: "GROWTH", active: orientation === "growth", turbulent: turbulenceZones.has("growth") },
    { id: "recovery", label: "RECOVERY", active: orientation === "recovery", turbulent: turbulenceZones.has("recovery") },
    { id: "storm", label: "STORM", active: orientation === "storm", turbulent: turbulenceZones.has("storm") },
    { id: "shift", label: "SHIFT", active: orientation === "shift", turbulent: turbulenceZones.has("shift") },
  ];

  const label: Record<ConsciousnessZone, string> = {
    calm: formatZone(zones[0], colorize),
    growth: formatZone(zones[1], colorize),
    recovery: formatZone(zones[2], colorize),
    storm: formatZone(zones[3], colorize),
    shift: formatZone(zones[4], colorize),
  };

  const cgDelta = formatDelta(tensionMap["calm-growth"]);
  const gsDelta = formatDelta(tensionMap["growth-storm"]);
  const grDelta = formatDelta(tensionMap["growth-recovery"]);
  const ssDelta = formatDelta(tensionMap["storm-shift"]);

  const line1 = `         ${label.calm}`;
  const line2 = cgDelta ? `            |\\n            (${cgDelta})` : "            |";
  const midBranch = grDelta ? ` (${grDelta}) ` : " ";
  const line3 = `   ${label.growth}${midBranch}| ${label.recovery}`;
  const line4 = gsDelta ? `            |\\n            (${gsDelta})` : "            |";
  const line5 = `   ${label.storm}`;
  const line6 = ssDelta ? `            |\\n            (${ssDelta})` : "            |";
  const line7 = `          ${label.shift}`;

  return [line1, line2, line3, line4, line5, line6, line7];
}
