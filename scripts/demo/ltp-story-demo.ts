import {
  buildMultiPathSuggestion,
  buildRoutingPreview,
  MultiPathSuggestion,
  RoutingDecision,
  TemporalOrientationView,
} from "../../src/routing/focusRoutingPreview";
import { detectHudMode, HudMode } from "../monitor/hudModes";
import {
  FocusHudSnapshot,
  FOCUS_HISTORY_LIMIT,
  renderFocusHudLine,
} from "../monitor/ltp-focus-hud";

export const DEMO_SPEED = Number(process.env.DEMO_SPEED ?? process.env.DEMO_SPEED_MS ?? 1200);
export const USE_LOCAL_FRAMES = (process.env.USE_LOCAL_FRAMES ?? "true").toLowerCase() !== "false";

export type StoryPhase = "A" | "B" | "C";

export interface StoryFrame {
  phase: StoryPhase;
  focusMomentum: number;
  volatility: number;
  sector: string;
  intent: string;
  routingDecision: RoutingDecision;
  linkHealth: "OK" | "WARN" | "CRIT";
  modeHint?: HudMode;
}

const PHASE_LABELS: Record<StoryPhase, string> = {
  A: "Phase A — Focused work",
  B: "Phase B — Context switching / storm",
  C: "Phase C — Recovery / soft landing",
};

const PHASE_ROUTING_HELPERS: Record<StoryPhase, string[]> = {
  A: ["deep_work", "future_planning"],
  B: ["rest", "social", "planning"],
  C: ["light_work", "planning"],
};

function calculateVolatility(history: number[]): number {
  if (history.length < 2) return 0;
  const deltas = history.slice(1).map((value, index) => Math.abs(value - history[index]));
  const avgDelta = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
  return Number(avgDelta.toFixed(3));
}

export function buildStoryFrames(): StoryFrame[] {
  return [
    {
      phase: "A",
      focusMomentum: 0.76,
      volatility: 0.08,
      sector: "deep_work",
      intent: "stay_deep",
      linkHealth: "OK",
      routingDecision: {
        options: [
          { sector: "deep_work", score: 0.76 },
          { sector: "planning/light", score: 0.32 },
        ],
      },
      modeHint: "calm",
    },
    {
      phase: "A",
      focusMomentum: 0.82,
      volatility: 0.07,
      sector: "deep_work",
      intent: "stay_deep",
      linkHealth: "OK",
      routingDecision: {
        options: [
          { sector: "deep_work", score: 0.8 },
          { sector: "future_planning", score: 0.35 },
        ],
      },
      modeHint: "calm",
    },
    {
      phase: "A",
      focusMomentum: 0.79,
      volatility: 0.09,
      sector: "deep_work",
      intent: "stay_deep",
      linkHealth: "OK",
      routingDecision: {
        options: [
          { sector: "deep_work", score: 0.78 },
          { sector: "light_planning", score: 0.28 },
        ],
      },
      modeHint: "calm",
    },
    {
      phase: "B",
      focusMomentum: 0.31,
      volatility: 0.63,
      sector: "rest",
      intent: "micro_break",
      linkHealth: "WARN",
      routingDecision: {
        options: [
          { sector: "rest", score: 0.41 },
          { sector: "social", score: 0.38 },
          { sector: "planning", score: 0.25 },
        ],
      },
      modeHint: "storm",
    },
    {
      phase: "B",
      focusMomentum: -0.06,
      volatility: 0.7,
      sector: "social",
      intent: "context_switch",
      linkHealth: "WARN",
      routingDecision: {
        options: [
          { sector: "social", score: 0.36 },
          { sector: "rest", score: 0.34 },
          { sector: "planning", score: 0.3 },
        ],
      },
      modeHint: "storm",
    },
    {
      phase: "B",
      focusMomentum: 0.18,
      volatility: 0.58,
      sector: "planning",
      intent: "reanchor",
      linkHealth: "WARN",
      routingDecision: {
        options: [
          { sector: "planning", score: 0.44 },
          { sector: "social", score: 0.33 },
          { sector: "rest", score: 0.31 },
        ],
      },
      modeHint: "storm",
    },
    {
      phase: "C",
      focusMomentum: 0.35,
      volatility: 0.28,
      sector: "planning",
      intent: "stabilize",
      linkHealth: "OK",
      routingDecision: {
        options: [
          { sector: "planning", score: 0.62 },
          { sector: "light_work", score: 0.58 },
          { sector: "social", score: 0.26 },
        ],
      },
      modeHint: "shift",
    },
    {
      phase: "C",
      focusMomentum: 0.52,
      volatility: 0.22,
      sector: "light_work",
      intent: "resume",
      linkHealth: "OK",
      routingDecision: {
        options: [
          { sector: "light_work", score: 0.62 },
          { sector: "planning", score: 0.55 },
          { sector: "deep_work", score: 0.21 },
        ],
      },
      modeHint: "shift",
    },
    {
      phase: "C",
      focusMomentum: 0.61,
      volatility: 0.19,
      sector: "light_work",
      intent: "rebuild",
      linkHealth: "OK",
      routingDecision: {
        options: [
          { sector: "light_work", score: 0.64 },
          { sector: "planning", score: 0.5 },
        ],
      },
      modeHint: "shift",
    },
  ];
}

