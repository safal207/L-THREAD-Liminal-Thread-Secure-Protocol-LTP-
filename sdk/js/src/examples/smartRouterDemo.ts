import type {
  TemporalOrientationSummary,
  TemporalOrientationView,
  TemporalTrend,
  SectorTemporalSnapshot,
} from '../temporalOrientation/temporalOrientationTypes';
import type { OrientationWeb } from '../orientation/orientationWeb.types';
import {
  buildRouteHintsFromOrientation,
  deriveEntropyFromOrientation,
  type RouteHint,
  type RoutingMode,
  type RoutingPriority,
} from '../routing/fuzzyRoutingEngine';
import { computeMomentumMetrics } from '../temporalOrientation/fuzzyMomentum';
import { computeAsymmetryMeta } from '../time/timeWeaveAsymmetry';
import type { TimeWeaveHistory } from '../time/timeWeaveTypes';

interface DemoClientState {
  id: string;
  description: string;
  recentEvents: string[];
  timeWeaveDepthScore: number;
  focusMomentumScore: number;
}

const demoClients: DemoClientState[] = [
  {
    id: 'client-1',
    description: 'Founder in high focus, building new system',
    recentEvents: ['shipped new feature', 'got strong insight', 'feels momentum'],
    timeWeaveDepthScore: 0.85,
    focusMomentumScore: 0.6,
  },
  {
    id: 'client-2',
    description: 'Operator juggling contexts, momentum shaky',
    recentEvents: ['context switching', 'priorities unclear', 'needs consolidation'],
    timeWeaveDepthScore: 0.55,
    focusMomentumScore: -0.1,
  },
  {
    id: 'client-3',
    description: 'Stuck loop, low momentum and shallow depth',
    recentEvents: ['busywork', 'low clarity', 'seeking direction'],
    timeWeaveDepthScore: 0.25,
    focusMomentumScore: 0.05,
  },
];

function buildDemoOrientationWeb(): OrientationWeb {
  const sectors = {
    'N-Future-Expansion': {
      id: 'N-Future-Expansion',
      tension: 0.35,
      pull: 0.65,
      resonance: 0.7,
      phase: 'rising',
    },
    'S-Past-Integration': {
      id: 'S-Past-Integration',
      tension: 0.25,
      pull: 0.35,
      resonance: 0.45,
      phase: 'stable',
    },
    'E-External-Context': {
      id: 'E-External-Context',
      tension: 0.4,
      pull: 0.4,
      resonance: 0.5,
      phase: 'stable',
    },
    'W-Inner-Reflection': {
      id: 'W-Inner-Reflection',
      tension: 0.3,
      pull: 0.25,
      resonance: 0.55,
      phase: 'falling',
    },
  } as const;

  return {
    sectors,
    activeSectorId: 'N-Future-Expansion',
  };
}

function deriveTrendFromMomentum(m: number): TemporalTrend {
  if (m > 0.25) return 'rising';
  if (m < -0.25) return 'falling';
  if (Math.abs(m) < 0.05) return 'plateau';
  return 'mixed';
}

function buildSnapshots(
  web: OrientationWeb,
  depthScore: number,
  focusMomentumScore: number,
): SectorTemporalSnapshot[] {
  const trend = deriveTrendFromMomentum(focusMomentumScore);
  const sectorIds = Object.keys(web.sectors);

  return sectorIds.map((sectorId, index) => {
    const sector = web.sectors[sectorId];
    if (!sector) {
      throw new Error(`Sector not found in orientation web: ${sectorId}`);
    }
    const intensityBase = Math.max(0, Math.min(1, depthScore - index * 0.1 + 0.2));
    const branchTrend: TemporalTrend = index === 0 ? trend : index === sectorIds.length - 1 ? 'plateau' : 'mixed';

    return {
      sectorId,
      branchId: sector.id,
      lastTick: undefined,
      lastIntensity: intensityBase,
      branchTrend,
      isActive: intensityBase > 0.3,
      sourceSector: sector,
    };
  });
}

function buildDemoOrientationViewFromClient(
  client: DemoClientState,
  momentumOverride?: number,
): TemporalOrientationView {
  const web = buildDemoOrientationWeb();
  const focusMomentumScore = typeof momentumOverride === 'number' ? momentumOverride : client.focusMomentumScore;
  const sectors = buildSnapshots(web, client.timeWeaveDepthScore, focusMomentumScore);

  const risingSectors = sectors.filter((snapshot) => snapshot.branchTrend === 'rising').map((snapshot) => snapshot.sectorId);
  const fallingSectors = sectors
    .filter((snapshot) => snapshot.branchTrend === 'falling')
    .map((snapshot) => snapshot.sectorId);
  const plateauSectors = sectors
    .filter((snapshot) => snapshot.branchTrend === 'plateau')
    .map((snapshot) => snapshot.sectorId);

  const summary: TemporalOrientationSummary = {
    globalTrend: deriveTrendFromMomentum(focusMomentumScore),
    activeSectorCount: sectors.filter((snapshot) => snapshot.isActive).length,
    risingSectors,
    fallingSectors,
    plateauSectors,
    timeWeaveDepthScore: client.timeWeaveDepthScore,
    focusMomentumScore,
  };

  return {
    web,
    sectors,
    summary,
  };
}

