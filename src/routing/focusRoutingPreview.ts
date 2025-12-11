export interface FocusSnapshot {
  sector?: string;
  focusMomentum?: number;
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

  if (focusMomentum >= 0.5 && volatility > lowVolatility) {
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
