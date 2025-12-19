import fs from 'node:fs';
import path from 'node:path';
import { BranchInsight, InspectSummary, LtpFrame } from './types';

type OutputFormat = 'text' | 'json' | 'both';

type ParsedArgs = {
  command: 'trace' | 'replay' | 'explain' | 'help';
  file?: string;
  format: OutputFormat;
  from?: string;
  branch?: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  const [command = 'help', file, ...rest] = argv;
  const options: Record<string, string | boolean> = {};

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === '--json') options.format = 'json';
    else if (token === '--text') options.format = 'text';
    else if (token === '--both') options.format = 'both';
    else if (token === '--from') options.from = rest[++i];
    else if (token === '--branch') options.branch = rest[++i];
  }

  return {
    command: (command as ParsedArgs['command']) ?? 'help',
    file,
    format: (options.format as OutputFormat) || 'json',
    from: options.from as string | undefined,
    branch: options.branch as string | undefined,
  };
}

function loadFrames(filePath: string): LtpFrame[] {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Frame log not found: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, 'utf-8').trim();
  if (!raw) return [];

  if (raw.startsWith('[')) {
    return JSON.parse(raw);
  }

  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function driftLevelFromSnapshots(frames: LtpFrame[]): InspectSummary['orientation']['drift_level'] {
  const driftValues = frames
    .filter((f) => f.type === 'focus_snapshot')
    .map((f) => (f.payload?.drift ?? f.payload?.drift_level ?? f.payload?.driftLevel) as number | string | undefined)
    .filter((v): v is number | string => v !== undefined);

  if (!driftValues.length) return 'unknown';

  const last = driftValues[driftValues.length - 1];
  if (typeof last === 'string') {
    const normalized = last.toLowerCase();
    if (['low', 'medium', 'high'].includes(normalized)) return normalized as InspectSummary['orientation']['drift_level'];
    return 'unknown';
  }

  if (last <= 0.33) return 'low';
  if (last <= 0.66) return 'medium';
  return 'high';
}

function detectContinuity(frames: LtpFrame[]): { preserved: boolean; notes: string[] } {
  const tokens = frames
    .map((f) => f.continuity_token)
    .filter((token): token is string => typeof token === 'string' && token.length > 0);

  const unique = new Set(tokens);
  if (unique.size <= 1) return { preserved: true, notes: [] };

  return {
    preserved: false,
    notes: ['continuity token rotation detected mid-session'],
  };
}

function normalizeBranches(raw: unknown): BranchInsight[] {
  if (!raw) return [];

  const branchesArray = Array.isArray(raw)
    ? raw
    : typeof raw === 'object'
      ? Object.entries(raw as Record<string, any>).map(([id, value]) => ({ id, ...(value as Record<string, unknown>) }))
      : [];

  const normalized: BranchInsight[] = [];

  for (const entry of branchesArray as Array<Record<string, any>>) {
    const id = (entry.id ?? entry.name ?? 'unnamed') as string;
    const confidence = entry.confidence as number | undefined;
    const status = (entry.status as string | undefined) ?? (entry.class === 'primary' ? 'admissible' : 'degraded');

    const branch: BranchInsight = {
      id,
      confidence,
      status,
      path: entry.path as string | undefined,
      class: entry.class as string | undefined,
    };

    normalized.push(branch);
  }

  return normalized.sort((a, b) => a.id.localeCompare(b.id));
}

function collectNotes(branches: BranchInsight[], baseNotes: string[]): string[] {
  const notes = [...baseNotes];

  for (const branch of branches) {
    if (branch.confidence === undefined) {
      notes.push(`branch ${branch.id} missing confidence (tooling MAY normalize)`);
    } else if (branch.confidence < 0 || branch.confidence > 1) {
      notes.push(`branch ${branch.id} confidence out of range [0,1]`);
    }
  }

  return notes;
}

function summarize(frames: LtpFrame[]): InspectSummary {
  const continuity = detectContinuity(frames);
  const driftLevel = driftLevelFromSnapshots(frames);
  const orientationStable = frames.some((f) => f.type === 'orientation');

  const lastRouteResponse = [...frames].reverse().find((f) => f.type === 'route_response');
  const branches = normalizeBranches(lastRouteResponse?.payload?.branches ?? lastRouteResponse?.payload?.routes ?? lastRouteResponse?.payload);

  const baseNotes = [
    ...(Array.isArray(lastRouteResponse?.payload?.notes) ? lastRouteResponse?.payload?.notes : []),
  ];
  if (!orientationStable) baseNotes.push('no orientation frame observed');
  if (!lastRouteResponse) baseNotes.push('no route_response frame observed');

  const notes = collectNotes(branches, baseNotes);

  return {
    version: '0.1',
    orientation: {
      stable: orientationStable,
      drift_level: driftLevel,
    },
    continuity: {
      preserved: continuity.preserved,
      notes: continuity.notes,
    },
    branches,
    notes,
  };
}