function formatRouting(decision: RoutingDecision): string {
  if (!decision.options.length) return "route: –";
  const [primary, ...alts] = [...decision.options].sort((a, b) => b.score - a.score);
  const confidence = primary ? ` (conf=${primary.score.toFixed(2)})` : "";
  const altText = alts.length
    ? alts
        .slice(0, 2)
        .map((option) => `${option.sector}? (${option.score.toFixed(2)})`)
        .join(", ")
    : "";
  const altSegment = altText ? ` | alt: ${altText}` : "";
  return `route: ${primary?.sector ?? "?"}${confidence}${altSegment}`;
}

function formatMultiPathSuggestion(suggestion: MultiPathSuggestion): string {
  const formatPath = (label: string, nodes: string, likelihood: number) =>
    `${label} (${(likelihood * 100).toFixed(0)}%) → [${nodes}]`;

  const primaryNodes = suggestion.primaryPath.nodes.map((node) => node.sectorId).join(" → ");
  const altSegments = suggestion.alternates
    .map((alt) => formatPath(alt.label, alt.nodes.map((node) => node.sectorId).join(" → "), alt.overallLikelihood))
    .join(" | ");

  const primarySegment = formatPath(
    suggestion.primaryPath.label,
    primaryNodes,
    suggestion.primaryPath.overallLikelihood,
  );

  return `${primarySegment} || ${altSegments}`;
}

function formatStoryLine(params: {
  frame: StoryFrame;
  mode: HudMode;
  momentumHistory: number[];
  previewSector: string;
}): string {
  const { frame, mode, momentumHistory, previewSector } = params;
  const volatility = calculateVolatility(momentumHistory).toFixed(2);
  const momentum = frame.focusMomentum.toFixed(2);
  return `[PHASE=${frame.phase} | ${mode} | vol=${volatility} | momentum=${momentum}] → route: ${previewSector}`;
}

function logStoryFrame(frame: StoryFrame, focusHistory: number[]) {
  const mode = frame.modeHint ??
    detectHudMode({
      focusHistory,
      linkHealth: frame.linkHealth,
      lastIntent: frame.intent,
      lastSector: frame.sector,
    });

  const orientation: TemporalOrientationView = {
    currentSector: frame.sector,
    focusMomentum: frame.focusMomentum,
    volatility: frame.volatility || calculateVolatility(focusHistory),
    phaseLabel: frame.phase,
  };

  const preview = buildRoutingPreview({
    snapshot: { sector: frame.sector, focusMomentum: frame.focusMomentum },
    routingDecision: frame.routingDecision,
    volatilityScore: orientation.volatility,
  });

  const multiPath = buildMultiPathSuggestion(orientation, frame.routingDecision);

  const storyLine = formatStoryLine({
    frame,
    mode,
    momentumHistory: focusHistory,
    previewSector: preview.primaryNextSector,
  });

  console.log(storyLine);
  console.log(`   options: ${formatRouting(frame.routingDecision)}`);
  console.log(`   branches: ${formatMultiPathSuggestion(multiPath)}`);
  console.log(`   phase: ${PHASE_LABELS[frame.phase]} | intents: ${PHASE_ROUTING_HELPERS[frame.phase].join(", ")}`);

  const snapshot: FocusHudSnapshot = {
    linkHealth: frame.linkHealth,
    sector: frame.sector,
    intent: frame.intent,
    focusMomentum: frame.focusMomentum,
  };

  console.log(renderFocusHudLine(snapshot, focusHistory, mode));
  console.log("---");
}

async function runLocalStory(frames: StoryFrame[]): Promise<void> {
  console.log(`[story] Playing local demo (${frames.length} frames) at ${DEMO_SPEED}ms/step`);
  let idx = 0;
  const focusHistory: number[] = [];

  const timer = setInterval(() => {
    const frame = frames[idx++];
    focusHistory.push(frame.focusMomentum);
    if (focusHistory.length > FOCUS_HISTORY_LIMIT) {
      focusHistory.shift();
    }

    logStoryFrame(frame, focusHistory);

    if (idx >= frames.length) {
      clearInterval(timer);
      console.log("[story] demo complete");
    }
  }, DEMO_SPEED);
}

async function runDemo() {
  const frames = USE_LOCAL_FRAMES ? buildStoryFrames() : null;

  if (!frames) {
    console.warn("[story] Live gateway mode not yet wired in this demo; using local frames instead.");
    return runLocalStory(buildStoryFrames());
  }

  return runLocalStory(frames);
}

if (require.main === module) {
  runDemo();
}
