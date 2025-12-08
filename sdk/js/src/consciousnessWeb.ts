import { ThreadVector } from './threadLifeModel.types';
import {
  ConsciousnessWeb,
  OrientationSector,
  OrientationShell,
  ThreadLink,
  WebNodeMetrics,
} from './consciousnessWeb.types';
import type { ThreadMap } from './threadLifeModel.types';

function clampScore(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
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
