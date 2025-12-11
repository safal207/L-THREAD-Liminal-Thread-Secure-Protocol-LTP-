import {
  buildMultiPathSuggestion,
  type FutureWeaveBranch,
  type MultiPathSuggestion,
  type RoutingDecision,
  type TemporalOrientationView,
} from "../routing/temporal-multipath";
import { renderFutureWeaveGraph, type FutureWeaveGraphOptions } from "../visualization/futureWeaveGraph";

export interface RoutingDecisionExplanation {
  chosenPathId: string;
  chosenBranchLabel?: string;
  intent: string;
  reasons: string[];
  metrics: {
    focusMomentum?: number;
    likelihood?: number;
    volatility?: number;
    depthScore?: number;
    [key: string]: number | string | undefined;
  };
}

export interface RoutingExplainView {
  decision: RoutingDecisionExplanation;
  suggestion: MultiPathSuggestion;
  highlightedPathIds: string[];
  graph: string;
}

function pickTopBranch(suggestion: MultiPathSuggestion): FutureWeaveBranch | undefined {
  if (suggestion.branches?.length) {
    return [...suggestion.branches].sort((a, b) => b.likelihood - a.likelihood)[0];
  }

  if (suggestion.primaryPath) {
    return {
      id: suggestion.primaryPath.pathId,
      role: "primary",
      label: suggestion.primaryPath.label,
      likelihood: suggestion.primaryPath.overallLikelihood,
      momentumHint: "stable",
      volatilityHint: "mid",
      softenedSectors: suggestion.primaryPath.nodes.map((node) => node.sectorId),
    };
  }

  return undefined;
}

function describeIntentAlignment(intent: string, role?: string): string {
  if (!intent) return "Intent not provided; defaulting to most stable path.";
  if (!role) return `Intent "${intent}" applied to default branch.`;

  if (intent.includes("deepen") || intent.includes("focus")) {
    return `Intent "${intent}" leans toward maintaining focus, aligning with the ${role} branch.`;
  }

  if (intent.includes("recover") || intent.includes("stabil")) {
    return `Intent "${intent}" prefers stability, pushing weight toward ${role} branch.`;
  }

  if (intent.includes("explore")) {
    return `Intent "${intent}" values exploration; ${role} branch offered the safest exploration gradient.`;
  }

  return `Intent "${intent}" applied with neutral bias toward the ${role} branch.`;
}

function describeMomentumReason(focusMomentum: number | undefined, volatility: number | undefined): string | undefined {
  if (focusMomentum === undefined || volatility === undefined) return undefined;

  if (focusMomentum >= 0.7 && volatility <= 0.3) {
    return `High focus momentum (${focusMomentum.toFixed(2)}) with low volatility (${volatility.toFixed(2)}) favoured staying on course.`;
  }

  if (focusMomentum <= 0.35 && volatility >= 0.55) {
    return `Fragmented focus (${focusMomentum.toFixed(2)}) and elevated volatility (${volatility.toFixed(2)}) favoured a softer branch.`;
  }

  if (focusMomentum >= 0.5) {
    return `Growing momentum (${focusMomentum.toFixed(2)}) encouraged deeper progression despite volatility ${volatility.toFixed(2)}.`;
  }

  return `Stabilising focus (${focusMomentum.toFixed(2)}) suggested holding the current guidance.`;
}

function describeBranchAdvantage(branches: FutureWeaveBranch[], chosenId: string): string | undefined {
  if (!branches.length) return undefined;
  const [top, second] = [...branches].sort((a, b) => b.likelihood - a.likelihood);
  if (!top || top.id !== chosenId) return undefined;
  if (!second) return `Chosen branch had clear lead with likelihood ${top.likelihood.toFixed(2)}.`;

  const delta = Number((top.likelihood - second.likelihood).toFixed(3));
  if (delta <= 0) return undefined;
  return `Likelihood edge: ${top.role} at ${top.likelihood.toFixed(2)} vs ${second.role} at ${second.likelihood.toFixed(2)} (Δ=${delta.toFixed(2)}).`;
}

