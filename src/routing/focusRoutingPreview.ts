import {
  buildTurtleSnapshot,
  createDefaultTurtleMatrix,
  rotateTurtleMatrix,
  type TurtleFrameId,
  type TurtleSnapshot,
} from "../turtle";

export interface FocusSnapshot {
  sector?: string;
  focusMomentum?: number;
}

export interface TimeWeaveSummary {
  futureBias?: number;
  familyWeight?: number;
  regulationSignal?: number;
  divergenceScore?: number;
}

export interface RoutingDecisionOption {
  sector: string;
  score: number;
}

export interface RoutingDecision {
  options: RoutingDecisionOption[];
}

export interface RoutingPreview {
  currentSector: string;
  primaryNextSector: string;
  alternativeSectors: string[];
  focusMomentum: number;
  volatility: number;
  reason: string;
}

export interface TemporalOrientationView {
  currentSector: string;
  focusMomentum: number;
  volatility: number;
  phaseLabel?: string;
  turtle?: TurtleSnapshot;
}

export interface FutureWeaveNode {
  id: string;
  sectorId: string;
  timeOffsetMs: number;
  expectedFocusMomentum: number;
  volatilityHint: number;
  likelihood: number;
}

export interface FutureWeavePath {
  pathId: string;
  label: string;
  nodes: FutureWeaveNode[];
  overallLikelihood: number;
  narrativeHint?: string;
}

export type FutureWeaveBranchRole = "primary" | "recovery" | "explore" | (string & {});

export interface FutureWeaveBranch {
  id: string;
  role: FutureWeaveBranchRole;
  label?: string;
  likelihood: number;
  momentumHint?: "rising" | "stable" | "falling" | (string & {});
  volatilityHint?: "low" | "mid" | "high" | (string & {});
  softenedSectors?: string[];
}

export interface MultiPathSuggestion {
  primaryPath: FutureWeavePath;
  alternates: FutureWeavePath[];
  branches: FutureWeaveBranch[];
}

function selectPrimaryAndAlternatives(decision: RoutingDecision): {
  primary?: RoutingDecisionOption;
  alternatives: RoutingDecisionOption[];
} {
  const sorted = [...decision.options].sort((a, b) => b.score - a.score);
  const [primary, ...rest] = sorted;
  return { primary, alternatives: rest.slice(0, 2) };
}

function determineReason(focusMomentum: number, volatility: number): string {
  const highMomentum = focusMomentum >= 0.7;
  const lowMomentum = focusMomentum <= 0.35;
  const lowVolatility = volatility <= 0.25;
  const highVolatility = volatility >= 0.6;

  if (highMomentum && lowVolatility) {
    return "stable focus, deepening current trajectory";
  }

  if (lowMomentum && highVolatility) {
    return "fragmented focus, suggesting soft shift";
  }

  if (focusMomentum >= 0.5 && !lowVolatility) {
    return "growing momentum with some fluctuation, proposing careful step";
  }

  return "momentum stabilizing, holding current guidance";
}

function fallbackVolatility(decision: RoutingDecision): number {
  if (!decision.options.length) return 0;
  const scores = decision.options.map((option) => option.score);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const spread = maxScore - minScore;
  return Number(spread.toFixed(3));
}

function softenSector(sector: string): string {
  if (sector.includes("deep_work")) return "light_work";
  if (sector.includes("planning")) return "light_work";
  if (sector.includes("social")) return "planning";
  return sector;
}

function resolveRestSector(options: RoutingDecisionOption[]): string {
  const restLike = options.find((option) => option.sector.includes("rest"));
  if (restLike) return restLike.sector;
  return "rest";
}