function printJson(summary: InspectSummary): void {
  console.log(JSON.stringify(summary, null, 2));
}

function printHuman(summary: InspectSummary): void {
  console.log('LTP INSPECT SUMMARY');
  console.log('-------------------');
  console.log(`Version: ${summary.version}`);
  console.log(`Orientation: ${summary.orientation.stable ? 'stable' : 'missing'}`);
  console.log(`Drift: ${summary.orientation.drift_level}`);
  console.log(`Continuity: ${summary.continuity.preserved ? 'preserved' : 'rotated'}`);
  if (summary.continuity.notes.length) {
    for (const note of summary.continuity.notes) console.log(`  note: ${note}`);
  }
  console.log('');
  console.log('Branches:');
  if (!summary.branches.length) {
    console.log('- none observed');
  } else {
    for (const b of summary.branches) {
      const suffix = b.confidence !== undefined ? ` (${b.confidence})` : ' (no confidence)';
      console.log(`- ${b.id}: ${b.status}${suffix}`);
    }
  }
  if (summary.notes.length) {
    console.log('');
    console.log('Notes:');
    for (const n of summary.notes) console.log(`- ${n}`);
  }
}

export function runInspect(file: string): InspectSummary {
  const frames = loadFrames(file);
  return summarize(frames);
}

function handleTrace(file: string, format: OutputFormat): void {
  const summary = runInspect(file);

  if (format === 'json') printJson(summary);
  else if (format === 'text') printHuman(summary);
  else {
    printJson(summary);
    console.log('');
    printHuman(summary);
  }
}

function handleReplay(file: string, from?: string): void {
  const frames = loadFrames(file);
  const startIndex = from ? frames.findIndex((f) => f.id === from || f.ts === from) : 0;
  const replayFrames = startIndex >= 0 ? frames.slice(startIndex) : frames;

  console.log(`Replaying ${replayFrames.length} frames${from ? ` from ${from}` : ''}...`);
  for (const frame of replayFrames) {
    const label = `${frame.type}${frame.id ? `#${frame.id}` : ''}`;
    const continuity = frame.continuity_token ? ` ct=${frame.continuity_token}` : '';
    console.log(`- ${label}${continuity}`);
  }
}

function handleExplain(file: string, branchId?: string): void {
  const summary = runInspect(file);
  const target = branchId ?? summary.branches[0]?.id;

  if (!target) {
    console.log('No branches present to explain.');
    return;
  }

  const branch = summary.branches.find((b) => b.id === target);
  if (!branch) {
    console.log(`Branch ${target} not found.`);
    return;
  }

  console.log(`Branch: ${target}`);
  console.log(`Status: ${branch.status}`);
  if (branch.path) console.log(`Path: ${branch.path}`);
  if (branch.class) console.log(`Class: ${branch.class}`);
  if (branch.confidence !== undefined) console.log(`Confidence: ${branch.confidence}`);
  else console.log('Confidence: (not provided; tooling MAY normalize)');
  if (summary.continuity.notes.length) {
    console.log('Continuity Notes:');
    for (const n of summary.continuity.notes) console.log(`- ${n}`);
  }
  if (summary.orientation.drift_level !== 'unknown') {
    console.log(`Observed drift level: ${summary.orientation.drift_level}`);
  }
}

function printHelp(): void {
  console.log('ltp-inspect commands:');
  console.log('  trace <frames.jsonl> [--json|--text|--both]');
  console.log('  replay <frames.jsonl> [--from <frameId>]');
  console.log('  explain <frames.jsonl> [--branch <id>]');
  console.log('');
  console.log('Outputs JSON by default; add --text for a human-readable view.');
  console.log('');
  console.log('Frames may be JSON array or JSONL with one frame per line.');
  console.log('Confidence values are optional; if present they must be within [0.0, 1.0].');
  console.log('Continuity tokens MUST remain stable within a session; rotations are flagged.');
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  try {
    if (!args.file && args.command !== 'help') {
      printHelp();
      return;
    }

    switch (args.command) {
      case 'trace':
        handleTrace(args.file as string, args.format);
        break;
      case 'replay':
        handleReplay(args.file as string, args.from);
        break;
      case 'explain':
        handleExplain(args.file as string, args.branch);
        break;
      default:
        printHelp();
    }
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