function deriveReasons(params: {
  intent: string;
  branch?: FutureWeaveBranch;
  orientation: TemporalOrientationView;
  suggestion: MultiPathSuggestion;
}): string[] {
  const { intent, branch, orientation, suggestion } = params;
  const reasons: string[] = [];

  reasons.push(describeIntentAlignment(intent, branch?.role));

  const momentumReason = describeMomentumReason(orientation.focusMomentum, orientation.volatility);
  if (momentumReason) reasons.push(momentumReason);

  if (branch?.momentumHint) {
    reasons.push(`Branch momentum trend is ${branch.momentumHint}, matching the desired pacing.`);
  }

  if (branch?.volatilityHint) {
    reasons.push(`Volatility profile is ${branch.volatilityHint}, consistent with current stability needs.`);
  }

  const advantage = describeBranchAdvantage(suggestion.branches ?? [], branch?.id ?? "");
  if (advantage) reasons.push(advantage);

  return reasons.filter(Boolean);
}

export function explainRoutingForScenario(params: {
  orientation: TemporalOrientationView;
  routingDecision: RoutingDecision;
  intent: string;
  graphOptions?: FutureWeaveGraphOptions;
}): RoutingExplainView {
  const { orientation, routingDecision, intent, graphOptions } = params;

  const suggestion = buildMultiPathSuggestion(orientation, routingDecision);
  const chosenBranch = pickTopBranch(suggestion);
  const metrics = {
    focusMomentum: orientation.focusMomentum,
    volatility: orientation.volatility,
    likelihood: chosenBranch?.likelihood,
  };

  const decision: RoutingDecisionExplanation = {
    chosenPathId: chosenBranch?.id ?? suggestion.primaryPath.pathId,
    chosenBranchLabel: chosenBranch?.label,
    intent,
    reasons: deriveReasons({ intent, branch: chosenBranch, orientation, suggestion }),
    metrics,
  };

  const highlightedPathIds = [decision.chosenPathId];
  const graph = renderFutureWeaveGraph(suggestion, { ...graphOptions, highlightedPathIds });

  return {
    decision,
    suggestion,
    highlightedPathIds,
    graph,
  };
}

export function buildDemoScenario(): { orientation: TemporalOrientationView; routingDecision: RoutingDecision; intent: string } {
  const orientation: TemporalOrientationView = {
    currentSector: "deep_work/core",
    focusMomentum: 0.72,
    volatility: 0.18,
    phaseLabel: "alpha-focus",
  };

  const routingDecision: RoutingDecision = {
    options: [
      { sector: "deep_work/core", score: 0.76 },
      { sector: "planning/light", score: 0.52 },
      { sector: "rest/reset", score: 0.28 },
    ],
  };

  return { orientation, routingDecision, intent: "deepen-focus" };
}

export function explainRoutingForDemoScenario(): RoutingExplainView {
  const scenario = buildDemoScenario();
  return explainRoutingForScenario({ ...scenario, graphOptions: { maxBranches: 3, showMeta: true } });
}

export function formatRoutingExplanation(view: RoutingExplainView): string {
  const { decision } = view;
  const lines: string[] = [];
  lines.push("ROUTING EXPLANATION");
  lines.push("====================");
  lines.push("");
  lines.push(`Routing intent: ${decision.intent}`);
  lines.push(`Chosen path: ${decision.chosenBranchLabel ?? decision.chosenPathId}`);
  lines.push("Reason:");
  decision.reasons.forEach((reason) => lines.push(` - ${reason}`));
  lines.push("");
  lines.push("Metrics:");
  Object.entries(decision.metrics).forEach(([key, value]) => {
    if (value === undefined) return;
    const formatted = typeof value === "number" ? value.toFixed(2) : String(value);
    lines.push(` - ${key}: ${formatted}`);
  });

  return lines.join("\n");
}

function runCliDemo() {
  const view = explainRoutingForDemoScenario();
  const explanation = formatRoutingExplanation(view);

  const graphBlock = ["", "FUTURE WEAVE GRAPH", "-------------------", "", view.graph].join("\n");

  console.log(`${explanation}\n${graphBlock}`);
}

if (require.main === module) {
  runCliDemo();
}