function resolveExploreSector(options: RoutingDecisionOption[]): string {
  const exploreCandidate = options.find((option) =>
    ["planning", "learning", "social"].some((keyword) => option.sector.includes(keyword)),
  );
  return exploreCandidate?.sector ?? "planning";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeCommitmentFromMomentum(value?: number): number {
  const normalized = ((value ?? 0) + 1) / 2;
  return clamp(Number(normalized.toFixed(3)), 0, 1);
}

function normalizeLikelihoods(weights: { id: string; weight: number }[]): Record<string, number> {
  const total = weights.reduce((sum, item) => sum + item.weight, 0) || 1;
  return weights.reduce<Record<string, number>>((acc, item) => {
    acc[item.id] = Number((item.weight / total).toFixed(3));
    return acc;
  }, {});
}

export function chooseTurtleFrameFromTimeWeave(
  summary: TimeWeaveSummary,
  focusMomentum?: number,
): TurtleFrameId {
  const futureBias = summary.futureBias ?? 0;
  const familyWeight = summary.familyWeight ?? 0;
  const regulationSignal = summary.regulationSignal ?? 0;
  const divergenceScore = summary.divergenceScore ?? 0;

  if (familyWeight >= Math.max(futureBias, regulationSignal, divergenceScore) && familyWeight > 0.45) {
    return "family_field";
  }

  if (futureBias > 0.55) {
    return "deep_time";
  }

  if (regulationSignal > 0.55 || divergenceScore > 0.6 || (focusMomentum ?? 0) < -0.2) {
    return "regulation_axis";
  }

  if ((focusMomentum ?? 0) > 0.65) {
    return "inner_focus";
  }

  return "baseline";
}

function describePrimaryLabel(focusMomentum: number, volatility: number): string {
  const positiveMomentum = focusMomentum >= 0.6;
  const moderateMomentum = focusMomentum >= 0.35;
  const lowVolatility = volatility <= 0.3;

  if (positiveMomentum && lowVolatility) return "stabilize";
  if (moderateMomentum && lowVolatility) return "grow";
  if (moderateMomentum) return "soft-shift";
  return "stabilize";
}

function resolveMomentumHint(currentMomentum: number, targetMomentum: number):
  | "rising"
  | "stable"
  | "falling" {
  const delta = targetMomentum - currentMomentum;
  if (delta > 0.05) return "rising";
  if (delta < -0.05) return "falling";
  return "stable";
}

function resolveVolatilityHint(value: number): "low" | "mid" | "high" {
  if (value <= 0.25) return "low";
  if (value <= 0.6) return "mid";
  return "high";
}

function collectSoftenedSectors(path: FutureWeavePath): string[] {
  const seen = new Set<string>();
  path.nodes.forEach((node) => {
    if (node.sectorId) {
      seen.add(node.sectorId);
    }
  });
  return Array.from(seen);
}

export function attachTurtleSnapshotToOrientation(params: {
  orientation: TemporalOrientationView;
  timeWeaveSummary?: TimeWeaveSummary;
  focusMomentumOverride?: number;
}): TemporalOrientationView {
  const { orientation, timeWeaveSummary, focusMomentumOverride } = params;
  if (!timeWeaveSummary) return { ...orientation };

  const focusMomentum = focusMomentumOverride ?? orientation.focusMomentum;
  const baseMatrix = createDefaultTurtleMatrix();
  const targetFrame = chooseTurtleFrameFromTimeWeave(timeWeaveSummary, focusMomentum);
  const orientedMatrix = rotateTurtleMatrix(baseMatrix, {
    targetFrame,
    commitment: normalizeCommitmentFromMomentum(focusMomentum),
  });

  return { ...orientation, turtle: buildTurtleSnapshot(orientedMatrix) };
}

export function buildMultiPathSuggestion(
  orientation: TemporalOrientationView,
  routing: RoutingDecision,
): MultiPathSuggestion {
  const { primary } = selectPrimaryAndAlternatives(routing);
  const primarySector = primary?.sector ?? orientation.currentSector ?? "unknown";
  const baseMomentum = orientation.focusMomentum ?? 0;
  const volatility = orientation.volatility ?? 0;

  const primaryLabel = describePrimaryLabel(baseMomentum, volatility);

  const baseOffset = 5 * 60 * 1000;
  const soften = softenSector(primarySector);
  const needsSofterStep = baseMomentum < 0.45 || volatility > 0.4;
  const nodeCount = baseMomentum > 0.55 && volatility < 0.35 ? 3 : 2;

  const primaryNodes: FutureWeaveNode[] = [];

  primaryNodes.push({
    id: "P0",
    sectorId: orientation.currentSector ?? primarySector,
    timeOffsetMs: baseOffset,
    expectedFocusMomentum: clamp(baseMomentum - volatility * 0.1, -1, 1),
    volatilityHint: clamp(volatility * 0.95, 0, 1),
    likelihood: 0.7,
  });

  const nextSector = needsSofterStep ? soften : primarySector;
  primaryNodes.push({
    id: "P1",
    sectorId: nextSector,
    timeOffsetMs: baseOffset * 2,
    expectedFocusMomentum: clamp(baseMomentum + (needsSofterStep ? 0.05 : 0.1), -1, 1),
    volatilityHint: clamp(volatility * (needsSofterStep ? 0.85 : 0.75), 0, 1),
    likelihood: 0.6,
  });

  if (nodeCount === 3) {
    primaryNodes.push({
      id: "P2",
      sectorId: nextSector,
      timeOffsetMs: baseOffset * 3,
      expectedFocusMomentum: clamp(primaryNodes[1].expectedFocusMomentum + 0.05, -1, 1),
      volatilityHint: clamp(primaryNodes[1].volatilityHint * 0.9, 0, 1),
      likelihood: 0.55,
    });
  }

  const recoverTarget = resolveRestSector(routing.options);
  const exploreTarget = resolveExploreSector(routing.options);

  const recoverPath: FutureWeavePath = {
    pathId: "recover",
    label: "recover",
    narrativeHint: "soft landing into rest/grounding",
    nodes: [
      {
        id: "R0",
        sectorId: orientation.currentSector,
        timeOffsetMs: baseOffset,
        expectedFocusMomentum: clamp(baseMomentum - 0.1, -1, 1),
        volatilityHint: clamp(volatility * 0.9 + 0.05, 0, 1),
        likelihood: 0.5,
      },
      {
        id: "R1",
        sectorId: recoverTarget,
        timeOffsetMs: baseOffset * 2,
        expectedFocusMomentum: clamp(baseMomentum + 0.05, -1, 1),
        volatilityHint: clamp(volatility * 0.8, 0, 1),
        likelihood: 0.45,
      },
    ],
    overallLikelihood: 0,
  };

  const explorePath: FutureWeavePath = {
    pathId: "explore",
    label: "explore",
    narrativeHint: "probe lighter social/planning spaces",
    nodes: [
      {
        id: "E0",
        sectorId: orientation.currentSector,
        timeOffsetMs: baseOffset,
        expectedFocusMomentum: clamp(baseMomentum, -1, 1),
        volatilityHint: clamp(volatility, 0, 1),
        likelihood: 0.45,
      },
      {
        id: "E1",
        sectorId: exploreTarget,
        timeOffsetMs: baseOffset * 2,
        expectedFocusMomentum: clamp(baseMomentum + 0.05, -1, 1),
        volatilityHint: clamp(volatility * 0.85, 0, 1),
        likelihood: 0.4,
      },
    ],
    overallLikelihood: 0,
  };

  const primaryWeight = Math.max(primary?.score ?? 0.55, 0.55);
  const recoverWeight = 0.25 + volatility * 0.25 + (baseMomentum < 0 ? 0.1 : 0);
  const exploreWeight = 0.2 + (baseMomentum > 0 ? 0.05 : 0);

  const adjustedPrimaryWeight = Math.max(primaryWeight, Math.max(recoverWeight, exploreWeight) + 0.05);
  const likelihoods = normalizeLikelihoods([
    { id: "primary", weight: adjustedPrimaryWeight },
    { id: "recover", weight: recoverWeight },
    { id: "explore", weight: exploreWeight },
  ]);

  const primaryPath: FutureWeavePath = {
    pathId: "primary",
    label: primaryLabel,
    nodes: primaryNodes,
    overallLikelihood: likelihoods.primary,
    narrativeHint: primaryLabel === "stabilize" ? "hold trajectory" : "grow with soft shift",
  };

  recoverPath.overallLikelihood = likelihoods.recover;
  explorePath.overallLikelihood = likelihoods.explore;

  const resolveBranchRole = (pathId: string): FutureWeaveBranchRole => {
    if (pathId === "primary") return "primary";
    if (pathId === "recover") return "recovery";
    if (pathId === "explore") return "explore";
    return pathId as FutureWeaveBranchRole;
  };

  const createBranch = (path: FutureWeavePath): FutureWeaveBranch => {
    const lastNode = path.nodes[path.nodes.length - 1] ?? path.nodes[0];
    const targetMomentum = lastNode?.expectedFocusMomentum ?? baseMomentum;
    const volatilityHint = resolveVolatilityHint(lastNode?.volatilityHint ?? volatility);
    return {
      id: path.pathId,
      role: resolveBranchRole(path.pathId),
      label: path.label,
      likelihood: path.overallLikelihood,
      momentumHint: resolveMomentumHint(baseMomentum, targetMomentum),
      volatilityHint,
      softenedSectors: collectSoftenedSectors(path),
    };
  };

  const alternates: FutureWeavePath[] = [recoverPath, explorePath];
  const branches: FutureWeaveBranch[] = [createBranch(primaryPath), ...alternates.map(createBranch)];

  return {
    primaryPath,
    alternates,
    branches,
  };
}

export function buildRoutingPreview(params: {
  snapshot: FocusSnapshot;
  routingDecision: RoutingDecision;
  volatilityScore: number;
}): RoutingPreview {
  const { snapshot, routingDecision, volatilityScore } = params;
  const { primary, alternatives } = selectPrimaryAndAlternatives(routingDecision);

  const currentSector = snapshot.sector ?? "?";
  const primaryNextSector = primary?.sector ?? currentSector;
  const alternativeSectors = alternatives.map((option) => option.sector).slice(0, 2);
  const focusMomentum = snapshot.focusMomentum ?? 0;
  const volatility = Number((volatilityScore || fallbackVolatility(routingDecision)).toFixed(3));
  const reason = determineReason(focusMomentum, volatility);

  return {
    currentSector,
    primaryNextSector,
    alternativeSectors,
    focusMomentum,
    volatility,
    reason,
  };
}