function buildDemoHistoryFromClient(client: DemoClientState): TemporalOrientationView[] {
  const momentumSeries: Record<string, number[]> = {
    'client-1': [0.25, 0.45, client.focusMomentumScore],
    'client-2': [0.15, -0.05, 0.12, client.focusMomentumScore],
    'client-3': [0.3, 0.15, client.focusMomentumScore],
  };

  const series = momentumSeries[client.id] ?? [client.focusMomentumScore];

  return series.map((momentumValue) => buildDemoOrientationViewFromClient(client, momentumValue));
}

function buildAsymmetryHistoryFromOrientationHistory(history: TemporalOrientationView[]): TimeWeaveHistory {
  const baseTimestamp = Date.now();
  const segments = history.map((snapshot, index) => {
    const bias = snapshot.summary.focusMomentumScore ?? 0;
    const magnitude = Math.abs(bias);
    const stepCount = Math.max(snapshot.summary.activeSectorCount ?? 1, 1);

    return {
      bias,
      asymmetryMagnitude: magnitude,
      stepCount,
      timestampMs: baseTimestamp + index * 1000,
    } satisfies TimeWeaveHistory['segments'][number];
  });

  return { segments } satisfies TimeWeaveHistory;
}

const priorityOrder: RoutingPriority[] = ['high', 'normal', 'low'];
const modeOrder: RoutingMode[] = ['exploit', 'explore', 'stabilize'];

export function pickBestRouteHint(hints: RouteHint[]): RouteHint | null {
  if (hints.length === 0) {
    return null;
  }

  const sorted = [...hints].sort((a, b) => {
    const priorityDiff = priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const modeDiff = modeOrder.indexOf(a.mode) - modeOrder.indexOf(b.mode);
    if (modeDiff !== 0) {
      return modeDiff;
    }

    return 0;
  });

  const best = sorted[0];

  return best ?? null;
}

function formatEvents(events: string[]): string {
  return events.map((event) => `- ${event}`).join('\n');
}

export function runSmartRouterDemo(): void {
  demoClients.forEach((client) => {
    const history = buildDemoHistoryFromClient(client);
    const view = history[history.length - 1] ?? buildDemoOrientationViewFromClient(client);
    const momentum = computeMomentumMetrics(history.length > 0 ? history : [view]);
    const asymmetryHistory = buildAsymmetryHistoryFromOrientationHistory(history.length > 0 ? history : [view]);
    const asymmetryMeta = computeAsymmetryMeta(asymmetryHistory, { maxSteps: 40, maxSpanMs: 60_000 });
    const entropyLevel = deriveEntropyFromOrientation(view);
    const hints = buildRouteHintsFromOrientation(view, {
      history: history.length > 0 ? history : [view],
      asymmetryMeta,
    });
    const best = pickBestRouteHint(hints);

    console.log(`===== Client: ${client.id} =====`);
    console.log('Description:', client.description);
    console.log('Recent events:\n' + formatEvents(client.recentEvents));
    console.log(
      'Depth:',
      client.timeWeaveDepthScore.toFixed(2),
      'Momentum:',
      client.focusMomentumScore.toFixed(2),
    );
    console.log('Asym depth:', asymmetryMeta.depthScore.toFixed(2), 'Softness:', asymmetryMeta.softAsymmetryIndex.toFixed(2));
    console.log('Momentum slope/strength:', momentum.slope, momentum.strength.toFixed(2));
    console.log('Total sectors:', hints.length);
    console.log('Entropy level:', entropyLevel.toFixed(2));

    if (!best) {
      console.log('No routing hint available.\n');
      return;
    }

    console.log('→ Suggested sector:', best.sectorId);
    console.log('  Priority:', best.priority);
    console.log('  Mode:', best.mode);
    console.log('  Confidence:', best.routeConfidence.toFixed(2));
    console.log('  Reason:', best.reason);
    console.log();
  });
}

if (require.main === module) {
  runSmartRouterDemo();
}

export { demoClients, buildDemoOrientationViewFromClient };
