import {
  appendNodeToBranch,
  computeTimeWeaveSummary,
  createEmptyWeave,
  summarizeWeave,
} from '../time/timeWeave';
import { computeTimeWeaveMeta } from '../time/timeWeaveMeta';
import type { TimePhase, TimeWeave, TimeWeaveMeta, TimeWeaveSummary, TimeWeaveTrendSummary } from '../time/timeWeaveTypes';
import { buildTemporalOrientationView } from '../temporalOrientation/temporalOrientationEngine';
import type { TemporalOrientationView } from '../temporalOrientation/temporalOrientationTypes';
import {
  createOrientationWeb,
  updateActiveSector,
} from '../orientation/orientationWeb';
import type { OrientationWeb, OrientationWebSector } from '../orientation/orientationWeb.types';

export interface CanonicalFlowInput {
  now: string;
  focus: { signal: string; momentum: number };
  context: { pressure: 'low' | 'medium' | 'high' | string; historyDepth: number };
  threadsHint: { id: string; energy: number }[];
}

export interface CanonicalOption {
  path: string;
  cost: number;
  gain: number;
  explanation: string;
}

export interface CanonicalFlowResult {
  temporalOrientation: TemporalOrientationView;
  threads: { id: string; energy: number; resonance: number; phase: OrientationWebSector['phase'] }[];
  options: CanonicalOption[];
  message: string;
  note: string;
  suggestion: string;
  meta: {
    timeWeave: {
      depth: TimeWeaveMeta['depth'];
      trend: TimeWeaveTrendSummary;
      summary: TimeWeaveSummary;
    };
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function derivePhase(momentum: number): OrientationWebSector['phase'] {
  if (momentum > 0.15) return 'rising';
  if (momentum < -0.15) return 'falling';
  return 'stable';
}

function mapPressure(pressure: CanonicalFlowInput['context']['pressure']): number {
  if (pressure === 'high') return 0.8;
  if (pressure === 'medium') return 0.5;
  if (pressure === 'low') return 0.2;
  return 0.4;
}

function pickPhaseFromEnergy(energy: number, momentum: number): TimePhase {
  if (energy > 0.7 && momentum > 0) return 'emerging';
  if (energy > 0.5) return 'stable';
  if (momentum < -0.1) return 'declining';
  return 'dormant';
}

function buildOrientationWeb(input: CanonicalFlowInput): OrientationWeb {
  const pressureWeight = mapPressure(input.context.pressure);
  const basePhase = derivePhase(input.focus.momentum);

  const sectors = input.threadsHint.reduce<OrientationWeb['sectors']>((acc, thread) => {
    const resonance = clamp01(thread.energy);
    const pull = clamp01(thread.energy * 0.7 + pressureWeight * 0.2 + input.focus.momentum * 0.1);
    const tension = clamp01(pressureWeight * 0.6 + (input.focus.signal === 'scattered' ? 0.2 : 0));

    acc[thread.id] = {
      id: thread.id,
      tension,
      pull,
      resonance,
      phase: basePhase,
    } satisfies OrientationWebSector;

    return acc;
  }, {});

  const web = createOrientationWeb(
    input.threadsHint.map((thread) => thread.id),
    {
      sectors,
      activeSectorId: input.threadsHint[0]?.id ?? 'root',
    },
  );

  return updateActiveSector(web);
}

function buildWeaveFromHints(input: CanonicalFlowInput): TimeWeave {
  const weave = createEmptyWeave();
  const pressureWeight = mapPressure(input.context.pressure);

  return input.threadsHint.reduce<TimeWeave>((acc, thread, index) => {
    const base = clamp01(thread.energy * 0.6 + input.context.historyDepth * 0.3 + 0.1);
    const momentumAdjustment = clamp01(0.5 + input.focus.momentum * 0.25) - 0.5;
    const intensityA = clamp01(base + momentumAdjustment * 0.5);
    const intensityB = clamp01(intensityA + (index % 2 === 0 ? 0.05 : -0.05));

    const nodePhase = pickPhaseFromEnergy(thread.energy, input.focus.momentum);

    const nextWeave = appendNodeToBranch(acc, thread.id, {
      id: `${thread.id}-anchor-a`,
      tick: `${input.now}-a`,
      intensity: intensityA,
      phase: nodePhase,
    });

    const withSecondNode = appendNodeToBranch(nextWeave, thread.id, {
      id: `${thread.id}-anchor-b`,
      tick: `${input.now}-b`,
      intensity: clamp01(intensityB + pressureWeight * 0.1),
      phase: nodePhase,
    });

    return withSecondNode;
  }, weave);
}

function buildOptions(view: TemporalOrientationView): CanonicalOption[] {
  const dominant = view.summary.risingSectors[0] ?? view.web.activeSectorId;
  const secondary = view.summary.plateauSectors[0] ?? view.summary.fallingSectors[0] ?? dominant;
  const depthScore = view.summary.timeWeaveDepthScore ?? 0;
  const momentum = view.summary.focusMomentumScore ?? 0;

  const normalizedDepth = clamp01(depthScore);
  const normalizedMomentum = clamp01((momentum + 1) / 2);

  return [
    {
      path: `deepening:${dominant}`,
      cost: Number((0.4 + (1 - normalizedDepth) * 0.2).toFixed(2)),
      gain: Number((0.6 + normalizedDepth * 0.3).toFixed(2)),
      explanation: 'Stay with the dominant thread to consolidate the current weave.',
    },
    {
      path: 'pause:stabilize',
      cost: Number((0.15 + normalizedMomentum * 0.1).toFixed(2)),
      gain: Number((0.35 + (1 - normalizedMomentum) * 0.2).toFixed(2)),
      explanation: 'Hold position to let tension settle; re-evaluate after a short pause.',
    },
    {
      path: `switch-context:${secondary}`,
      cost: Number((0.3 + normalizedDepth * 0.1).toFixed(2)),
      gain: Number((0.45 + (1 - normalizedMomentum) * 0.25).toFixed(2)),
      explanation: 'Redirect attention to a neighboring thread to refresh orientation.',
    },
  ];
}

function formatMessage(view: TemporalOrientationView): string {
  const trend = view.summary.globalTrend;
  const momentum = view.summary.focusMomentumScore ?? 0;
  const depth = view.summary.timeWeaveDepthScore ?? 0;
  return `Temporal trend ${trend}; focus momentum ${momentum.toFixed(2)} with depth ${depth.toFixed(2)}.`;
}

function buildSuggestion(view: TemporalOrientationView, options: CanonicalOption[]): string {
  const rising = view.summary.risingSectors[0];
  if (rising) {
    return `Bias towards ${rising}; it shows the cleanest upward signal.`;
  }

  return options[0]?.explanation ?? 'Hold steady; signals are quiet.';
}

function printReport(result: CanonicalFlowResult): void {
  const { temporalOrientation: view, threads, options, note, suggestion, message } = result;
  const header = '=== LTP Canonical Flow ===';

  const temporalSummary = `Orientation: ${view.summary.globalTrend} | Active sectors: ${view.summary.activeSectorCount} | Momentum: ${
    view.summary.focusMomentumScore?.toFixed(2) ?? '0.00'
  }`;

  const threadLines = threads
    .slice(0, 3)
    .map((thread) => ` - ${thread.id}: energy ${thread.energy.toFixed(2)}, resonance ${thread.resonance.toFixed(2)}`)
    .join('\n');

  const optionLines = options
    .map((option) => ` * ${option.path}: gain ${option.gain.toFixed(2)}, cost ${option.cost.toFixed(2)} — ${option.explanation}`)
    .join('\n');

  const report = [header, temporalSummary, 'Top threads:', threadLines, 'Options:', optionLines, `Note: ${note}`, `Suggestion: ${suggestion}`, message]
    .filter(Boolean)
    .join('\n');

  // eslint-disable-next-line no-console
  console.log(report);
}

export function canonicalFlow(input: CanonicalFlowInput): CanonicalFlowResult {
  const orientationWeb = buildOrientationWeb(input);
  const weave = buildWeaveFromHints(input);
  const temporalOrientation = buildTemporalOrientationView(orientationWeb, weave);
  const options = buildOptions(temporalOrientation);
  const message = formatMessage(temporalOrientation);
  const suggestion = buildSuggestion(temporalOrientation, options);
  const note = 'No optimal path exists.';

  const weaveMeta = computeTimeWeaveMeta(weave);
  const weaveSummary = computeTimeWeaveSummary(weave);
  const weaveTrend = summarizeWeave(weave);
  const meta = {
    timeWeave: {
      depth: weaveMeta.depth,
      trend: weaveTrend,
      summary: weaveSummary,
    },
  };

  const result: CanonicalFlowResult = {
    temporalOrientation,
    threads: Object.values(orientationWeb.sectors).map((sector) => ({
      id: sector.id,
      energy: input.threadsHint.find((item) => item.id === sector.id)?.energy ?? 0,
      resonance: sector.resonance,
      phase: sector.phase,
    })),
    options,
    message,
    note,
    suggestion,
    meta,
  };

  printReport(result);
  return result;
}

export function buildCanonicalInput(): CanonicalFlowInput {
  return {
    now: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    focus: { signal: 'scattered', momentum: -0.12 },
    context: { pressure: 'medium', historyDepth: 0.63 },
    threadsHint: [
      { id: 'old-work', energy: 0.22 },
      { id: 'new-protocol', energy: 0.67 },
      { id: 'family', energy: 0.81 },
    ],
  } satisfies CanonicalFlowInput;
}

if (require.main === module) {
  canonicalFlow(buildCanonicalInput());
}
