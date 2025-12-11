import { ThreadVector } from './threadLifeModel.types';
import {
  ConsciousnessWeb,
  OrientationSector,
  OrientationShell,
  ThreadLink,
  WebNodeMetrics,
  type ConsciousnessSnapshot,
  type ConsciousnessZone,
  type FuturePath,
  type TimeAnchor,
} from './consciousnessWeb.types';
import { summarizeThreadMap } from './threadLifeModel';
import type { ThreadMap } from './threadLifeModel.types';

function clampScore(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function normalizeProbabilities(paths: FuturePath[]): number[] {
  if (!paths.length) return [];
  const total = paths.reduce((sum, path) => sum + (path.probability > 0 ? path.probability : 0), 0) || 1;
  return paths.map((path, idx) => {
    if (idx === paths.length - 1) {
      const soFar = paths
        .slice(0, idx)
        .reduce((sum, existing) => sum + clampScore(existing.probability), 0);
      return clampScore(1 - soFar);
    }
    return clampScore(path.probability / total);
  });
}

const ZONE_ROLE_ORDER: ConsciousnessZone[] = ['storm', 'shift', 'growth', 'recovery', 'calm'];

function normalizeFuturePaths(paths: FuturePath[]): FuturePath[] {
  const normalized = [...paths];
  const percents = normalizeProbabilities(normalized);
  return normalized
    .map((path, idx) => ({ ...path, probability: percents[idx] ?? 0 }))
    .sort((a, b) => {
      const roleOrder: Record<string, number> = { primary: 0, recover: 1, explore: 2 };
      const roleDiff = (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
      if (roleDiff !== 0) return roleDiff;
      const zoneDiff = ZONE_ROLE_ORDER.indexOf(a.path[0] as ConsciousnessZone) - ZONE_ROLE_ORDER.indexOf(b.path[0] as ConsciousnessZone);
      if (!Number.isNaN(zoneDiff) && zoneDiff !== 0) return zoneDiff;
      return b.probability - a.probability;
    });
}

function createParentChildLinks(threads: ThreadVector[]): ThreadLink[] {
  const threadIds = new Set(threads.map((thread) => thread.threadId));
  return threads.flatMap((thread) => {
    if (!thread.parentThreadId || !threadIds.has(thread.parentThreadId)) {
      return [];
    }
    return [
      {
        fromId: thread.parentThreadId,
        toId: thread.threadId,
        kind: 'parent-child',
        weight: 1,
      } satisfies ThreadLink,
    ];
  });
}

function createSharedScopeLinks(threads: ThreadVector[]): ThreadLink[] {
  const links: ThreadLink[] = [];
  for (let i = 0; i < threads.length; i += 1) {
    const first = threads[i];
    if (!first) continue;
    for (let j = i + 1; j < threads.length; j += 1) {
      const second = threads[j];
      if (!second) continue;
      if (first.scope === second.scope) {
        links.push({
          fromId: first.threadId,
          toId: second.threadId,
          kind: 'shared-scope',
          weight: 0.4,
        });
      }
    }
  }
  return links;
}

function createSharedTagLinks(threads: ThreadVector[]): ThreadLink[] {
  const links: ThreadLink[] = [];
  for (let i = 0; i < threads.length; i += 1) {
    const first = threads[i];
    if (!first) continue;
    for (let j = i + 1; j < threads.length; j += 1) {
      const second = threads[j];
      if (!second) continue;
      const tagsA = first.tags || [];
      const tagsB = second.tags || [];
      const overlap = tagsA.some((tag) => tagsB.includes(tag));
      if (overlap) {
        links.push({
          fromId: first.threadId,
          toId: second.threadId,
          kind: 'shared-tag',
          weight: 0.6,
        });
      }
    }
  }
  return links;
}

function computeMetrics(threads: ThreadVector[], links: ThreadLink[]): WebNodeMetrics[] {
  const degreeMap = new Map<string, number>();

  for (const link of links) {
    degreeMap.set(link.fromId, (degreeMap.get(link.fromId) ?? 0) + 1);
    degreeMap.set(link.toId, (degreeMap.get(link.toId) ?? 0) + 1);
  }

  const maxDegree = Math.max(1, ...degreeMap.values());

  return threads.map((thread) => {
    const degree = degreeMap.get(thread.threadId) ?? 0;
    const degreeScore = degree / maxDegree;
    const centralityScore = clampScore(degreeScore * 0.5 + thread.energyLevel * 0.25 + thread.resonanceLevel * 0.25);

    return {
      threadId: thread.threadId,
      energyLevel: thread.energyLevel,
      resonanceLevel: thread.resonanceLevel,
      degree,
      centralityScore,
    } satisfies WebNodeMetrics;
  });
}

export function buildConsciousnessWeb(map: ThreadMap): ConsciousnessWeb {
  const parentChildLinks = createParentChildLinks(map.threads);
  const sharedScopeLinks = createSharedScopeLinks(map.threads);
  const sharedTagLinks = createSharedTagLinks(map.threads);

  const links = [...parentChildLinks, ...sharedScopeLinks, ...sharedTagLinks];
  const metrics = computeMetrics(map.threads, links);

  return {
    ownerId: map.ownerId,
    threads: map.threads,
    links,
    metrics,
  };
}

export function createDefaultOrientationShell(): OrientationShell {
  const sectors: OrientationSector[] = [
    { id: 'scope-individual', label: 'Individual focus', scope: 'individual' },
    { id: 'scope-family', label: 'Family field', scope: 'family' },
    { id: 'scope-project', label: 'Project and initiatives', scope: 'project' },
    { id: 'scope-system', label: 'System / protocol level', scope: 'system' },
    {
      id: 'tag-liminal-os',
      label: 'Liminal OS threads',
      requiredTags: ['liminal-os'],
    },
  ];

  return {
    sectors,
    activeSectorIds: sectors.map((sector) => sector.id),
  };
}

function matchesSector(thread: ThreadVector, sector: OrientationSector): boolean {
  const scopeMatches = sector.scope ? thread.scope === sector.scope : false;
  const tagMatches = sector.requiredTags?.length
    ? (thread.tags || []).some((tag) => sector.requiredTags?.includes(tag))
    : false;
  return scopeMatches || tagMatches;
}

export function orientWeb(
  web: ConsciousnessWeb,
  shell: OrientationShell
): { activeThreads: ThreadVector[]; dormantThreads: ThreadVector[] } {
  const activeSectors = shell.sectors.filter((sector) => shell.activeSectorIds.includes(sector.id));

  const activeThreadIds = new Set<string>();
  for (const thread of web.threads) {
    if (activeSectors.some((sector) => matchesSector(thread, sector))) {
      activeThreadIds.add(thread.threadId);
    }
  }

  const activeThreads = web.threads.filter((thread) => activeThreadIds.has(thread.threadId));
  const dormantThreads = web.threads.filter((thread) => !activeThreadIds.has(thread.threadId));

  return { activeThreads, dormantThreads };
}

export function buildConsciousnessSnapshot(params: {
  orientation: ConsciousnessZone;
  focusMomentum?: number;
  volatility?: number;
  resilience?: number;
  tension?: number;
  turbulenceZones?: ConsciousnessZone[];
  timeAnchors?: TimeAnchor[];
  futurePaths?: FuturePath[];
  web?: ConsciousnessWeb;
}): ConsciousnessSnapshot {
  const { orientation, web } = params;
  const summary = web ? summarizeThreadMap(web) : undefined;

  const focusMomentum = clampScore(params.focusMomentum ?? summary?.averageEnergy ?? 0.5);
  const volatility = clampScore(params.volatility ?? summary?.volatility ?? 0.5);
  const resilience = clampScore(params.resilience ?? summary?.averageResonance ?? 0.5);
  const tension = clampScore(params.tension ?? (volatility * (2 - resilience)) / 2);

  const futurePaths: FuturePath[] = normalizeFuturePaths(
    params.futurePaths ?? [
      { role: 'primary', label: 'Shift to Growth', path: ['storm', 'shift', 'growth'], probability: 0.44 },
      { role: 'recover', label: 'Stabilize Recovery', path: ['storm', 'recovery'], probability: 0.33 },
      { role: 'explore', label: 'Explore Calm', path: ['storm', 'growth', 'calm'], probability: 0.23 },
    ],
  );

  const timeAnchors: TimeAnchor[] =
    params.timeAnchors ??
    ([
      { offset: -3, label: 'stable', confidence: 0.92 },
      { offset: -2, label: 'rising tension', confidence: 0.81 },
      { offset: -1, label: 'storm onset', confidence: 0.74 },
      { offset: 1, label: 'possible shift', confidence: 0.74 },
    ] satisfies TimeAnchor[]);

  return {
    orientation,
    focusMomentum,
    volatility,
    resilience,
    tension,
    turbulenceZones: params.turbulenceZones ?? (volatility > 0.6 ? [orientation] : []),
    timeAnchors,
    futurePaths,
  } satisfies ConsciousnessSnapshot;
}
